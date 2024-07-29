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
import { Event } from './event';
import { CombinedKeyEvent, KeyEvent } from './key_event';
import { ManualEvent } from './manual_event';
import { AbilityEvent, ExitEvent, StopHapEvent } from './system_event';
import { InputTextEvent, LongTouchEvent, ScrollEvent, SwipeEvent, TouchEvent, UIEvent } from './ui_event';
import { Point } from '../../lib/model/point';
import { SerializeUtils } from '../utils/serialize_utils';

export class EventBuilder {
    static createEventFromJson(json: any): Event {
        if (json.type == 'KeyEvent') {
            return new KeyEvent(json.keyCode);
        }

        if (json.type == 'CombinedKeyEvent') {
            return new CombinedKeyEvent(json.keyCode, json.keyCode1, json.keyCode2);
        }

        if (json.type == 'ManualEvent') {
            return new ManualEvent();
        }

        if (json.type == 'AbilityEvent') {
            return new AbilityEvent(json.bundleName, json.abilityName);
        }

        if (json.type == 'StopHapEvent') {
            return new StopHapEvent(json.bundleName);
        }

        let component;
        if (json.component) {
            component = SerializeUtils.plainToInstance(Component, json.component);
        }
        let point: Point = json.point;
        if (json.type == 'TouchEvent') {
            if (component) return new TouchEvent(component);
            return new TouchEvent(point);
        }

        if (json.type == 'LongTouchEvent') {
            if (component) return new LongTouchEvent(component);
            return new LongTouchEvent(point);
        }
        if (json.type == 'ScrollEvent') {
            if (component) return new ScrollEvent(component, json.direct, json.velocity, json.step);
            return new ScrollEvent(point, json.direct, json.velocity, json.step);
        }

        if (json.type == 'InputTextEvent') {
            if (component) return new InputTextEvent(component, json.text);
            return new InputTextEvent(point, json.text);
        }

        if (json.type == 'SwipeEvent') {
            if (component) return new SwipeEvent(component, json.toPoint, json.velocity);
            return new SwipeEvent(point, json.toPoint, json.velocity);
        }

        if (json.type == 'ExitEvent') {
            return new ExitEvent();
        }

        throw new Error('not support');
    }
    static createPossibleUIEvents(components: Component[]): UIEvent[] {
        let events: UIEvent[] = [];
        for (const component of components) {
            events.push(...EventBuilder.createComponentPossibleUIEvents(component));
        }
        return events;
    }

    static createComponentPossibleUIEvents(component: Component): UIEvent[] {
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

        if (component.inputable) {
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
