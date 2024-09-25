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

import { Event } from './event';
import { KeyCode } from '../model/key_code';
import { EventSimulator } from '../device/event_simulator';
import { Expose } from 'class-transformer';

export class KeyEvent extends Event {
    @Expose()
    protected keyCode: KeyCode;

    constructor(keyCode: KeyCode) {
        super('KeyEvent');
        this.keyCode = keyCode;
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.inputKey(this.keyCode, undefined, undefined);
    }
}

export class CombinedKeyEvent extends KeyEvent {
    @Expose()
    protected keyCode1: KeyCode;
    @Expose()
    protected keyCode2: KeyCode | undefined;

    constructor(code0: KeyCode, code1: KeyCode, code2: KeyCode | undefined = undefined) {
        super(code0);
        this.type = 'CombinedKeyEvent';
        this.keyCode1 = code1;
        this.keyCode2 = code2;
    }

    async send(simulator: EventSimulator): Promise<void>  {
        if (this.keyCode2 == undefined) {
            await simulator.inputKey(this.keyCode, this.keyCode1, undefined);
        } else {
            await simulator.inputKey(this.keyCode, this.keyCode1, this.keyCode2);
        }
    }
}

export const BACK_KEY_EVENT = new KeyEvent(KeyCode.KEYCODE_BACK);
export const HOME_KEY_EVENT = new KeyEvent(KeyCode.KEYCODE_HOME);
