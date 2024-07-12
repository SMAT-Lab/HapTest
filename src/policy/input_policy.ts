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
import { Event } from '../event/event';
import { DeviceState } from '../model/device_state';
import { Hap } from '../model/hap';

export enum PolicyFlag {
    FLAG_INIT = 0,
    FLAG_START_APP = 1,
    FLAG_STOP_APP = 1 << 2,
    FLAG_STARTED = 1 << 3
}

export abstract class InputPolicy {
    protected device: Device;
    protected hap: Hap;
    protected _enabled: boolean;
    protected flag: number;

    constructor(device: Device, hap: Hap) {
        this.device = device;
        this.hap = hap;
        this._enabled = true;
        this.flag = PolicyFlag.FLAG_INIT;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    stop() {
        this._enabled = false;
    }

    abstract generateEvent(deviceState: DeviceState): Event;
}
