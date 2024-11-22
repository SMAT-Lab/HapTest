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

import { Device } from '../device/device';
import { GlobMatch } from '../utils/glob_match';
import { FuzzOptions } from './fuzz_options';
import { RunnerManager } from './runner_manager';

/**
 * Fuzz test entrance
 */
export class Fuzz {
    options: FuzzOptions;
    device: Device;

    constructor(options: FuzzOptions) {
        this.options = options;
        this.device = new Device(this.options);        
    }

    async start() {
        if (this.options.bundleName !== 'ALL') {
            await this.startOneBundle(this.options.bundleName);
            return;
        }
        
        let bundles = this.device.getAllBundleNames();
        let matcher = this.options.excludes ? new GlobMatch(this.options.excludes): undefined;
        for (const bundleName of bundles) {
            if (matcher?.match(bundleName)) {
                continue;
            }

            await this.startOneBundle(bundleName);
        }
    }

    async startOneBundle(bundleName?: string): Promise<void> {
        let hap = this.device.buildHap(this.options.sourceRoot, this.options.hapFile, bundleName);
        let manager = new RunnerManager(this.device, hap, this.options);
        await this.device.connect(hap);
        await manager.start();
    }
}
