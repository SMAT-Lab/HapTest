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

import { Component } from '../model/component';
import { Point } from '../model/point';
import { Event } from './event';
import { Direct, EventSimulator } from '../device/event_simulator';
import { Expose } from 'class-transformer';
import { KeyCode } from '../model/key_code';

export abstract class UIEvent extends Event {
    @Expose()
    protected component: Component | undefined;
    @Expose()
    protected point: Point;

    constructor(type: string, componentOrPoint: Component | Point) {
        super(type);
        if (componentOrPoint instanceof Component) {
            this.component = componentOrPoint;
            this.point = componentOrPoint.getCenterPoint();
            this.rank = componentOrPoint.rank;
        } else {
            this.point = componentOrPoint;
        }
    }

    getEventType(): string {
        return this.type;
    }

    setComponent(component: Component) {
        this.component = component;
    }

    getComponet(): Component | undefined {
        return this.component;
    }

    getComponentId(): string | undefined {
        if (this.component) {
            return this.component.uniqueId;
        }
        return undefined;
    }

}

export class TouchEvent extends UIEvent {
    constructor(componentOrPoint: Component | Point) {
        super('TouchEvent', componentOrPoint);
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.click(this.point);
    }
}

export class LongTouchEvent extends UIEvent {
    constructor(componentOrPoint: Component | Point) {
        super('LongTouchEvent', componentOrPoint);
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.longClick(this.point);
    }
}

export class DoubleClickEvent extends UIEvent {
    constructor(componentOrPoint: Component | Point) {
        super('DoubleClickEvent', componentOrPoint);
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.doubleClick(this.point);
    }
}

export class ScrollEvent extends UIEvent {
    @Expose()
    protected speed: number;
    @Expose()
    protected step: number;
    @Expose()
    protected direct: Direct;

    constructor(componentOrPoint: Component | Point, direct: Direct, step: number = 60, speed: number = 40000) {
        super('ScrollEvent', componentOrPoint);
        this.speed = speed;
        this.direct = direct;
        this.step = step;
    }

    async send(simulator: EventSimulator): Promise<void> {
        let from: Point = { x: this.point.x, y: this.point.y };
        let to: Point = { x: this.point.x, y: this.point.y };

        let height = this.component ? this.component.getHeight() : simulator.getHeight();
        let width = this.component ? this.component.getWidth() : simulator.getWidth();

        if (this.direct === Direct.UP) {
            from.y += Math.round((height * 2) / 5);
            to.y -= Math.round((height * 2) / 5);
        } else if (this.direct === Direct.DOWN) {
            from.y -= Math.round((height * 2) / 5);
            to.y += Math.round((height * 2) / 5);
        } else if (this.direct === Direct.LEFT) {
            from.x -= Math.round((width * 2) / 5);
            to.x += Math.round((width * 2) / 5);
        } else if (this.direct === Direct.RIGHT) {
            from.x += Math.round((width * 2) / 5);
            to.x -= Math.round((width * 2) / 5);
        }

        await simulator.fling(from, to, this.step, this.speed);
    }
}

export class InputTextEvent extends UIEvent {
    @Expose()
    protected text: string;

    constructor(componentOrPoint: Component | Point, text: string) {
        super('InputTextEvent', componentOrPoint);
        this.text = text;
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.click(this.point);
        await simulator.inputKey(KeyCode.KEYCODE_CTRL_LEFT, KeyCode.KEYCODE_A);
        await simulator.inputKey(KeyCode.KEYCODE_DEL);
        await simulator.inputText(this.point, this.text);
    }

    getText(): string {
        return this.text;
    }

    setText(text: string): void {
        this.text = text;
    }
}

export class SwipeEvent extends UIEvent {
    @Expose()
    protected toPoint: Point;
    @Expose()
    protected toComponent?: Component;
    @Expose()
    protected speed: number;

    constructor(from: Point | Component, to: Point | Component, speed: number = 600) {
        super('SwipeEvent', from);
        if (to instanceof Component) {
            this.toComponent = to;
            this.toPoint = to.getCenterPoint();
        } else {
            this.toPoint = to;
        }
        this.speed = speed;
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.swipe(this.point, this.toPoint, this.speed);
    }
}

export class FlingEvent extends SwipeEvent {
    @Expose()
    protected step: number;

    constructor(from: Point | Component, to: Point | Component, step: number, speed: number = 600) {
        super(from, to, speed);
        this.step = step;
        this.type = 'FlingEvent';
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.fling(this.point, this.toPoint, this.step, this.speed);
    }
}

export class DragEvent extends SwipeEvent {
    constructor(from: Point | Component, to: Point | Component, speed: number = 600) {
        super(from, to, speed);
        this.type = 'DragEvent';
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.drag(this.point, this.toPoint, this.speed);
    }
}
