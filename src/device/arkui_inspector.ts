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
import WebSocket from 'ws';
import { Hdc } from './hdc';
import { getLogger } from 'log4js';
const logger = getLogger();

/**
 * ArkUI have a inspector wss node (ark:pid@bundleName)，when client send {'type': 'tree'},
 * server will repose two message layout and screen snapshot.
 * So, we used hdc fport tcp:{port} ark:{pid}@{bundleName} to forword remode node to local.
 * Then used wss to dump ArkUI layout and snapshot.
 */
export class ArkUIInspector {
    private hdc: Hdc;

    constructor(hdc: Hdc) {
        this.hdc = hdc;
    }

    private async getUnusedPort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(() => {
                let address: net.AddressInfo = server.address() as net.AddressInfo;
                server.close();
                resolve(address.port);
            });
        });
    }

    async dump(bundleName: string, sn?: string): Promise<any[]> {
        // remove last forward
        let fportls = this.hdc.fportLs();
        fportls.forEach((value) => {
            if (sn) {
                if (value[0] == sn && value[2].indexOf(`@${bundleName}`) > 0 && value[3] == '[Forward]') {
                    this.hdc.fportRm(value[1], value[2]);
                }
            } else {
                if (value[2].indexOf(`@${bundleName}`) > 0 && value[3] == '[Forward]') {
                    this.hdc.fportRm(value[1], value[2]);
                }
            }
        });

        let port = await this.getUnusedPort();
        return new Promise((resolve, reject) => {
            let pid = this.hdc.pidof(bundleName);
            if (pid == 0) {
                resolve([{ err: 'bundle not running.' }]);
                return;
            }

            // forward
            this.hdc.fport(`tcp:${port}`, `ark:${pid}@${bundleName}`);
            let response = new Array<any>(2);
            let idx = 0;

            const wss = new WebSocket(`ws://localhost:${port}`);
            wss.on('open', () => {
                wss.send(JSON.stringify({ type: 'tree' }));
                setTimeout(() => {
                    response[0] = { err: 'timeout' };
                    wss.close();
                }, 500);
            });

            wss.on('message', (data: WebSocket.RawData) => {
                response[idx++] = JSON.parse(data.toString('utf-8'));
                if (idx == 2) {
                    wss.close();
                }
            });

            wss.on('error', (err: Error) => {
                logger.error(err);
                resolve([{ err: err.message }]);
            });

            wss.on('close', () => {
                resolve(response);
            });
        });
    }
}
