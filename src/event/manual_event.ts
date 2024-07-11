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

import { Expose } from 'class-transformer';
import { EventSimulator } from '../device/event_simulator';
import { DeviceState } from '../model/device_state';
import { Event } from './event';
import { CryptoUtils } from '../utils/crypto_utils';

export class ManualEvent extends Event {
    @Expose()
    protected time: number;

    constructor() {
        super('ManualEvent');
        this.time = new Date().getTime();
    }

    send(simulator: EventSimulator): void {}

    eventStateSig(state: DeviceState): string {
        return CryptoUtils.sha256(this.toString());
    }
}
