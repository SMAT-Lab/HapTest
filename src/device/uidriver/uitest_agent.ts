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

import path from 'path';
import { Device } from '../device';
import { Hdc, NEWLINE } from '../hdc';
import { hostUnusedPort } from '../../utils/net_utils';
import { getLogger } from 'log4js';

const RPC_PORT = 8012;
const logger = getLogger();

export class UitestAgent {
    private device: Device;
    private hdc: Hdc;
    private hostPort: number;

    constructor(device: Device) {
        this.device = device;
        this.hdc = this.device.getHdc();
        this.hostPort = -1;
    }

    getHostPort(): number {
        return this.hostPort;
    }

    async start() {
        const daemonRunning = this.isRunning();
        if (daemonRunning) {
            logger.info(`Uitest agent daemon already listens on device port ${RPC_PORT}.`);
        } else {
            logger.info(`Uitest agent daemon is not listening on device port ${RPC_PORT}; preparing agent and starting daemon.`);
            this.installAgentSo();
            this.hdc.excuteShellCommandSync('/system/bin/uitest start-daemon singleness &');
        }

        this.hostPort = await hostUnusedPort();
        this.hdc.fportRm(`tcp:${this.hostPort}`, `tcp:${RPC_PORT}`);
        this.hdc.fport(`tcp:${this.hostPort}`, `tcp:${RPC_PORT}`);
        logger.info(`Forwarded local RPC port ${this.hostPort} to device port ${RPC_PORT}.`);
    }

    async stop() {
        if (this.hostPort === -1) {
            return;
        }
        try {
            this.hdc.fportRm(`tcp:${this.hostPort}`, `tcp:${RPC_PORT}`);
        } catch (err) {
            // ignore
        }
        this.hostPort = -1;
    }

    private installAgentSo(): void { 
        let deviceAgentFile = '/data/local/tmp/agent.so';
        if (this.hdc.hasFile(deviceAgentFile)) {
            return;
        }
        let hostAgentFile = path.join(__dirname, '..', '..', '..', 'res/uitest/uitest_agent_v1.0.8.so');
        let archInfo = this.hdc.excuteShellCommandSync('file /system/bin/uitest');
        if (archInfo.indexOf('x86_64') > 0) {
            hostAgentFile = path.join(__dirname, '..', '..', '..', 'res/uitest/uitest_agent_v1.0.8.x86_64_so');
        }
        const status = this.hdc.sendFile(hostAgentFile, deviceAgentFile);
        if (status !== 0 || !this.hdc.hasFile(deviceAgentFile)) {
            throw new Error(`Failed to install uitest agent (${hostAgentFile} -> ${deviceAgentFile}, hdc status=${status}).`);
        }
    }

    private isRunning(): boolean {
        let output = this.hdc.excuteShellCommandSync(`netstat -anp | grep ${RPC_PORT}`);
        for (let line of output.split(NEWLINE)) {
            if (new RegExp(`\\b:${RPC_PORT}\\b.*\\bLISTEN\\b`).test(line)) {
                return true;
            }
        }
        return false;
    }
}
