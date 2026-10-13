import net, { Socket } from 'net';
import { getLogger } from 'log4js';
import { Hdc } from '../hdc';
import { hostUnusedPort } from '../../utils/net_utils';

const logger = getLogger();
const RPC_MODULE = 'com.ohos.devicetest.hypiumApiHelper';
const MESSAGE_HEAD = Buffer.from('_uitestkit_rpc_message_head_');
const MESSAGE_TAIL = Buffer.from('_uitestkit_rpc_message_tail_');
const MAX_FRAME_BYTES = 64 * 1024 * 1024;

export interface RpcResponse {
    sessionId: number;
    result: any;
}

export interface RpcMessageHandler {
    onMessage: (message: Buffer) => void;
    onError?: (error: Error) => void;
}

export interface RpcRequestOptions {
    timeoutMs?: number;
    handler?: RpcMessageHandler;
    expectedGeneration?: number;
}

interface PendingRequest {
    resolve: (response: RpcResponse) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
}

/** Owns the agent RPC forward and multiplexes requests and asynchronous messages on one socket. */
export class HypiumRpc {
    private hostPort = -1;
    private socket?: Socket;
    private readonly sockets = new Set<Socket>();
    private starting?: Promise<void>;
    private connecting?: Promise<void>;
    private closing?: Promise<void>;
    private generation = 0;
    private buffer = Buffer.alloc(0);
    private nextMessageId = Math.floor(Math.random() * 0xffffffff) >>> 0;
    private readonly pending = new Map<number, PendingRequest>();
    private readonly messageHandlers = new Map<number, RpcMessageHandler>();

    constructor(private readonly hdc: Hdc, private readonly deviceEndpoint: string) {}

    private getHostPort(): number {
        if (this.hostPort < 0) throw new Error('Uitest agent RPC forwarding has not started.');
        return this.hostPort;
    }

    getEndpoint(): string {
        return `127.0.0.1:${this.getHostPort()}`;
    }

    async start(): Promise<void> {
        if (this.closing) await this.closing;
        if (this.starting) return this.starting;
        if (this.hostPort >= 0) return;

        const starting = this.startForward();
        this.starting = starting;
        try {
            await starting;
        } finally {
            if (this.starting === starting) this.starting = undefined;
        }
    }

    private async startForward(): Promise<void> {
        const port = await hostUnusedPort();
        this.hostPort = port;
        try {
            this.hdc.fportRm(`tcp:${port}`, this.deviceEndpoint);
            this.hdc.fport(`tcp:${port}`, this.deviceEndpoint);
            logger.info(`Forwarded local RPC port ${port} to device endpoint ${this.deviceEndpoint}.`);
        } catch (error) {
            try { this.hdc.fportRm(`tcp:${port}`, this.deviceEndpoint); } catch { /* Clean up a partially created forward. */ }
            this.hostPort = -1;
            throw error;
        }
    }

    async connect(timeoutMs = 10000): Promise<void> {
        if (this.closing) throw new Error('Uitest agent RPC connection is closing.');
        if (this.socket && !this.socket.destroyed) {
            if (this.connecting) await this.connecting;
            return;
        }
        if (this.connecting) return this.connecting;

        const connecting = this.openSocket(timeoutMs);
        this.connecting = connecting;
        try {
            await connecting;
        } finally {
            if (this.connecting === connecting) this.connecting = undefined;
        }
    }

    getGeneration(): number {
        return this.generation;
    }

    async request(method: string, params: unknown, options: RpcRequestOptions = {}): Promise<RpcResponse> {
        const timeoutMs = options.timeoutMs ?? 10000;
        try {
            if (options.expectedGeneration === undefined) {
                await this.connect(timeoutMs);
            } else if (options.expectedGeneration !== this.generation) {
                throw new Error('RPC connection changed; reconnect the device session before sending more control requests.');
            }
            return await this.sendRequestFrame({ module: RPC_MODULE, method, params }, timeoutMs, options);
        } catch (error) {
            const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            const endpoint = this.hostPort >= 0 ? this.getEndpoint() : 'unknown';
            const message = `Uitest RPC request failed (method=${method}, endpoint=${endpoint}): ${detail}`;
            logger.error(message, error);
            const wrapped = new Error(message);
            (wrapped as Error & { cause?: unknown }).cause = error;
            const code = (error as NodeJS.ErrnoException | undefined)?.code;
            if (code) (wrapped as NodeJS.ErrnoException).code = code;
            throw wrapped;
        }
    }

    /** Encodes and sends one framed request, then resolves with its correlated response. */
    private sendRequestFrame(
        message: unknown,
        timeoutMs: number,
        options: RpcRequestOptions,
    ): Promise<RpcResponse> {
        const socket = this.socket;
        if (!socket || socket.destroyed) throw new Error('Uitest RPC socket is not connected.');

        const serialized = JSON.stringify(message);
        if (serialized === undefined) throw new Error('Uitest RPC request is not JSON serializable.');
        const payload = Buffer.from(serialized);
        const sessionId = this.allocateMessageId();
        const idBytes = Buffer.alloc(4);
        idBytes.writeUInt32BE(sessionId);
        const lengthBytes = Buffer.alloc(4);
        lengthBytes.writeUInt32BE(payload.length);
        const packet = Buffer.concat([MESSAGE_HEAD, idBytes, lengthBytes, payload, MESSAGE_TAIL]);

        return new Promise<RpcResponse>((resolve, reject) => {
            const timeout = timeoutMs > 0
                ? setTimeout(() => this.rejectRequest(sessionId, new Error(
                    `Timed out waiting for uitest agent RPC response (session=${sessionId}).`,
                )), timeoutMs)
                : undefined;
            this.pending.set(sessionId, { resolve, reject, timeout });
            if (options.handler) this.messageHandlers.set(sessionId, options.handler);

            socket.write(packet, (error) => {
                if (error) this.rejectRequest(sessionId, error);
            });
        });
    }

    removeMessageHandler(sessionId: number): void {
        this.messageHandlers.delete(sessionId);
    }

    async close(): Promise<void> {
        if (this.closing) return this.closing;
        const closing = this.closeInternal();
        this.closing = closing;
        try {
            await closing;
        } finally {
            if (this.closing === closing) this.closing = undefined;
        }
    }

    private async closeInternal(): Promise<void> {
        if (this.starting) {
            try { await this.starting; } catch { /* A failed start has already cleaned up its forward. */ }
        }
        const sockets = [...this.sockets];
        this.socket = undefined;
        this.buffer = Buffer.alloc(0);
        this.failPending(new Error('Uitest agent RPC connection closed.'), false);

        await Promise.all(sockets.map((socket) => this.closeSocket(socket)));

        if (this.hostPort < 0) return;
        const port = this.hostPort;
        this.hostPort = -1;
        try {
            this.hdc.fportRm(`tcp:${port}`, this.deviceEndpoint);
        } catch (error) {
            logger.debug(`Failed to remove local RPC port forward ${port}: ${error instanceof Error ? error.message : String(error)}.`);
        }
    }

    private openSocket(timeoutMs: number): Promise<void> {
        const port = this.getHostPort();
        const socket = new net.Socket();
        socket.setNoDelay(true);
        this.socket = socket;
        this.sockets.add(socket);
        socket.once('close', () => this.sockets.delete(socket));

        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanupConnectListeners();
                if (this.socket === socket) this.socket = undefined;
                socket.destroy();
                reject(new Error(`Timed out connecting to uitest agent RPC (${this.getEndpoint()}).`));
            }, timeoutMs);

            const cleanupConnectListeners = (): void => {
                clearTimeout(timeout);
                socket.removeListener('connect', onConnect);
                socket.removeListener('error', onConnectError);
                socket.removeListener('close', onConnectClose);
            };
            const onConnect = (): void => {
                if (settled) return;
                settled = true;
                cleanupConnectListeners();
                this.buffer = Buffer.alloc(0);
                socket.on('data', (chunk) => {
                    if (this.socket === socket) this.onData(chunk);
                });
                socket.on('error', (error) => this.handleSocketFailure(socket, error));
                socket.once('end', () => this.handleSocketFailure(socket, new Error('Uitest agent RPC socket ended.')));
                socket.once('close', () => this.handleSocketFailure(socket, new Error('Uitest agent RPC socket closed.')));
                this.generation += 1;
                resolve();
            };
            const onConnectError = (error: Error): void => {
                if (settled) return;
                settled = true;
                cleanupConnectListeners();
                if (this.socket === socket) this.socket = undefined;
                socket.destroy();
                reject(error);
            };
            const onConnectClose = (): void => {
                onConnectError(new Error('Uitest agent RPC socket closed before connecting.'));
            };

            socket.once('connect', onConnect);
            socket.once('error', onConnectError);
            socket.once('close', onConnectClose);
            socket.connect(port, '127.0.0.1');
        });
    }

    private closeSocket(socket: Socket): Promise<void> {
        if (socket.closed) return Promise.resolve();
        return new Promise<void>((resolve) => {
            socket.once('close', resolve);
            socket.destroy();
        });
    }

    private readonly onData = (chunk: Buffer): void => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= MESSAGE_HEAD.length + 8) {
            if (!this.buffer.subarray(0, MESSAGE_HEAD.length).equals(MESSAGE_HEAD)) {
                this.failConnection(new Error('Invalid uitest RPC frame header.'));
                return;
            }

            const sessionId = this.buffer.readUInt32BE(MESSAGE_HEAD.length);
            const length = this.buffer.readUInt32BE(MESSAGE_HEAD.length + 4);
            if (length > MAX_FRAME_BYTES) {
                this.failConnection(new Error(`Uitest RPC frame is too large (${length} bytes).`));
                return;
            }

            const totalLength = MESSAGE_HEAD.length + 8 + length + MESSAGE_TAIL.length;
            if (this.buffer.length < totalLength) return;

            const bodyStart = MESSAGE_HEAD.length + 8;
            const body = this.buffer.subarray(bodyStart, bodyStart + length);
            const tail = this.buffer.subarray(bodyStart + length, totalLength);
            if (!tail.equals(MESSAGE_TAIL)) {
                this.failConnection(new Error('Invalid uitest RPC frame trailer.'));
                return;
            }
            this.buffer = this.buffer.subarray(totalLength);
            this.dispatchMessage(sessionId, body);
        }
    };

    private dispatchMessage(sessionId: number, body: Buffer): void {
        const pending = this.pending.get(sessionId);
        if (pending) {
            if (pending.timeout) clearTimeout(pending.timeout);
            this.pending.delete(sessionId);
            try {
                const response = JSON.parse(body.toString('utf8'));
                if (response.exception) {
                    this.messageHandlers.delete(sessionId);
                    pending.reject(new Error(response.exception.message ?? JSON.stringify(response.exception)));
                } else {
                    pending.resolve({ sessionId, result: response.result });
                }
            } catch (error) {
                this.messageHandlers.delete(sessionId);
                pending.reject(new Error(
                    `Invalid JSON in uitest agent RPC response (session=${sessionId}): ${error instanceof Error ? error.message : String(error)}.`,
                ));
            }
            return;
        }

        const handler = this.messageHandlers.get(sessionId);
        if (!handler) return;
        try {
            handler.onMessage(body);
        } catch (error) {
            logger.warn(`Uitest agent async message handler failed (session=${sessionId}): ${error instanceof Error ? error.message : String(error)}.`);
        }
    }

    private allocateMessageId(): number {
        const maxAttempts = this.pending.size + this.messageHandlers.size + 1;
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            this.nextMessageId = (this.nextMessageId + 1) >>> 0;
            if (!this.pending.has(this.nextMessageId) && !this.messageHandlers.has(this.nextMessageId)) {
                return this.nextMessageId;
            }
        }
        throw new Error('No uitest agent RPC session IDs are available.');
    }

    private rejectRequest(sessionId: number, error: Error): void {
        const pending = this.pending.get(sessionId);
        if (!pending) return;
        if (pending.timeout) clearTimeout(pending.timeout);
        this.pending.delete(sessionId);
        this.messageHandlers.delete(sessionId);
        pending.reject(error);
    }

    private failConnection(error: Error): void {
        const socket = this.socket;
        this.socket = undefined;
        this.buffer = Buffer.alloc(0);
        this.failPending(error, true);
        socket?.destroy();
    }

    private handleSocketFailure(socket: Socket, error: Error): void {
        if (this.socket !== socket) return;
        this.socket = undefined;
        this.buffer = Buffer.alloc(0);
        this.failPending(error, true);
        socket.destroy();
    }

    private failPending(error: Error, notifyHandlers: boolean): void {
        for (const [sessionId, pending] of this.pending) {
            if (pending.timeout) clearTimeout(pending.timeout);
            pending.reject(error);
            this.pending.delete(sessionId);
        }
        for (const [sessionId, handler] of this.messageHandlers) {
            if (notifyHandlers) {
                try { handler.onError?.(error); } catch { /* Keep cleanup independent of client callbacks. */ }
            }
            this.messageHandlers.delete(sessionId);
        }
    }
}
