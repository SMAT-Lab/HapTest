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

import moment from 'moment';
import { getLogger } from 'log4js';
import { ClientSocket } from '../../utils/net_utils';

const logger = getLogger();

export class HypiumRpc {
    private socket: ClientSocket;
    private timeout: number;
    private connected: boolean;
    private hostPort?: number;
    private hostAddress: string;

    constructor(timeout: number = 10000) {
        this.socket = new ClientSocket();
        this.timeout = timeout;
        this.connected = false;
        this.hostAddress = '127.0.0.1';
    }

    async connect(port: number, address: string = '127.0.0.1'): Promise<boolean> {
        this.hostPort = port;
        this.hostAddress = address;
        this.socket = new ClientSocket();
        this.socket.setTimeout(this.timeout);
        await this.socket.connect(port, address);
        this.socket.setTimeout(0);
        this.connected = true;
        return this.connected;
    }

    async close() {
        if (this.connected) {
            await this.socket.close();
            this.connected = false;
        }
    }

    async request(method: string, params: any): Promise<any | undefined> {
        const data = {
            module: 'com.ohos.devicetest.hypiumApiHelper',
            method: method,
            params: params,
            request_id: moment().format('YYYYMMDDHHmmssSSSSSS'),
            client: '127.0.0.1',
        };

        try {
            if (!this.connected && this.hostPort !== undefined) {
                await this.connect(this.hostPort, this.hostAddress);
            }

            this.socket.setTimeout(this.timeout);
            await this.socket.write(JSON.stringify(data) + '\n');
            let response = await this.socket.read();
            this.socket.setTimeout(0);
            if (response) {
                response = JSON.parse(response).result;
            }
            return response;
        } catch (error) {
            logger.warn(`HypiumRpc request failed for ${method}, reconnecting and continuing`, error);
            this.connected = false;
            try {
                await this.socket.close();
            } catch {
                // ignore close errors
            }

            if (this.hostPort !== undefined) {
                try {
                    await this.connect(this.hostPort, this.hostAddress);
                } catch (reconnectError) {
                    logger.warn(`HypiumRpc reconnect failed for ${method}`, reconnectError);
                }
            }

            return undefined;
        }
    }
}
