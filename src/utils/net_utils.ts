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

import * as net from 'net';
import { getLogger } from 'log4js';

const logger = getLogger();
type TimeoutHandler = () => void;

/**
 * @example
 * const client = new ClientSocket();
 * let status = await client.connect(9907, '127.0.0.1');
 * if (!status) {
 *    return;
 * }
 * await client.write(JSON.stringify(data) + '\n');
 * let response = await client.read();
 * await client.close();
 */
export class ClientSocket {
    private socket: net.Socket;
    private timeoutHandler?: TimeoutHandler;

    constructor() {
        this.socket = new net.Socket();
    }

    async connect(port: number, address: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const errorHandler = (err: Error) => {
                logger.error(err);
                resolve(false);
            };

            this.socket.once('error', errorHandler);

            this.socket.connect(port, address, () => {
                this.socket.removeListener('error', errorHandler);
                resolve(true);
            });
        });
    }

    async write(chunk: string): Promise<number> {
        const stream = this.socket;
        let rejected = false;

        return new Promise((resolve, reject) => {
            if (!stream.writable || stream.closed || stream.destroyed) {
                return reject(new Error('write after end'));
            }

            const writeErrorHandler = (err: Error) => {
                rejected = true;
                reject(err);
            };

            stream.once('error', writeErrorHandler);

            logger.info(`ClientSocket write: ${chunk.trim()}`);
            const canWrite = stream.write(chunk);

            stream.removeListener('error', writeErrorHandler);

            if (canWrite) {
                if (!rejected) {
                    resolve(chunk.length);
                }
            } else {
                const errorHandler = (err: Error) => {
                    removeListeners();
                    reject(err);
                };

                const drainHandler = () => {
                    removeListeners();
                    resolve(chunk.length);
                };

                const closeHandler = () => {
                    removeListeners();
                    resolve(chunk.length);
                };

                const finishHandler = () => {
                    removeListeners();
                    resolve(chunk.length);
                };

                const removeListeners = () => {
                    stream.removeListener('close', closeHandler);
                    stream.removeListener('drain', drainHandler);
                    stream.removeListener('error', errorHandler);
                    stream.removeListener('finish', finishHandler);
                };

                stream.on('close', closeHandler);
                stream.on('drain', drainHandler);
                stream.on('error', errorHandler);
                stream.on('finish', finishHandler);
            }
        });
    }

    async read(): Promise<string | undefined> {
        const stream = this.socket;

        return new Promise((resolve, reject) => {
            if (!stream.readable || stream.closed || stream.destroyed) {
                return resolve(undefined);
            }

            const readableHandler = () => {
                const chunk = stream.read();

                if (chunk !== null) {
                    removeListeners();
                    logger.info(`ClientSocket read: ${chunk.toString()}`);
                    resolve(chunk.toString());
                }
            };

            const closeHandler = () => {
                removeListeners();
                resolve(undefined);
            };

            const endHandler = () => {
                removeListeners();
                resolve(undefined);
            };

            const errorHandler = (err: Error) => {
                removeListeners();
                reject(err);
            };

            const removeListeners = () => {
                stream.removeListener('close', closeHandler);
                stream.removeListener('error', errorHandler);
                stream.removeListener('end', endHandler);
                stream.removeListener('readable', readableHandler);
            };

            stream.on('close', closeHandler);
            stream.on('end', endHandler);
            stream.on('error', errorHandler);
            stream.on('readable', readableHandler);

            readableHandler();
        });
    }

    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.end(() => {
                resolve();
            });
        });
    }

    setTimeout(timeout: number): this {
        const socket = this.socket;
        if (timeout === 0) {
            if (this.timeoutHandler) {
                socket.removeListener('timeout', this.timeoutHandler);
                this.timeoutHandler = undefined;
            }
        } else {
            if (!this.timeoutHandler) {
                this.timeoutHandler = () => {
                    this.timeoutHandler = undefined;
                    socket.destroy(new Error('timeout'));
                };
                socket.once('timeout', this.timeoutHandler);
            }
        }

        socket.setTimeout(timeout);

        return this;
    }
}

export async function hostUnusedPort(): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(() => {
            let address: net.AddressInfo = server.address() as net.AddressInfo;
            server.close();
            resolve(address.port);
        });
    });
}
