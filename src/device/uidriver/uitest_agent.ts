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
import { Hdc, NEWLINE } from '../hdc';
import { getLogger } from 'log4js';
import {
    detectAgentArchitecture,
    inspectAgentCompatibility,
    selectAgentProfile,
    AgentProfile,
    AgentTransport,
} from './agent_catalog';
import { HypiumRpc } from './hypium_rpc';

const RPC_PORT = 8012;
const UNIX_SOCKET_NAME = 'uitest_socket';
const DEVICE_AGENT_FILE = '/data/local/tmp/agent.so';
const logger = getLogger();

export class UitestAgent {
    private hdc: Hdc;
    private deviceEndpoint: string;
    private rpc?: HypiumRpc;
    private stopping?: Promise<void>;

    constructor(hdc: Hdc) {
        this.hdc = hdc;
        this.deviceEndpoint = `tcp:${RPC_PORT}`;
    }

    getRpc(): HypiumRpc {
        if (!this.rpc) throw new Error('Uitest agent RPC connection has not started.');
        return this.rpc;
    }

    async start() {
        const uitestVersion = this.hdc.excuteShellCommandSync('/system/bin/uitest --version').trim();
        const uitestFileInfo = this.hdc.excuteShellCommandSync('file /system/bin/uitest').trim();
        const architecture = detectAgentArchitecture(uitestFileInfo);
        const profile = selectAgentProfile(uitestVersion, architecture);
        const otherTransport: AgentTransport = profile.transport === 'unix' ? 'tcp' : 'unix';
        const selectedEndpoint = this.getDeviceEndpoint(profile.transport);
        const selectedDaemonRunning = this.isRunning(profile.transport);
        const otherDaemonRunning = this.isRunning(otherTransport);
        const installedAgent = this.inspectAgent(profile);
        const needsAgentUpdate = installedAgent.reasons.length > 0;

        logger.info(
            `Uitest ${uitestVersion} (${architecture}) selected agent ${profile.version} ` +
            `and ${profile.transport} transport; installed agent update required=${needsAgentUpdate}.`
        );

        if (needsAgentUpdate || otherDaemonRunning) {
            await this.stopDaemon();
        }
        let activeAgentVersion = installedAgent.version;
        if (needsAgentUpdate) {
            activeAgentVersion = this.installAgent(profile);
        }
        if (needsAgentUpdate || otherDaemonRunning || !selectedDaemonRunning) {
            this.hdc.excuteShellCommandSync('/system/bin/uitest start-daemon singleness &');
            await this.waitForDaemon(profile.transport);
        } else {
            logger.info(`Uitest agent daemon already listens on ${selectedEndpoint}.`);
        }

        logger.info(
            `Using device agent.so version=${activeAgentVersion ?? 'unknown'}, ` +
            `architecture=${profile.architecture}, transport=${profile.transport}, endpoint=${selectedEndpoint}.`
        );

        this.deviceEndpoint = selectedEndpoint;
        this.rpc = new HypiumRpc(this.hdc, this.deviceEndpoint);
        await this.rpc.start();
    }

    async stop(): Promise<void> {
        if (this.stopping) return this.stopping;
        const stopping = this.stopInternal();
        this.stopping = stopping;
        try {
            await stopping;
        } finally {
            if (this.stopping === stopping) this.stopping = undefined;
        }
    }

    private async stopInternal(): Promise<void> {
        const rpc = this.rpc;
        this.rpc = undefined;
        await rpc?.close();
    }

    private getDeviceEndpoint(transport: AgentTransport): string {
        return transport === 'unix' ? `localabstract:${UNIX_SOCKET_NAME}` : `tcp:${RPC_PORT}`;
    }

    private isRunning(transport: AgentTransport): boolean {
        const output = transport === 'unix'
            ? this.hdc.excuteShellCommandSync(`cat /proc/net/unix | grep ${UNIX_SOCKET_NAME}`)
            : this.hdc.excuteShellCommandSync(`netstat -atn | grep :${RPC_PORT}`);
        if (transport === 'unix') {
            return output.split(NEWLINE).some((line) => line.includes(UNIX_SOCKET_NAME));
        }
        return output.split(NEWLINE).some((line) =>
            new RegExp(`\\b:${RPC_PORT}\\b.*\\bLISTEN\\b`).test(line)
        );
    }

    private inspectAgent(profile: AgentProfile): { version?: string; reasons: string[] } {
        const agent = this.readAgent(profile);
        if (agent.reasons.length > 0) {
            logger.warn(
                `Replacing device agent.so: current version=${agent.version ?? 'unknown'}, ` +
                `current ELF=${agent.fileInfo || 'missing'}, ` +
                `selected version=${profile.version}/${profile.architecture}; ` +
                `reason=${agent.reasons.join('; ')}.`
            );
        } else {
            logger.info(
                `Existing device agent.so is compatible: version=${agent.version}, ` +
                `ELF=${agent.fileInfo}.`
            );
        }
        return { version: agent.version, reasons: agent.reasons };
    }

    private readAgent(profile: AgentProfile): { version?: string; reasons: string[]; fileInfo: string } {
        if (!this.hdc.hasFile(DEVICE_AGENT_FILE)) {
            return { reasons: ['agent file is missing'], fileInfo: '' };
        }
        const marker = this.hdc.excuteShellCommandSync(
            `grep -a -o 'UITEST_AGENT_LIBRARY@[^[:space:]]*' ${DEVICE_AGENT_FILE}`
        );
        const installedFileInfo = this.hdc.excuteShellCommandSync(`file ${DEVICE_AGENT_FILE}`);
        const { version, reasons } =
            inspectAgentCompatibility(profile, marker, installedFileInfo);
        return { version, reasons, fileInfo: installedFileInfo.trim() };
    }

    private async stopDaemon(): Promise<void> {
        const pids = this.getDaemonPids();
        for (const pid of pids) {
            this.hdc.excuteShellCommandSync('kill', '-9', pid);
        }

        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            const remaining = this.getDaemonPids();
            if (remaining.length === 0) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw new Error(`Timed out waiting for uitest daemon to stop (pid=${pids.join(',') || 'unknown'}).`);
    }

    private getDaemonPids(): string[] {
        const output = this.hdc.excuteShellCommandSync("ps -ef | grep '[u]itest start-daemon singleness'");
        return output.split(NEWLINE).flatMap((line) => {
            if (!line.includes('uitest start-daemon singleness')) {
                return [];
            }
            const match = line.match(/^\s*\S+\s+(\d+)\s+/);
            return match ? [match[1]] : [];
        });
    }

    private async waitForDaemon(transport: AgentTransport): Promise<void> {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
            if (this.isRunning(transport)) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw new Error(`Uitest daemon did not expose the expected ${transport} endpoint within 10 seconds.`);
    }

    private installAgent(profile: AgentProfile): string | undefined {
        const hostAgentFile = path.join(__dirname, '..', '..', '..', 'res/uitest', profile.fileName);
        logger.info(
            `Installing device agent.so version=${profile.version}, architecture=${profile.architecture}, ` +
            `source=${hostAgentFile}, destination=${DEVICE_AGENT_FILE}.`
        );
        this.hdc.excuteShellCommandSync('rm', '-f', DEVICE_AGENT_FILE);
        const status = this.hdc.sendFile(hostAgentFile, DEVICE_AGENT_FILE);
        if (status !== 0 || !this.hdc.hasFile(DEVICE_AGENT_FILE)) {
            throw new Error(`Failed to install uitest agent (${hostAgentFile} -> ${DEVICE_AGENT_FILE}, hdc status=${status}).`);
        }

        const marker = this.hdc.excuteShellCommandSync(
            `grep -a -o 'UITEST_AGENT_LIBRARY@[^[:space:]]*' ${DEVICE_AGENT_FILE}`
        );
        const installedFileInfo = this.hdc.excuteShellCommandSync(`file ${DEVICE_AGENT_FILE}`);
        const { version: installedVersion, reasons } =
            inspectAgentCompatibility(profile, marker, installedFileInfo);
        if (reasons.length > 0) {
            throw new Error(
                `Installed uitest agent verification failed: marker=${marker.trim() || 'unrecognized'}, ` +
                `file=${installedFileInfo.trim() || 'unknown'}, expected=${profile.version}/${profile.architecture}; ` +
                `reason=${reasons.join('; ')}.`
            );
        }
        logger.info(`Installed and verified uitest agent ${installedVersion ?? 'unknown'} (${profile.architecture}).`);
        return installedVersion;
    }
}
