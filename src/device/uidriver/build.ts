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

import { Device } from '../device';
import { ArkUiDriver } from './arkui_driver';
import { Gesture } from '../../event/gesture';
import { HypiumRpc } from './hypium_rpc';
import { PointerMatrix } from './pointer_matrix';
import { UitestAgent } from './uitest_agent';

export async function buildDriverImpl(device: Device): Promise<ArkUiDriver> {
    // set uitest agent mode
    let agent = new UitestAgent(device);
    await agent.start();
    
    // create rpc
    let rpc = new HypiumRpc();
    await rpc.connect(agent.getHostPort());

    let driver = new ArkUiDriver(rpc);
    await driver.create();
    return driver;
}

export async function buildPointerMetrix(rpc: HypiumRpc, gestures: Gesture[], speed: number = 2000): Promise<PointerMatrix> {
    let matrix = new PointerMatrix(rpc);
    let maxSteps = 0;
    for (const gesture of gestures) {
        let totalSteps = calcGestureSteps(gesture, speed);
        if (totalSteps > maxSteps) {
            maxSteps = totalSteps;
        }
    }

    await matrix.create(gestures.length, maxSteps);
    for (let i = 0; i < gestures.length; i++) {
        await generateGesturePoint(gestures[i], matrix, i, maxSteps, speed);
    }

    return matrix;
}

function calcGestureSteps(gesture: Gesture, speed: number): number {
    let totalSteps = 0;
    gesture.getSteps().forEach((step, index, steps) => {
        if (step.type == 'start') {
            if (step.interval) {
                totalSteps += 2;
            } else {
                totalSteps += 1;
            }
        } else if (step.type == 'move') {
            let last = steps[index - 1];
            let distance = Math.sqrt((step.pos.x - last.pos.x) ** 2 + (step.pos.y - last.pos.y) ** 2);
            let timeMs = step.interval;
            if (!timeMs) {
                timeMs = Math.floor(distance / speed * 1000);
            }
            totalSteps += calculateSteps(distance, timeMs, gesture.getSamplingTime());
        } else if (step.type == 'pause') {
            totalSteps += Math.floor(step.interval! / gesture.getSamplingTime()) + 1;
        }
    });

    return totalSteps;
}

async function generateGesturePoint(gesture: Gesture, pointerMatrix: PointerMatrix, fingerIdx: number, totalPoints: number, speed: number) {
    let curPoint = 0;
    let steps = gesture.getSteps();
    for (let i = 0; i < steps.length; i++) {
        let step = steps[i];
        if (step.type == 'start') {
            if (step.interval) {
                await pointerMatrix.setPointInterval(fingerIdx, curPoint, step.pos, step.interval);
                curPoint++;
                if (steps.length == 1) {
                    await pointerMatrix.setPoint(fingerIdx, curPoint, step.pos);
                    curPoint++;
                } else {
                    await pointerMatrix.setPoint(fingerIdx, curPoint, {x: step.pos.x + 3, y: step.pos.y});
                    curPoint++;
                }
            } else {
                await pointerMatrix.setPoint(fingerIdx, curPoint, step.pos);
                curPoint++;
            }
        } else if (step.type == 'move') {
            let last = steps[i - 1];
            let distance = Math.sqrt((step.pos.x - last.pos.x) ** 2 + (step.pos.y - last.pos.y) ** 2);
            let timeMs = step.interval;
            if (!timeMs) {
                timeMs = Math.floor(distance / speed * 1000);
            }
            let points = calculateSteps(distance, timeMs, gesture.getSamplingTime());
            let stepX = Math.floor((step.pos.x - last.pos.x) / points);
            let stepY = Math.floor((step.pos.y - last.pos.y) / points);
            if (step.interval) {
                await pointerMatrix.setPointInterval(fingerIdx, curPoint - 1, last.pos, gesture.getSamplingTime());
                let x = last.pos.x;
                let y = last.pos.y;
                for (let i = 0; i < points; i++) {
                    x += stepX;
                    y += stepY;
                    await pointerMatrix.setPointInterval(fingerIdx, curPoint, {x: x, y: y}, gesture.getSamplingTime());
                    curPoint++;
                }
            } else {
                await pointerMatrix.setPoint(fingerIdx, curPoint - 1, last.pos);
                let x = last.pos.x;
                let y = last.pos.y;
                for (let i = 0; i < points; i++) {
                    x += stepX;
                    y += stepY;
                    await pointerMatrix.setPoint(fingerIdx, curPoint, {x: x, y: y});
                    curPoint++;
                }
            }
        } else if (step.type == 'pause') {
            let points = Math.floor(step.interval! / gesture.getSamplingTime());
            for (let i = 0; i < points; i++) {
                await pointerMatrix.setPointInterval(fingerIdx, curPoint, step.pos, points);
                curPoint++;
            }

            await pointerMatrix.setPoint(fingerIdx, curPoint, {x: step.pos.x + 3, y: step.pos.y});
            curPoint++;
        }
    };

    while (curPoint < totalPoints) {
        await pointerMatrix.setPoint(fingerIdx, curPoint, steps[steps.length - 1].pos);
        curPoint++;
    }
}

function calculateSteps(distance: number, time: number, sampling_time: number): number {
    if (time < sampling_time || distance < 1) {
        return 1;
    }
    let steps = time / sampling_time
    if (steps > distance) {
        return distance
    }
    return Math.floor(steps)
}
