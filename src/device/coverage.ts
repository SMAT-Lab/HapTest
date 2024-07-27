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
import fs from 'fs';
import { HOME_KEY_EVENT } from '../event/key_event';
import { Hap } from '../model/hap';
import { Device } from './device';
import { CoverageReport, Report } from 'bjc';

/**
 * cov file save at data/app/el2/100/base/{bundleName}/haps/{moduleName}/cache/black_test_result_xxx.json
 * https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-device-file-explorer-0000001558037338-V5#section675334122615
 */
export class Coverage {
    bftpPort: number;
    bftpPid: number;
    hap: Hap;
    last: CoverageReport;
    private device: Device;

    constructor(device: Device, hap: Hap) {
        this.device = device;
        this.hap = hap;
    }

    startBftp(): void {
        let bftpd = this.device.getHdc().startBftp(this.hap);
        this.bftpPort = bftpd.port;
        this.bftpPid = bftpd.pid;
        this.device.getHdc().mkLocalCovDir();
    }

    stopBftp(): void {
        this.device.getHdc().stopBftp(this.hap, this.bftpPid);
    }

    getCoverageFile(onForeground: boolean): CoverageReport {
        // trigger UIAbility::onNewWant to save cov.
        let current: Set<string> = new Set();
        if (onForeground) {
            this.device.sendEvent(HOME_KEY_EVENT);
            this.device.startAblity(this.hap.bundleName, this.hap.mainAbility);
        }
        let files = this.device.getHdc().listSandboxFile(this.bftpPort, `haps/${this.hap.entryModuleName}/cache`);
        for (let [file, isDir] of files) {
            if (!isDir && file.startsWith('bjc_cov_') && file.endsWith('.json') && !current.has(file)) {
                current.add(file);
                this.device
                    .getHdc()
                    .mvSandboxFile2Local(
                        this.bftpPort,
                        `/data/local/tmp/cov/${file}`,
                        `haps/${this.hap.entryModuleName}/cache/${file}`
                    );
            }
        }

        this.device.getHdc().recvFile(`/data/local/tmp/cov`, this.device.getOutput());
        
        let covFiles = Array.from(current);
        covFiles.sort();

        if (covFiles.length == 0) {
            return this.last;
        }

        let cov = path.join(this.device.getOutput(), 'cov', covFiles[covFiles.length - 1]);
        if (fs.existsSync(cov)) {
            this.last = this.parseCovFile(cov);
        }

        return this.last;
    }

    parseCovFile(cov: string): CoverageReport {
        let report = new Report(cov);
        return report.generateReport();
    }
}
