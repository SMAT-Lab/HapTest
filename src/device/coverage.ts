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

import { Hap } from "../model/hap";
import { Device } from "./device";

/**
 * cov file save at data/app/el2/100/base/{bundleName}/haps/{moduleName}/cache/black_test_result_xxx.json
 * https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-device-file-explorer-0000001558037338-V5#section675334122615
 */
export class Coverage {
    bftpPort: number;
    hap: Hap;
    private device: Device;

    constructor(device: Device, hap: Hap) {
        this.device = device;
        this.hap = hap;
    }

    startBftp(): void {
        this.bftpPort = this.device.getHdc().startBftp(this.hap);
        this.device.getHdc().mkLocalCovDir();
    }

    getCoverageFile() {
        let files = this.device.getHdc().listSandboxFile(this.bftpPort, `haps/${this.hap.entryModuleName}/cache`);
        for (let [file, isDir] of files) {
            if (!isDir && file.startsWith('black_test_result_') && file.endsWith('.json')) {
                this.device.getHdc().mvSandboxFile2Local(
                    this.bftpPort,
                    `/data/local/tmp/cov/${file}`,
                    `haps/${this.hap.entryModuleName}/cache/${file}`
                );
            }
        }

        this.device.getHdc().recvFile(`/data/local/tmp/cov`, this.device.getOutput());
    }
}