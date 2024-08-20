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
import { BACK_KEY_EVENT } from '../event/key_event';
import { AbilityEvent, StopHapEvent } from '../event/system_event';
import { Hap } from '../model/hap';
import { Page } from '../model/page';
import { InputPolicy, PolicyFlag, PolicyName } from './input_policy';
import { SceneDetect } from './scene_detect';
import { UTG } from './utg';

export const MAX_NUM_RESTARTS = 5;
export abstract class UTGInputPolicy extends InputPolicy {
    protected retryCount: number;
    protected randomInput: boolean;
    protected lastEvent: Event;
    protected lastPage: Page;
    protected currentPage: Page;
    protected utg: UTG;
    protected sceneDetect: SceneDetect;

    constructor(device: Device, hap: Hap, name: PolicyName, randomInput: boolean) {
        super(device, hap, name);
        this.randomInput = randomInput;
        this.utg = new UTG(hap, randomInput);
        this.sceneDetect = new SceneDetect();
    }

    generateEvent(page: Page): Event {
        this.currentPage = page;
        this.updateUtg();

        if (this.flag == PolicyFlag.FLAG_INIT) {
            if (!this.currentPage.isStop()) {
                this.flag |= PolicyFlag.FLAG_STOP_APP;
                return new StopHapEvent(this.hap.bundleName);
            }
        }

        if (this.currentPage.isStop()) {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                this.logger.error(`The number of HAP launch attempts exceeds ${MAX_NUM_RESTARTS}`);
                throw new Error('The HAP cannot be started.');
            }
            this.retryCount++;
            this.flag |= PolicyFlag.FLAG_START_APP;
            return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
        } else if (this.currentPage.isForeground()) {
            this.flag = PolicyFlag.FLAG_STARTED;
        } else {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                this.flag |= PolicyFlag.FLAG_STOP_APP;
                this.retryCount = 0;
                return new StopHapEvent(this.hap.bundleName);
            }
            this.retryCount++;
            return BACK_KEY_EVENT;
        }

        let event = this.sceneDetect.generateEventBasedOnModel(page);
        if (!event) {
            event = this.generateEventBasedOnUtg();
        }
        this.lastPage = this.currentPage;
        this.lastEvent = event;
        return event;
    }

    private updateUtg(): void {
        if (this.lastEvent && this.lastPage && this.currentPage) {
            this.utg.addTransition(this.lastEvent, this.lastPage, this.currentPage);
            // transition to StopState
            this.utg.addTransitionToStop(this.currentPage);
            this.utg.dumpSvg(this.device.getOutput(), 'http://localhost:3001');
        }
    }

    abstract generateEventBasedOnUtg(): Event;
}
