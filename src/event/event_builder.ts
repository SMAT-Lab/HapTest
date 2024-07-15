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
import { Direct } from '../device/event_simulator';
import { Component } from '../model/component';
import { RandomUtils } from '../utils/random_utils';
import { InputTextEvent, LongTouchEvent, ScrollEvent, TouchEvent, UIEvent } from './ui_event';

const TEXT_INPUTABLE_TYPE: Set<string> = new Set(['TextInput', 'TextArea', 'SearchField']);

export class EventBuilder {
    static createPossibleUIEvents(component: Component): UIEvent[] {
        let events: UIEvent[] = [];
        if (!component.enabled) {
            return events;
        }

        if (component.checkable || component.clickable) {
            events.push(new TouchEvent(component));
        }

        if (component.longClickable) {
            events.push(new LongTouchEvent(component));
        }

        if (component.scrollable) {
            events.push(new ScrollEvent(component, Direct.DOWN));
            events.push(new ScrollEvent(component, Direct.UP));
            events.push(new ScrollEvent(component, Direct.LEFT));
            events.push(new ScrollEvent(component, Direct.RIGHT));
        }

        if (TEXT_INPUTABLE_TYPE.has(component.type)) {
            for (const text of this.randomText) {
                events.push(new InputTextEvent(component, text));
            }
        }

        return events;
    }

    static createRandomTouchEvent(device: Device): TouchEvent {
        return new TouchEvent({
            x: RandomUtils.genRandomNum(0, device.getWidth()),
            y: RandomUtils.genRandomNum(0, device.getHeight()),
        });
    }

    static randomText: string[] = [];
    static {
        const textLen = [1, 32, 128, 512];
        for (const len of textLen) {
            this.randomText.push(RandomUtils.genRandomString(len));
        }
    }
}
