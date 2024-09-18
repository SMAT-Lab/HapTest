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

    send(simulator: EventSimulator): void {
        simulator.click(this.point);
    }
}

export class LongTouchEvent extends UIEvent {
    constructor(componentOrPoint: Component | Point) {
        super('LongTouchEvent', componentOrPoint);
    }

    send(simulator: EventSimulator): void {
        simulator.longClick(this.point);
    }
}

export class DoubleClickEvent extends UIEvent {
    constructor(componentOrPoint: Component | Point) {
        super('DoubleClickEvent', componentOrPoint);
    }

    send(simulator: EventSimulator): void {
        simulator.doubleClick(this.point);
    }
}

export class ScrollEvent extends UIEvent {
    @Expose()
    protected velocity: number;
    @Expose()
    protected step: number;
    @Expose()
    protected direct: Direct;

    constructor(componentOrPoint: Component | Point, direct: Direct, velocity: number = 40000, step: number = 100) {
        super('ScrollEvent', componentOrPoint);
        this.velocity = velocity;
        this.direct = direct;
        this.step = step;
    }

    send(simulator: EventSimulator): void {
        let from: Point = { x: this.point.x, y: this.point.y };
        let to: Point = { x: this.point.x, y: this.point.y };

        let height = this.component ? this.component.getHeight() : simulator.getHeight();
        let width = this.component ? this.component.getWidth() : simulator.getWidth();

        if (this.direct == Direct.UP) {
            from.y += Math.round((height * 2) / 5);
            to.y -= Math.round((height * 2) / 5);
        } else if (this.direct == Direct.DOWN) {
            from.y -= Math.round((height * 2) / 5);
            to.y += Math.round((height * 2) / 5);
        } else if (this.direct == Direct.LEFT) {
            from.x -= Math.round((width * 2) / 5);
            to.x += Math.round((width * 2) / 5);
        } else if (this.direct == Direct.RIGHT) {
            from.x += Math.round((width * 2) / 5);
            to.x -= Math.round((width * 2) / 5);
        }

        simulator.fling(from, to, this.velocity, this.step);
    }
}

export class InputTextEvent extends UIEvent {
    @Expose()
    protected text: string;

    constructor(componentOrPoint: Component | Point, text: string) {
        super('InputTextEvent', componentOrPoint);
        this.text = text;
    }

    send(simulator: EventSimulator): void {
        simulator.click(this.point);
        simulator.inputKey(KeyCode.KEYCODE_CTRL_LEFT, KeyCode.KEYCODE_A, undefined);
        simulator.inputKey(KeyCode.KEYCODE_DEL, undefined, undefined);
        simulator.inputText(this.point, this.text);
    }

    getText(): string {
        return this.text;
    }
}

export class SwipeEvent extends UIEvent {
    @Expose()
    protected toPoint: Point;
    @Expose()
    protected toComponent?: Component;
    @Expose()
    protected velocity: number;

    constructor(from: Point | Component, to: Point | Component, velocity: number = 600) {
        super('SwipeEvent', from);
        if (to instanceof Component) {
            this.toComponent = to;
            this.toPoint = to.getCenterPoint();
        } else {
            this.toPoint = to;
        }
        this.velocity = velocity;
    }

    send(simulator: EventSimulator): void {
        simulator.swipe(this.point, this.toPoint, this.velocity);
    }
}

export class FlingEvent extends SwipeEvent {
    @Expose()
    protected step: number;

    constructor(from: Point | Component, to: Point | Component, velocity: number = 600, step: number) {
        super(from, to, velocity);
        this.step = step;
        this.type = 'FlingEvent';
    }

    send(simulator: EventSimulator): void {
        simulator.fling(this.point, this.toPoint, this.velocity, this.step);
    }
}

export class DragEvent extends SwipeEvent {
    constructor(from: Point | Component, to: Point | Component, velocity: number = 600) {
        super(from, to, velocity);
        this.type = 'DragEvent';
    }

    send(simulator: EventSimulator): void {
        simulator.drag(this.point, this.toPoint, this.velocity);
    }
}
