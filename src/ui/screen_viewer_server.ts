/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import { Server } from 'http';
import { getLogger } from 'log4js';
import { Hdc } from '../device/hdc';
import { ScreenCaptureStream } from '../device/uidriver/screen_capture_stream';
import type { ScreenCaptureFrame } from '../device/uidriver/screen_capture_stream';
import { UitestAgent } from '../device/uidriver/uitest_agent';

const logger = getLogger('haptest-screen-viewer');

export interface ScreenViewerServerOptions {
    connectKey?: string;
    port: number;
}

interface ScreenViewerStatus {
    target: string;
    streaming: boolean;
    error?: string;
    frame?: { width?: number; height?: number; receivedAt: string; ageMs: number };
}

function resolveTarget(connectKey?: string): string {
    if (connectKey?.trim()) return connectKey.trim();

    const connected = Hdc.listTargets().filter((target) => target.state.toLowerCase() === 'connected');
    if (connected.length === 0) {
        throw new Error('No connected HarmonyOS device found. Connect a device with HDC or pass --target.');
    }
    if (connected.length > 1) {
        throw new Error('Multiple connected devices found. Pass --target to select one.');
    }
    return connected[0].serial;
}

function writeFrame(response: Response, frame: ScreenCaptureFrame): void {
    const bytes = frame.data;
    response.write(`--frame\r\nContent-Type: ${frame.mimeType}\r\nContent-Length: ${bytes.length}\r\n\r\n`);
    response.write(bytes);
    response.write('\r\n');
}

export async function startScreenViewerServer(options: ScreenViewerServerOptions): Promise<void> {
    const target = resolveTarget(options.connectKey);
    const hdc = new Hdc(target);
    const agent = new UitestAgent(hdc);
    let captureStream: ScreenCaptureStream | undefined;
    let latestFrame: ScreenCaptureStatusFrame | undefined;
    let streamError: string | undefined;
    let startPromise: Promise<void> | undefined;
    let reconnectPromise: Promise<void> | undefined;
    let generation = 0;
    let shuttingDown = false;
    const clients = new Set<Response>();
    let shutdownPromise: Promise<void> | undefined;

    try {
        await agent.start();
    } catch (error) {
        await agent.stop();
        throw error;
    }

    const startCapture = async (): Promise<void> => {
        if (shuttingDown || captureStream) return;
        if (startPromise) return startPromise;
        const currentGeneration = ++generation;
        startPromise = (async () => {
            try {
                let stream: ScreenCaptureStream | undefined;
                stream = await ScreenCaptureStream.start(agent.getRpc(), (frame) => {
                    if (shuttingDown || generation !== currentGeneration) return;
                    latestFrame = { ...frame, receivedAt: new Date().toISOString() };
                    for (const client of clients) {
                        if (client.writable && client.writableLength < 1024 * 1024) {
                            writeFrame(client, frame);
                        }
                    }
                }, (error) => {
                    if (shuttingDown || generation !== currentGeneration) return;
                    streamError = error.message;
                    if (captureStream === stream) captureStream = undefined;
                    generation += 1;
                    logger.error(`Native screen stream disconnected (target=${target}).`, error);
                });

                if (shuttingDown || generation !== currentGeneration) {
                    await stream.stop();
                    return;
                }
                captureStream = stream;
                streamError = undefined;
                logger.info(`Native screen stream is ready (target=${target}).`);
            } catch (error) {
                if (!shuttingDown && generation === currentGeneration) {
                    streamError = error instanceof Error ? error.message : String(error);
                    logger.error(`Failed to start native screen stream (target=${target}).`, error);
                }
            } finally {
                startPromise = undefined;
            }
        })();
        return startPromise;
    };

    const reconnectCapture = async (): Promise<void> => {
        if (shuttingDown) throw new Error('Screen viewer is shutting down.');
        if (reconnectPromise) return reconnectPromise;

        const reconnecting = (async () => {
            if (startPromise) await startPromise;
            if (shuttingDown) throw new Error('Screen viewer is shutting down.');

            generation += 1;
            const previousStream = captureStream;
            captureStream = undefined;
            if (previousStream) {
                try {
                    await previousStream.stop();
                } catch (error) {
                    captureStream = previousStream;
                    throw error;
                }
            }

            latestFrame = undefined;
            streamError = undefined;
            // A device-side uitest daemon can disappear with its RPC socket.
            // Re-run agent startup so it can recreate the daemon and forward.
            await agent.stop();
            await agent.start();
            await startCapture();
            if (streamError) throw new Error(streamError);
            if (!captureStream) throw new Error('Native screen capture did not start.');
        })();
        reconnectPromise = reconnecting;
        try {
            await reconnecting;
        } finally {
            if (reconnectPromise === reconnecting) reconnectPromise = undefined;
        }
    };

    const app = express();
    app.post('/api/reconnect', async (_request: Request, response: Response) => {
        try {
            await reconnectCapture();
            response.json({ ok: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            response.status(503).json({ error: message });
        }
    });

    app.get('/api/status', (_request: Request, response: Response) => {
        const frameAgeMs = latestFrame ? Math.max(0, Date.now() - Date.parse(latestFrame.receivedAt)) : undefined;
        const frame = latestFrame && frameAgeMs !== undefined ? {
            width: latestFrame.width,
            height: latestFrame.height,
            receivedAt: latestFrame.receivedAt,
            ageMs: frameAgeMs,
        } : undefined;
        const status: ScreenViewerStatus = {
            target,
            // The agent pushes frames asynchronously; lack of a fresh frame
            // does not mean the capture RPC session has disconnected.
            streaming: Boolean(captureStream),
            error: streamError,
            frame,
        };
        response.json(status);
    });

    app.get('/stream.mjpg', (_request: Request, response: Response) => {
        if (shuttingDown) {
            response.status(503).end('Screen viewer is shutting down.');
            return;
        }
        response.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Connection: 'close',
        });
        clients.add(response);
        if (latestFrame) writeFrame(response, latestFrame);
        void startCapture();
        response.on('close', () => clients.delete(response));
    });

    const staticRoot = path.join(__dirname, '../../res/screen-viewer');
    const staticDir = path.join(staticRoot, 'static');
    if (fs.existsSync(staticDir)) app.use('/static', express.static(staticDir));

    const indexFile = path.join(staticRoot, 'index.html');
    app.get(['/', '/screen-viewer'], (_request: Request, response: Response) => {
        if (fs.existsSync(indexFile)) response.sendFile(indexFile);
        else response.status(404).send('screen-viewer page not found');
    });

    let server: Server;
    try {
        server = await new Promise<Server>((resolve, reject) => {
            const listeningServer = app.listen(options.port, '127.0.0.1', () => resolve(listeningServer));
            listeningServer.once('error', reject);
        });
    } catch (error) {
        await agent.stop();
        throw error;
    }

    logger.info(`haptest screen-viewer listening on http://localhost:${options.port} (target=${target}).`);
    void startCapture();

    const shutdown = (): Promise<void> => {
        if (shutdownPromise) return shutdownPromise;
        shuttingDown = true;
        generation += 1;
        shutdownPromise = (async () => {
            const serverClosed = new Promise<void>((resolve) => server.close(() => resolve()));
            for (const client of clients) client.end();
            clients.clear();
            try {
                await reconnectPromise;
            } catch (error) {
                logger.warn(`Failed to finish screen stream reconnect during shutdown: ${error instanceof Error ? error.message : String(error)}.`);
            }
            try {
                await startPromise;
                await captureStream?.stop();
            } catch (error) {
                logger.warn(`Failed to stop native screen stream cleanly during shutdown: ${error instanceof Error ? error.message : String(error)}.`);
            }
            captureStream = undefined;
            try {
                await agent.stop();
            } catch (error) {
                logger.warn(`Failed to stop uitest agent cleanly during shutdown: ${error instanceof Error ? error.message : String(error)}.`);
            } finally {
                await serverClosed;
                process.removeListener('SIGINT', onSigint);
                process.removeListener('SIGTERM', onSigterm);
                logger.info('haptest screen-viewer stopped.');
            }
        })();
        return shutdownPromise;
    };

    const onSigint = (): void => { void shutdown(); };
    const onSigterm = (): void => { void shutdown(); };
    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
}

type ScreenCaptureStatusFrame = ScreenCaptureFrame & { receivedAt: string };
