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

import { Point } from '../../model/point';
import { FrontEnd, RpcApiCall } from './front_end';
import { HypiumRpc } from './hypium_rpc';

export class PointerMatrix extends FrontEnd {
    constructor(rpc: HypiumRpc) {
        super(rpc);
    }

    /**
     *
     * @param fingers
     * @param steps
     */
    @RpcApiCall()
    async create(fingers: number, steps: number) {}

    @RpcApiCall()
    async free() {}

    @RpcApiCall()
    async setPoint(finger: number, step: number, point: Point) {}

    async setPointInterval(finger: number, step: number, point: Point, interval: number) {
        await this.setPoint(finger, step, { x: point.x + 65536 * interval, y: point.y });
    }
}
