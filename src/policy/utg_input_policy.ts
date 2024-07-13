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
import { Hap, HapRunningState } from '../model/hap';
import { InputPolicy, PolicyName } from './input_policy';
import { UTG } from './utg';

export abstract class UTGInputPolicy extends InputPolicy {
    protected randomInput: boolean;
    protected lastEvent: Event;
    protected lastState: DeviceState;
    protected currentState: DeviceState;
    protected utg: UTG;
    protected hapRunningState: HapRunningState | undefined;

    constructor(device: Device, hap: Hap, name: PolicyName, randomInput: boolean) {
        super(device, hap, name);
        this.randomInput = randomInput;
        this.utg = new UTG(device, hap, randomInput);
    }

    generateEvent(deviceState: DeviceState): Event {
        this.currentState = deviceState;
        this.updateUtg();
        this.updateRuningState();

        // todo: script event
        let event = this.generateEventBasedOnUtg();
        this.lastState = this.currentState;
        this.lastEvent = event;
        return event;
    }

    private updateUtg(): void {
        if (this.lastEvent && this.lastState && this.currentState) {
            this.utg.addTransition(this.lastEvent, this.lastState, this.currentState);
        }
    }

    private updateRuningState(): void {
        if (this.currentState.page.getBundleName() == this.hap.bundleName) {
            this.hapRunningState = HapRunningState.FOREGROUND;
        } else {
            this.hapRunningState = this.device.getHapRunningState(this.hap);
        }
    }

    abstract generateEventBasedOnUtg(): Event;
}
