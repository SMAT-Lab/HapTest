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
import PromiseSocket from 'promise-socket';
import { getLogger } from 'log4js';

const logger = getLogger();

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
    private socket: PromiseSocket<net.Socket>;

    constructor() {
        this.socket = new PromiseSocket(new net.Socket());
    }

    async connect(port: number, address: string): Promise<void> {
        await this.socket.connect(port, address);
    }

    async write(chunk: string): Promise<number> {
        logger.info(`ClientSocket write: ${chunk.trim()}`);
        return await this.socket.write(chunk);
    }

    async read(): Promise<string | undefined> {
        let chunks: string[] = [];

        // Use the JSON validity to determine whether the fragmented packet is received
        let readMore = false;
        do {
            let content = await this.socket.read();
            if (content instanceof Buffer) {
                content = content.toString();
            }
            if (content) {
                chunks.push(content as string);
            }
            try {
                JSON.parse(chunks.join(''));
                readMore = false;
            } catch {
                readMore = true;
            }
        } while(readMore);

        logger.debug(`ClientSocket read: ${chunks.join('')}`);
        return chunks.join('');
    }

    async close(): Promise<void> {
        await this.socket.end();
    }

    setTimeout(timeout: number): this {
        this.socket.setTimeout(timeout);
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
