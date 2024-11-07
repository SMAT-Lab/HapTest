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

export class HypiumRpc {
    private socket: ClientSocket;
    private timeout: number;
    private connected: boolean;

    constructor(timeout: number = 10000) {
        this.socket = new ClientSocket();
        this.timeout = timeout;
        this.connected = false;
    }

    async connect(port: number, address: string = '127.0.0.1'): Promise<boolean> {
        this.socket.setTimeout(this.timeout);
        await this.socket.connect(port, address);
        this.socket.setTimeout(0);
        return this.connected;
    }

    async close() {
        if (this.connected) {
            await this.socket.close();
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
        await this.socket.write(JSON.stringify(data) + '\n');
        let response = await this.socket.read();
        this.socket.setTimeout(0);
        if (response) {
            response = JSON.parse(response).result;
        }
        return response;
    }
}
