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
import { AbilityEvent, ExitEvent, StopHapEvent } from './system_event';
import { FlingEvent, InputTextEvent, LongTouchEvent, ScrollEvent, SwipeEvent, TouchEvent, UIEvent, DragEvent } from './ui_event';
import { Point } from '../model/point';
import { SerializeUtils } from '../utils/serialize_utils';
import { Gesture, GestureEvent } from './gesture';

export class EventBuilder {
    static createEventFromJson(json: any): Event {
        if (json.type === 'ManualEvent') {
            return EventBuilder.createEventFromJson(json.event);
        }
        if (json.type === 'KeyEvent') {
            return new KeyEvent(json.keyCode);
        }

        if (json.type === 'CombinedKeyEvent') {
            return new CombinedKeyEvent(json.keyCode, json.keyCode1, json.keyCode2);
        }

        if (json.type === 'AbilityEvent') {
            return new AbilityEvent(json.bundleName, json.abilityName);
        }

        if (json.type === 'StopHapEvent') {
            return new StopHapEvent(json.bundleName);
        }

        if (json.type === 'GestureEvent') {
            let gestures: Gesture[] = [];
            for (const gestureJson of json.gestures) {
                gestures.push(SerializeUtils.plainToInstance(Gesture, gestureJson));
            }

            return new GestureEvent(gestures, json.speed);
        }

        let component;
        if (json.component) {
            component = SerializeUtils.plainToInstance(Component, json.component);
        }
        let point: Point = json.point;
        if (json.type === 'TouchEvent') {
            if (component) return new TouchEvent(component);
            return new TouchEvent(point);
        }

        if (json.type === 'LongTouchEvent') {
            if (component) return new LongTouchEvent(component);
            return new LongTouchEvent(point);
        }
        if (json.type === 'ScrollEvent') {
            if (component) return new ScrollEvent(component, json.direct, json.step, json.speed);
            return new ScrollEvent(point, json.direct, json.step, json.speed);
        }

        if (json.type === 'InputTextEvent') {
            if (component) return new InputTextEvent(component, json.text);
            return new InputTextEvent(point, json.text);
        }

        if (json.type === 'SwipeEvent') {
            return SerializeUtils.plainToInstance(SwipeEvent, json);
        }

        if (json.type === 'FlingEvent') {
            return SerializeUtils.plainToInstance(FlingEvent, json);
        }

        if (json.type === 'DragEvent') {
            return SerializeUtils.plainToInstance(DragEvent, json);
        }

        if (json.type === 'ExitEvent') {
            return new ExitEvent();
        }

        throw new Error('not support');
    }
    static createPossibleUIEvents(components: Component[]): UIEvent[] {
        let events: UIEvent[] = [];
        for (const component of components) {
            if (component.hasUIEvent()) {
                events.push(...EventBuilder.createComponentPossibleUIEvents(component));
            }
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
        const textLen = [1, 8, 32, 128];
        for (const len of textLen) {
            this.randomText.push(RandomUtils.genRandomString(len));
        }
    }

    static createEventFromNode(node: any): Event |undefined{
        let eventType = node.call_back_method;
        console.info(`解析事件类型: ${eventType}`);
        console.info(`解析节点: ${JSON.stringify(node)}`);
        let component = SerializeUtils.deserialize(Component, node);
        console.info(`解析组件: ${JSON.stringify(component)}`);
        if(eventType.includes("onClick")){
            eventType = "onClick";  
            console.info(`标准化事件类型为: ${eventType}`);
        } else if(eventType.includes("onTouch")){
            eventType = "onTouch";
        }
        switch (eventType) {
            case 'onClick': 
            case 'onTouch':  
                console.info(`组件 bounds: ${JSON.stringify(component.bounds)}, type: ${typeof component.bounds}`);
                let point = component.getCenterPoint();
                console.info(`生成 TouchEvent，坐标: (${point.x}, ${point.y})`);
                return new TouchEvent(point);
            default:
                // throw new Error(`Unsupported event type: ${eventType}`);
                return undefined;
        }
    }
}
