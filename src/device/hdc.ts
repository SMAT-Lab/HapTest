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
import * as os from 'os';
import { Page } from '../model/page';
import { Point } from '../model/point';
import { PageBuilder } from '../model/builder/page_builder';
import { Direct } from './event_simulator';
import Logger from '../utils/logger';
import { convertStr2RunningState, HapRunningState } from '../model/hap';
const logger = Logger.getLogger();

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

    dumpViewTree(): Page[] {
        let output = this.excuteShellCommand('uitest', 'dumpLayout');
        let matches = output.match(/DumpLayout saved to:([a-zA-Z/0-9_]*.json)/);
        if (matches) {
            let layoutJson = matches[1];
            let localFile = path.join(os.tmpdir(), path.basename(layoutJson));
            logger.info('dumpLayout save to: ', localFile);
            this.recvFile(layoutJson, localFile);

            return PageBuilder.buildPagesFromDumpLayoutFile(localFile);
        }
        return [];
    }

    click(point: Point): string {
        return this.uiInputCommand(...['click', String(point.x), String(point.y)]);
    }

    doubleClick(point: Point): string {
        return this.uiInputCommand(...['doubleClick', String(point.x), String(point.y)]);
    }

    longClick(point: Point): string {
        return this.uiInputCommand(...['longClick', String(point.x), String(point.y)]);
    }

    inputText(point: Point, text: string): string {
        return this.uiInputCommand(...['inputText', String(point.x), String(point.y), `'${text}'`]);
    }

    fling(from: Point, to: Point, velocity: number = 600, step: number = 50): string {
        return this.uiInputCommand(
            ...['fling', String(from.x), String(from.y), String(to.x), String(to.y), String(velocity), String(step)]
        );
    }

    directFling(direct: Direct = Direct.LEFT, velocity: number = 600, step: number = 50): string {
        return this.uiInputCommand(...['dircFling', String(direct), String(velocity), String(step)]);
    }

    swipe(from: Point, to: Point, velocity: number = 600): string {
        return this.uiInputCommand(
            ...['swipe', String(from.x), String(from.y), String(to.x), String(to.y), String(velocity)]
        );
    }

    drag(from: Point, to: Point, velocity: number = 600): string {
        return this.uiInputCommand(
            ...['drag', String(from.x), String(from.y), String(to.x), String(to.y), String(velocity)]
        );
    }

    inputKey(key0: number, key1: number | undefined = undefined, key2: number | undefined = undefined) {
        if (key1 && key2) {
            this.uiInputCommand('keyEvent', String(key0), String(key1), String(key2));
            return;
        }
        if (key1) {
            this.uiInputCommand('keyEvent', String(key0), String(key1));
            return;
        }
        this.uiInputCommand('keyEvent', String(key0));
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
        let lines = output.split('\r\n');
        try {
            let info = JSON.parse(lines.slice(1).join('\r\n'));
            return info;
        } catch (err) {
            return undefined;
        }
    }

    collectFaultLogger(): Set<string> {
        let logs: Set<string> = new Set();
        let output = this.excuteShellCommand('ls /data/log/faultlog/ -hlR');
        let curDir = '/data/log/faultl';
        for (let line of output.split('\r\n')) {
            if (line.startsWith('/data/log/faultlog/') && line.endsWith(':')) {
                curDir = line.substring(0, line.length - 1);
                continue;
            }

            let matches = line.match(/[\S]+/g);
            if (matches && matches.length == 8) {
                if (matches[0].startsWith('-')) {
                    logs.add(`${curDir}/${matches[7]}`);
                }
            }
        }
        return logs;
    }

    getDeviceUdid(): string {
        let output = this.excuteShellCommand('bm get -u');
        let lines = output.split('\r\n');
        return lines[1];
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
            throw new Error(`ScreenCap fail. ${output}`);
        }
        let remote = output.substring(outPrefix.length).trim();
        let localFile = path.join(localPath, path.basename(remote));
        this.recvFile(remote, localFile);
        return localFile;
    }

    getScreenSize(): Point {
        let output = this.excuteShellCommand(...['hidumper', '-s', '10', '-a', 'screen']);
        let matches = output.match(/render size: ([0-9]+)x([0-9]+),/);
        if (matches) {
            return { x: Number(matches[1]), y: Number(matches[2]) };
        }
        return { x: 0, y: 0 };
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
        for (let line of output.split('\r\n')) {
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
        logger.info(`hdc excute: ${JSON.stringify(args)}`);
        let result = spawnSync('hdc', args, { encoding: 'utf-8', shell: true });
        logger.debug(`hdc result: ${JSON.stringify(result)}`);
        return result;
    }
}
