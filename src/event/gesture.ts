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

import { Expose } from "class-transformer";
import { Point, Rect } from "../model/point";
import { Event } from './event';
import { EventSimulator } from "../device/event_simulator";

/**
 * @example
 * let gesture = new Gesture();
 * // start position long touch 2s
 * gesture.start((568, 1016), 2)
 * // move to edge of screen
 * gesture.moveTo({x: 1116, y: 1345})
 * // pause 2s
 * gesture.pause(2)
 * // move to (360, 500)
 * gesture.moveTo({x: 360, y: 500})
 * // pause 2s, then stop
 * gesture.pause(2)
 * 
 * let event = new GestureEvent([gesture]);
 */

export class GestureStep {
    @Expose()
    pos: Point;
    @Expose()
    type: string;
    @Expose()
    interval?: number;

    constructor(pos: Point, type: string, interval?: number) {
        this.pos = pos;
        this.type = type;
        if (interval) {
            this.interval = interval * 1000;
        }
    }
}

const SAMPLE_TIME_MIN = 10;
const SAMPLE_TIME_MAX = 100;
const SAMPLE_TIME_DEFAULT = 50;

export class Gesture {
    @Expose()
    private steps: GestureStep[];
    @Expose()
    private samplingTime: number;
    @Expose()
    private area?: Rect;

    constructor(area?: Rect, samplingTime: number = SAMPLE_TIME_DEFAULT) {
        this.steps = [];
        this.area = area;
        this.samplingTime = samplingTime;
        if (samplingTime < SAMPLE_TIME_MIN || samplingTime > SAMPLE_TIME_MAX) {
            this.samplingTime = SAMPLE_TIME_DEFAULT;
        }
    }

    getSamplingTime(): number {
        return this.samplingTime;
    }

    getArea(): Rect | undefined {
        return this.area;
    }

    getSteps(): GestureStep[] {
        return this.steps;
    }

    /**
     * 
     * @param pos 
     * @param interval s
     * @returns 
     */
    start(pos: Point, interval?: number): this {
        if (this.steps.length > 0) {
            throw new Error(`Can't start twice`);
        }

        this.steps.push(new GestureStep(pos, 'start', interval));
        return this;
    }

    pause(interval: number = 1.5): this {
        if (this.steps.length === 0) {
            throw new Error(`Please call gesture.start first`);
        }

        let pos = this.steps[this.steps.length - 1].pos;
        this.steps.push(new GestureStep(pos, 'pause', interval));

        return this;
    }

    moveTo(pos: Point, interval?: number): this {
        if (this.steps.length === 0) {
            throw new Error(`Please call gesture.start first`);
        }
        this.steps.push(new GestureStep(pos, 'move', interval));
        return this;
    }
}

export class GestureEvent extends Event {
    @Expose()
    protected gestures: Gesture[];
    @Expose()
    protected speed: number;

    constructor(gestures: Gesture[], speed: number = 2000) {
        super('GestureEvent');
        this.gestures = gestures;
        this.speed = speed;
    }

    async send(simulator: EventSimulator): Promise<void> {
        await simulator.injectGesture(this.gestures, this.speed);
    }
}