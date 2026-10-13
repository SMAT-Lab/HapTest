import { describe, expect, it, vi } from 'vitest';
import { HypiumRpc } from '../../src/device/uidriver/hypium_rpc';
import { ScreenCaptureStream } from '../../src/device/uidriver/screen_capture_stream';

function fakeRpc(request: ReturnType<typeof vi.fn>) {
    return {
        connect: vi.fn(async () => undefined),
        getEndpoint: () => '127.0.0.1:1234',
        getGeneration: () => 1,
        request,
        removeMessageHandler: vi.fn(),
    } as unknown as HypiumRpc;
}

describe('screen capture stream lifecycle', () => {
    it('keeps a failed stop retryable and removes the frame subscription only after success', async () => {
        let stopAttempts = 0;
        const request = vi.fn(async (_method: string, params: any) => {
            if (params.api === 'startCaptureScreen') return { sessionId: 41, result: true };
            stopAttempts += 1;
            if (stopAttempts === 1) throw new Error('stop failed');
            return { sessionId: 42, result: true };
        });
        const rpc = fakeRpc(request);
        const stream = await ScreenCaptureStream.start(rpc, vi.fn());

        await expect(stream.stop()).rejects.toThrow('stop failed');
        expect(rpc.removeMessageHandler).not.toHaveBeenCalled();

        await stream.stop();
        expect(stopAttempts).toBe(2);
        expect(rpc.removeMessageHandler).toHaveBeenCalledWith(41);
    });

    it('coalesces concurrent stop requests', async () => {
        let finishStop!: (response: { sessionId: number; result: boolean }) => void;
        const request = vi.fn((_method: string, params: any) => {
            if (params.api === 'startCaptureScreen') {
                return Promise.resolve({ sessionId: 51, result: true });
            }
            return new Promise<{ sessionId: number; result: boolean }>((resolve) => { finishStop = resolve; });
        });
        const rpc = fakeRpc(request);
        const stream = await ScreenCaptureStream.start(rpc, vi.fn());

        const firstStop = stream.stop();
        const secondStop = stream.stop();
        expect(request).toHaveBeenCalledTimes(2);

        finishStop({ sessionId: 52, result: true });
        await Promise.all([firstStop, secondStop]);
        expect(rpc.removeMessageHandler).toHaveBeenCalledWith(51);
    });

    it('fails start if the shared RPC connection closes before start completes', async () => {
        const request = vi.fn(async (_method: string, params: any, options: any) => {
            if (params.api === 'stopCaptureScreen') return { sessionId: 62, result: true };
            options.handler.onError(new Error('socket closed'));
            return { sessionId: 61, result: true };
        });
        const rpc = fakeRpc(request);

        await expect(ScreenCaptureStream.start(rpc, vi.fn())).rejects.toThrow(/RPC connection closed while starting/i);
    });
});
