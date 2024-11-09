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
import { AbilityEvent } from '../event/system_event';
import { Event } from '../event/event';
import { ManualEvent } from '../event/manual_event';
import { Hap } from '../model/hap';
import { Policy, PolicyName } from './policy';
import { Page } from '../model/page';
import { UIRecord } from '../device/ui_record';

export class ManualPolicy extends Policy {
    private firstEvent: boolean;
    private uiRecord: UIRecord;

    constructor(device: Device, hap: Hap, name: PolicyName) {
        super(device, hap, name);
        this.firstEvent = true;
        this.uiRecord = new UIRecord(device.getHdc());
    }
    
    async generateEvent(page: Page): Promise<Event> {
        if (this.firstEvent) {
            this.firstEvent = false;
            return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
        }

        let event = await this.uiRecord.recordOnceEvent();
        return new ManualEvent(event);
    }
}
