import { getLogger } from 'log4js';
import type { HypiumRpc, RpcRequestOptions, RpcResponse } from './hypium_rpc';

export interface ScreenCaptureFrame {
    mimeType: 'image/jpeg';
    data: Buffer;
    width?: number;
    height?: number;
}

const REQUEST_TIMEOUT_MS = 5000;
const logger = getLogger();

/** Native, event-driven screen capture multiplexed over the agent RPC connection. */
export class ScreenCaptureStream {
    private sessionId?: number;
    private closed = false;
    private started = false;
    private stopping?: Promise<void>;
    private readonly rpcGeneration: number;

    private constructor(
        private readonly rpc: HypiumRpc,
        private readonly onFrame: (frame: ScreenCaptureFrame) => void,
        private readonly onError?: (error: Error) => void,
    ) {
        this.rpcGeneration = rpc.getGeneration();
    }

    static async start(
        rpc: HypiumRpc,
        onFrame: (frame: ScreenCaptureFrame) => void,
        onError?: (error: Error) => void,
    ): Promise<ScreenCaptureStream> {
        await rpc.connect(REQUEST_TIMEOUT_MS);
        const stream = new ScreenCaptureStream(rpc, onFrame, onError);
        let response: RpcResponse;
        try {
            response = await stream.doCaptureRpc('startCaptureScreen', {
                options: { scale: 0.5 },
            }, {
                handler: {
                    onMessage: (message) => stream.handleMessage(message),
                    onError: (error) => stream.handleError(error),
                },
            });
        } catch (error) {
            stream.closed = true;
            // The device may have started capture even if its RPC response was
            // lost. Best effort stop prevents a timed-out start leaking a stream.
            try {
                const cleanup = await stream.doCaptureRpc('stopCaptureScreen');
                if (!cleanup.result) logger.warn('Device did not confirm cleanup after native screen capture start failed.');
            } catch (cleanupError) {
                logger.warn(`Failed to clean up native screen capture after start failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}.`);
            }
            throw error;
        }

        stream.sessionId = response.sessionId;
        if (stream.closed) {
            throw new Error('Agent RPC connection closed while starting native screen capture.');
        }
        if (!response.result) {
            stream.rpc.removeMessageHandler(response.sessionId);
            stream.closed = true;
            throw new Error('The uitest agent did not start native screen capture.');
        }
        stream.started = true;
        logger.info(`Native screen stream started (agent RPC endpoint=${stream.rpc.getEndpoint()}, session=${response.sessionId}).`);
        return stream;
    }

    async stop(): Promise<void> {
        if (this.closed) return;
        if (this.stopping) return this.stopping;
        const stopping = this.stopOnce();
        this.stopping = stopping;
        try {
            await stopping;
        } finally {
            if (this.stopping === stopping) this.stopping = undefined;
        }
    }

    private async stopOnce(): Promise<void> {
        try {
            if (this.started) {
                const response = await this.doCaptureRpc('stopCaptureScreen');
                if (!response.result) throw new Error('The uitest agent did not stop native screen capture.');
            }
        } catch (error) {
            logger.warn(`Native screen stream stop failed: ${error instanceof Error ? error.message : String(error)}.`);
            throw error;
        }

        this.started = false;
        this.closed = true;
        if (this.sessionId !== undefined) this.rpc.removeMessageHandler(this.sessionId);
        logger.info('Native screen stream stopped.');
    }

    private doCaptureRpc(
        api: 'startCaptureScreen' | 'stopCaptureScreen',
        args: Record<string, unknown> = {},
        options: RpcRequestOptions = {},
    ): Promise<RpcResponse> {
        return this.rpc.request('Captures', { api, args }, {
            ...options,
            timeoutMs: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
            expectedGeneration: this.rpcGeneration,
        });
    }

    private handleMessage(message: Buffer): void {
        if (this.closed) return;
        const dimensions = jpegDimensions(message);
        try {
            this.onFrame({
                mimeType: 'image/jpeg',
                data: message,
                ...dimensions,
            });
        } catch (error) {
            logger.warn(`Native screen frame callback failed: ${error instanceof Error ? error.message : String(error)}.`);
        }
    }

    private handleError(error: Error): void {
        if (this.closed) return;
        const wasStarted = this.started;
        this.started = false;
        this.closed = true;
        if (wasStarted) this.onError?.(error);
    }
}

function jpegDimensions(bytes: Buffer): { width?: number; height?: number } {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return {};
    let offset = 2;
    while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return {};
        const marker = bytes[offset + 1];
        offset += 2;
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const length = bytes.readUInt16BE(offset);
        if (length < 2 || offset + length > bytes.length) return {};
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
            return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
        }
        offset += length;
    }
    return {};
}
