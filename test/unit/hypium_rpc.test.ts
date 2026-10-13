import net from 'net';
import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HypiumRpc } from '../../src/device/uidriver/hypium_rpc';
import { Hdc } from '../../src/device/hdc';

const HEADER = Buffer.from('_uitestkit_rpc_message_head_');
const TAIL = Buffer.from('_uitestkit_rpc_message_tail_');

function frame(sessionId: number, payload: Buffer): Buffer {
    const id = Buffer.alloc(4);
    id.writeUInt32BE(sessionId);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(payload.length);
    return Buffer.concat([HEADER, id, length, payload, TAIL]);
}

function getForwardedPort(rpc: HypiumRpc): number {
    const [, port] = rpc.getEndpoint().split(':');
    return Number(port);
}

describe('HypiumRpc lifecycle', () => {
    let server: net.Server | undefined;
    let accepted: net.Socket[] = [];

    afterEach(async () => {
        for (const socket of accepted) socket.destroy();
        accepted = [];
        if (!server?.listening) {
            server = undefined;
            return;
        }
        await new Promise<void>((resolve) => server!.close(() => resolve()));
        server = undefined;
    });

    it('reuses one framed socket for repeated connect calls', async () => {
        let resolveAccepted!: () => void;
        const acceptedOnce = new Promise<void>((resolve) => { resolveAccepted = resolve; });
        server = net.createServer((socket) => {
            accepted.push(socket);
            socket.on('error', () => {});
            resolveAccepted();
        });
        const hdc = {
            fport: vi.fn(),
            fportRm: vi.fn(),
        } as unknown as Hdc;
        const rpc = new HypiumRpc(hdc, 'localabstract:uitest_socket');

        await rpc.start();
        const port = getForwardedPort(rpc);
        await new Promise<void>((resolve) => server!.listen(port, '127.0.0.1', resolve));
        await rpc.connect();
        await rpc.connect();
        await acceptedOnce;
        const clientSocket = (rpc as unknown as { socket: net.Socket }).socket;

        expect(hdc.fport).toHaveBeenCalledWith(`tcp:${port}`, 'localabstract:uitest_socket');
        expect(accepted).toHaveLength(1);

        await rpc.close();

        expect(clientSocket.destroyed).toBe(true);
        expect(hdc.fportRm).toHaveBeenLastCalledWith(`tcp:${port}`, 'localabstract:uitest_socket');
        expect(() => getForwardedPort(rpc)).toThrow(/has not started/i);
    });

    it('multiplexes a response and async messages by session ID', async () => {
        let responseSent = false;
        server = net.createServer((socket) => {
            accepted.push(socket);
            let buffer = Buffer.alloc(0);
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                if (responseSent || buffer.length < HEADER.length + 8) return;
                const sessionId = buffer.readUInt32BE(HEADER.length);
                const length = buffer.readUInt32BE(HEADER.length + 4);
                const totalLength = HEADER.length + 8 + length + TAIL.length;
                if (buffer.length < totalLength) return;
                responseSent = true;
                socket.write(frame(sessionId, Buffer.from('{"result":"started"}')));
                socket.write(frame(sessionId, Buffer.from([0xff, 0xd8, 0xff, 0xd9])));
            });
        });
        const hdc = { fport: vi.fn(), fportRm: vi.fn() } as unknown as Hdc;
        const rpc = new HypiumRpc(hdc, 'localabstract:uitest_socket');
        await rpc.start();
        const port = getForwardedPort(rpc);
        await new Promise<void>((resolve) => server!.listen(port, '127.0.0.1', resolve));

        const asyncMessages: Buffer[] = [];
        const response = await rpc.request('Captures', {}, {
            timeoutMs: 1000,
            handler: { onMessage: (message) => asyncMessages.push(message) },
        });

        expect(response.result).toBe('started');
        expect(asyncMessages).toEqual([Buffer.from([0xff, 0xd8, 0xff, 0xd9])]);
        await rpc.close();
    });

    it('does not transparently reuse a restarted socket for an old driver generation', async () => {
        let resolveAccepted!: () => void;
        const acceptedOnce = new Promise<void>((resolve) => { resolveAccepted = resolve; });
        let secondSocketRequests = 0;
        server = net.createServer((socket) => {
            accepted.push(socket);
            socket.on('error', () => {});
            const ordinal = accepted.length;
            resolveAccepted();
            let buffer = Buffer.alloc(0);
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                while (buffer.length >= HEADER.length + 8) {
                    const sessionId = buffer.readUInt32BE(HEADER.length);
                    const length = buffer.readUInt32BE(HEADER.length + 4);
                    const totalLength = HEADER.length + 8 + length + TAIL.length;
                    if (buffer.length < totalLength) return;
                    buffer = buffer.subarray(totalLength);
                    if (ordinal > 1) secondSocketRequests += 1;
                    socket.write(frame(sessionId, Buffer.from('{"result":"ok"}')));
                }
            });
        });
        const hdc = { fport: vi.fn(), fportRm: vi.fn() } as unknown as Hdc;
        const rpc = new HypiumRpc(hdc, 'localabstract:uitest_socket');
        await rpc.start();
        const port = getForwardedPort(rpc);
        await new Promise<void>((resolve) => server!.listen(port, '127.0.0.1', resolve));
        await rpc.connect();
        await acceptedOnce;
        const generation = rpc.getGeneration();
        const clientSocket = (rpc as unknown as { socket: net.Socket }).socket;
        const clientClosed = new Promise<void>((resolve) => clientSocket.once('close', () => resolve()));
        accepted[0].destroy();
        await clientClosed;

        await expect(rpc.request('reconnect', {}, { timeoutMs: 1000 })).resolves.toMatchObject({ result: 'ok' });
        expect(rpc.getGeneration()).toBeGreaterThan(generation);
        await expect(rpc.request('callHypiumApi', {}, {
            timeoutMs: 1000,
            expectedGeneration: generation,
        })).rejects.toThrow(/RPC connection changed/i);
        expect(secondSocketRequests).toBe(1);
        expect(accepted).toHaveLength(2);
        await rpc.close();
    });

    it('ignores late data from a socket that has already been replaced', async () => {
        let resolveSecondRequest!: (sessionId: number) => void;
        const secondRequest = new Promise<number>((resolve) => { resolveSecondRequest = resolve; });
        server = net.createServer((socket) => {
            accepted.push(socket);
            socket.on('error', () => {});
            const ordinal = accepted.length;
            let buffer = Buffer.alloc(0);
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                if (buffer.length < HEADER.length + 8) return;
                const sessionId = buffer.readUInt32BE(HEADER.length);
                const length = buffer.readUInt32BE(HEADER.length + 4);
                const totalLength = HEADER.length + 8 + length + TAIL.length;
                if (buffer.length < totalLength) return;
                if (ordinal === 1) {
                    socket.write(frame(sessionId, Buffer.from('{"result":"first"}')));
                } else {
                    resolveSecondRequest(sessionId);
                }
                buffer = buffer.subarray(totalLength);
            });
        });
        const hdc = { fport: vi.fn(), fportRm: vi.fn() } as unknown as Hdc;
        const rpc = new HypiumRpc(hdc, 'localabstract:uitest_socket');
        await rpc.start();
        const port = getForwardedPort(rpc);
        await new Promise<void>((resolve) => server!.listen(port, '127.0.0.1', resolve));
        await expect(rpc.request('first', {})).resolves.toMatchObject({ result: 'first' });

        const oldClient = (rpc as unknown as { socket: net.Socket }).socket;
        const oldClientClosed = new Promise<void>((resolve) => oldClient.once('close', () => resolve()));
        accepted[0].destroy();
        await oldClientClosed;

        const nextRequest = rpc.request('second', {});
        const nextSessionId = await secondRequest;
        oldClient.emit('data', Buffer.from('stale frame from the old socket'));
        accepted[1].write(frame(nextSessionId, Buffer.from('{"result":"second"}')));

        await expect(nextRequest).resolves.toMatchObject({ result: 'second' });
        expect(accepted).toHaveLength(2);
        await rpc.close();
    });

    it('coalesces closes and waits for a failed socket to close before removing the forward', async () => {
        const fportRm = vi.fn();
        const hdc = { fport: vi.fn(), fportRm } as unknown as Hdc;
        const rpc = new HypiumRpc(hdc, 'localabstract:uitest_socket');
        await rpc.start();
        fportRm.mockClear();

        const socket = new EventEmitter() as EventEmitter & { closed: boolean; destroy: () => void };
        socket.closed = false;
        socket.destroy = vi.fn();
        const state = rpc as unknown as { socket?: net.Socket; sockets: Set<net.Socket> };
        state.socket = socket as unknown as net.Socket;
        state.sockets.add(socket as unknown as net.Socket);
        socket.once('close', () => state.sockets.delete(socket as unknown as net.Socket));
        (rpc as unknown as { handleSocketFailure: (socket: net.Socket, error: Error) => void })
            .handleSocketFailure(socket as unknown as net.Socket, new Error('socket failed'));

        const firstClose = rpc.close();
        const secondClose = rpc.close();
        expect(fportRm).not.toHaveBeenCalled();

        socket.closed = true;
        socket.emit('close');
        await Promise.all([firstClose, secondClose]);

        expect(fportRm).toHaveBeenCalledTimes(1);
    });
});
