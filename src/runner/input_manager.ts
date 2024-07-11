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
import { InputPolicy } from '../policy/input_policy';
import { PolicyBuilder } from '../policy/policy_builder';
import { EventAction } from './event_action';
import { FuzzOptions } from './fuzz_options';

export class InputManager {
    protected device: Device;
    protected hap: Hap;
    protected options: FuzzOptions;
    protected policy: InputPolicy;
    protected enabled: boolean;

    constructor(device: Device, hap: Hap, options: FuzzOptions) {
        this.device = device;
        this.hap = hap;
        this.options = options;
        this.enabled = true;
        this.policy = PolicyBuilder.buildPolicyByName(device, hap, options);
    }

    start() {
        let state = this.device.getCurrentState();
        while (this.enabled && this.policy.enabled) {
            let event = this.policy.generateEvent(state);
            state = this.addEvent(state, event);
        }
    }

    stop() {
        this.enabled = false;
    }

    protected addEvent(state: DeviceState, event: Event): DeviceState {
        let eventExcute = new EventAction(this.device, this.hap, state, event);
        eventExcute.start();
        // sleep interval
        eventExcute.stop();

        return eventExcute.toState;
    }
}
