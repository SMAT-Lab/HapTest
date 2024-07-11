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
import { HapBuilder } from '../model/builder/hap_builder';
import { Hap } from '../model/hap';
import { FuzzOptions } from './fuzz_options';
import { InputManager } from './input_manager';

/**
 * Fuzz test entrance
 */
export class Fuzz {
    options: FuzzOptions;
    device: Device;
    hap: Hap;
    inputManager: InputManager;

    constructor(options: FuzzOptions) {
        this.options = options;
        this.device = new Device(this.options.connectkey, this.options.output);
        this.hap = HapBuilder.buildHap(this.device, this.options.hap);
        this.inputManager = new InputManager(this.device, this.hap, this.options);
    }

    async start() {
        // install hap
        this.device.installHap(this.hap);
        await this.inputManager.start();
    }
}
