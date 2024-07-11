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

import { UTGInputPolicy } from './utg_input_policy';
import { Device } from '../device/device';
import { Hap } from '../model/hap';
import { Event } from '../event/event';
import { ExitEvent } from '../event/system_event';

export class UtgGreedySearchPolicy extends UTGInputPolicy {
    constructor(device: Device, hap: Hap) {
        super(device, hap, true);
    }

    generateEventBasedOnUtg(): Event {
        return new ExitEvent();
    }
}