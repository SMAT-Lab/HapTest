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
import { ClientSocket } from '../../utils/net_utils';
import { getLogger } from 'log4js';

const logger = getLogger();

export class HypiumRpc {
    private socket: ClientSocket;
    private timeout: number;
    private connected: boolean;
    private endpoint: string;

    constructor(timeout: number = 10000) {
        this.socket = new ClientSocket();
        this.timeout = timeout;
        this.connected = false;
        this.endpoint = 'unknown';
    }

    async connect(port: number, address: string = '127.0.0.1'): Promise<boolean> {
        this.endpoint = `${address}:${port}`;
        this.socket.setTimeout(this.timeout);
        try {
            await this.socket.connect(port, address);
            this.connected = true;
            return this.connected;
        } catch (err) {
            logger.error(`Hypium RPC connect failed (endpoint=${this.endpoint}, timeout=${this.timeout}ms).`, err);
            throw err;
        } finally {
            this.socket.setTimeout(0);
        }
    }

    async close() {
        if (this.connected) {
            await this.socket.close();
            this.connected = false;
        }
    }

    async request(method: string, params: any): Promise<any | undefined> {
        // if (!this.connected) {
        //     throw new Error('Socket not connected.');
        // }
        let data = {
            module: 'com.ohos.devicetest.hypiumApiHelper',
            method: method,
            params: params,
            request_id: moment().format('YYYYMMDDHHmmssSSSSSS'),
            client: '127.0.0.1',
        };
        this.socket.setTimeout(this.timeout);
        try {
            await this.socket.write(JSON.stringify(data) + '\n');
            let response = await this.socket.read();
            if (response) {
                response = JSON.parse(response).result;
            }
            return response;
        } catch (err) {
            const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            const message = `Hypium RPC request failed (method=${method}, request_id=${data.request_id}, endpoint=${this.endpoint}): ${detail}`;
            logger.error(message, err);
            const wrapped = new Error(message);
            (wrapped as Error & { cause?: unknown }).cause = err;
            const code = (err as NodeJS.ErrnoException | undefined)?.code;
            if (code) {
                (wrapped as NodeJS.ErrnoException).code = code;
            }
            throw wrapped;
        } finally {
            this.socket.setTimeout(0);
        }
    }
}
