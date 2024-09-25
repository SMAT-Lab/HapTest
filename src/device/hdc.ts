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

import { spawnSync, SpawnSyncReturns } from 'child_process';
import path from 'path';
import { Page } from '../model/page';
import { PageBuilder } from '../model/builder/page_builder';
import { convertStr2RunningState, Hap, HapRunningState } from '../model/hap';
import { HdcCmdError } from '../error/error';
import { getLogger } from 'log4js';

const logger = getLogger();

export const NEWLINE = /\r\n|\n/;

export class Hdc {
    private connectkey: string | undefined;

    constructor(connectkey: string | undefined = undefined) {
        this.connectkey = connectkey;
    }

    sendFile(local: string, remote: string): number {
        let output = this.excute('file', 'send', local, remote);
        if (!output.status) {
            return 0;
        }
        return output.status;
    }

    recvFile(remote: string, local: string): number {
        let output = this.excute('file', 'recv', remote, local);
        if (!output.status) {
            return 0;
        }
        return output.status;
    }

    hasFile(remote: string): boolean {
        let output = this.excuteShellCommand(`ls ${remote}`);
        return output.indexOf('No such file') == 0;
    }

    dumpViewTree(temp: string): Page[] {
        let output = this.excuteShellCommand('uitest', 'dumpLayout');
        let matches = output.match(/DumpLayout saved to:([a-zA-Z/0-9_]*.json)/);
        if (matches) {
            let layoutJson = matches[1];
            let localFile = path.join(temp, path.basename(layoutJson));
            logger.debug('dumpLayout save to: ', localFile);
            this.recvFile(layoutJson, localFile);

            return PageBuilder.buildPagesFromDumpLayoutFile(localFile);
        }
        return [];
    }

    getAllBundleNames(): string[] {
        let bundles: string[] = [];
        let output = this.excuteShellCommand('bm dump -a');
        let matches = output.match(/\t[\S]+/g);
        if (matches) {
            for (let bundle of matches) {
                bundles.push(bundle.substring(1));
            }
        }
        return bundles;
    }

    getBundleInfo(bundleName: string): any | undefined {
        let output = this.excuteShellCommand('bm dump -n', bundleName);
        if (output.length == 0) {
            return;
        }
        let lines = output.split(NEWLINE);
        try {
            let info = JSON.parse(lines.slice(1).join('\n'));
            return info;
        } catch (err) {
            return undefined;
        }
    }

    fportLs(): Set<string[]> {
        let fports = new Set<string[]>();
        let output = this.excute('fport', 'ls').stdout;
        for (let line of output.split(NEWLINE)) {
            let matches = line.match(/[\S]+/g);
            if (matches && matches.length == 4) {
                fports.add([matches[0], matches[1], matches[2], matches[3]]);
            }
        }
        return fports;
    }

    fportRm(localNode: string, remoteNode: string): void {
        this.excute('fport', 'rm', localNode, remoteNode);
    }

    fport(localNode: string, remoteNode: string): void {
        this.excute('fport', localNode, remoteNode);
    }

    pidof(bundleName: string): number {
        let output = this.excuteShellCommand('pidof', bundleName);
        let lines = output.split(NEWLINE);
        return Number(lines[0]);
    }

    getDeviceUdid(): string {
        let output = this.excuteShellCommand('bm get -u');
        let lines = output.split(NEWLINE);
        return lines[1];
    }

    getDeviceType(): string {
        let output = this.excuteShellCommand('param get const.product.devicetype');
        return output.trim();
    }

    startAblity(bundleName: string, abilityName: string): boolean {
        this.excuteShellCommand(...['aa', 'start', '-b', bundleName, '-a', abilityName]);
        return true;
    }

    forceStop(bundleName: string) {
        this.excuteShellCommand(...['aa', 'force-stop', bundleName]);
    }

    capScreen(localPath: string): string {
        const outPrefix = 'ScreenCap saved to ';
        let output = this.excuteShellCommand(...['uitest', 'screenCap']);
        if (!output.startsWith(outPrefix)) {
            logger.error(`Hdc->capScreen parse shell output fail. ${output}`);
            throw new HdcCmdError(`ScreenCap fail. ${output}`);
        }
        let remote = output.substring(outPrefix.length).trim();
        let localFile = path.join(localPath, path.basename(remote));
        this.recvFile(remote, localFile);
        return localFile;
    }

    wakeupScreen(): void {
        this.excuteShellCommand(...['power-shell', 'wakeup']);
    }

    installHap(hap: string): void {
        this.excute(...['install', '-r', hap]);
    }

    getRunningProcess(): Map<string, HapRunningState> {
        let process: Map<string, HapRunningState> = new Map();
        let output = this.excuteShellCommand(...['aa', 'dump', '-a']);
        let bundleName = '';
        for (let line of output.split(NEWLINE)) {
            let matches = line.match(/process name \[([a-zA-Z.0-9:]+)\]/);
            if (matches) {
                bundleName = matches[1].split(':')[0];
            }
            matches = line.match(/state #([A-Z]+)/);
            if (matches && bundleName.length > 0) {
                process.set(bundleName, convertStr2RunningState(matches[1]));
            }
        }
        return process;
    }

    aaDumpMission(): void {
        this.excuteShellCommand(...['aa', 'dump', '-c', '-l']);
    }

    mkLocalCovDir(): void {
        this.excuteShellCommand(...['mkdir', '-p', '/data/local/tmp/cov']);
    }

    rmLocalCovDir(): void {
        this.excuteShellCommand(...['rm', '-r', '/data/local/tmp/cov']);
    }

    netstatInfo(): Map<number, { pid: number; program: string }> {
        let info: Map<number, { pid: number; program: string }> = new Map();
        let output = this.excuteShellCommand(...['netstat', '-antulp']);
        for (let line of output.split(NEWLINE)) {
            if (line.startsWith('tcp') || line.startsWith('udp')) {
                let matches = line.match(/[\S]+/g);
                if (matches?.length == 7) {
                    info.set(Number(matches[3].split(':')[1]), {
                        pid: Number(matches[6].split('/')[0]),
                        program: matches[6].split('/')[1],
                    });
                }
            }
        }

        return info;
    }

    startBftp(hap: Hap): { pid: number; port: number } {
        let netstatInfo = this.netstatInfo();
        let port: number;
        for (port = 10000; port < 65535; port++) {
            if (!netstatInfo.has(port)) {
                break;
            }
        }
        this.excuteShellCommand(
            ...[
                'aa',
                'process',
                '-b',
                hap.bundleName,
                '-a',
                hap.mainAbility,
                '-p',
                `"/system/bin/bftpd -D -p ${port}"`,
                '-S',
            ]
        );
        netstatInfo = this.netstatInfo();
        if (netstatInfo.has(port)) {
            return { port: port, pid: netstatInfo.get(port)!.pid };
        }
        throw new HdcCmdError(`start Bftp fail ${port}.`);
    }

    stopBftp(hap: Hap, pid: number): void {
        this.excuteShellCommand(
            ...['aa', 'process', '-b', hap.bundleName, '-a', hap.mainAbility, '-p', `"kill -9 ${pid}"`]
        );
    }

    listSandboxFile(port: number, direct: string): [string, boolean][] {
        let files: [string, boolean][] = [];
        let output = this.excuteShellCommand(
            ...[
                'ftpget',
                '-p',
                `${port}`,
                '-P',
                'guest',
                '-u',
                'anonymous',
                'localhost',
                '-l',
                `/data/storage/el2/base/${direct}`,
            ]
        );
        for (let line of output.split(NEWLINE)) {
            let matches = line.match(/[\S]+/g);
            if (matches?.length == 9) {
                files.push([matches[8], matches[0].startsWith('d')]);
            }
        }

        return files;
    }

    mvSandboxFile2Local(port: number, local: string, sandboxFile: string) {
        let ftpCmd = ['ftpget', '-p', `${port}`, '-P', 'guest', '-u', 'anonymous', 'localhost'];
        let ftpGetCmd = [...ftpCmd, '-g', local, `/data/storage/el2/base/${sandboxFile}`];
        let ftpRmCmd = [...ftpCmd, '-d', `/data/storage/el2/base/${sandboxFile}`];

        this.excuteShellCommand(...ftpGetCmd);
        this.excuteShellCommand(...ftpRmCmd);
    }

    kill(name: string): void {
        let output = this.excuteShellCommand('ps -A');
        for (let line of output.split(NEWLINE)) {
            let matches = line.match(/[\S]+/g);
            if (matches?.length == 4 && matches[3] == name) {
                this.excuteShellCommand(...['kill', '-9', matches[0]]);
            }
        }
    }

    uiInputCommand(...args: string[]): string {
        return this.excuteShellCommand('uitest', 'uiInput', ...args);
    }

    excuteShellCommand(...args: string[]): string {
        return this.excute('shell', ...args).stdout;
    }

    excute(command: string, ...params: string[]): SpawnSyncReturns<string> {
        let args: string[] = [];
        if (this.connectkey) {
            args.push(...['-t', this.connectkey]);
        }
        args.push(...[command, ...params]);
        logger.debug(`hdc excute: ${JSON.stringify(args)}`);
        let result = spawnSync('hdc', args, { encoding: 'utf-8', shell: true });
        logger.debug(`hdc result: ${JSON.stringify(result)}`);
        if (result.stdout.trim() == '[Fail]ExecuteCommand need connect-key? please confirm a device by help info') {
            throw new Error(`hdc ${result.stdout}`);
        }
        return result;
    }
}
