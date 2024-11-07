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

import { FrontEnd, RpcApiCall } from './front_end';
import { HypiumRpc } from './hypium_rpc';
import { KeyCode } from '../../model/key_code';
import { Point } from '../../model/point';
import { PointerMatrix } from './pointer_matrix';
import { Gesture } from '../../event/gesture';
import { buildPointerMetrix } from './build';

export class ArkUiDriver extends FrontEnd {
    constructor(rpc: HypiumRpc) {
        super(rpc);
    }

    @RpcApiCall()
    async create() {}

    @RpcApiCall()
    async free() {}

    @RpcApiCall()
    async pressBack() {}

    @RpcApiCall()
    async pressHome() {}

    @RpcApiCall()
    async triggerKey(keyCode: KeyCode) {}

    @RpcApiCall()
    async triggerCombineKeys(keyCode: KeyCode, keyCode2: KeyCode, keyCode3?: KeyCode) {}

    @RpcApiCall()
    async click(x: number, y: number) {}

    @RpcApiCall()
    async doubleClick(x: number, y: number) {}

    @RpcApiCall()
    async longClick(x: number, y: number) {}

    @RpcApiCall()
    async swipe(startx: number, starty: number, endx: number, endy: number, speed: number) {}

    @RpcApiCall()
    async fling(start: Point, end: Point, step: number, speed: number) {}

    @RpcApiCall()
    async drag(starx: number, starty: number, endx: number, endy: number, speed: number) {}

    @RpcApiCall()
    async inputText(pos: Point, text: string) {}

    @RpcApiCall()
    async getDisplaySize(): Promise<Point> {
        return { x: 0, y: 0 };
    }

    @RpcApiCall()
    async injectMultiPointerAction(pointerMatrix: PointerMatrix, speed: number) {}

    async injectGesture(gestures: Gesture[], speed: number) {
        let pointerMatrix = await buildPointerMetrix(this.rpc, gestures, speed);
        await this.injectMultiPointerAction(pointerMatrix, speed);
    }
    @RpcApiCall('Captures', 'captureLayout')
    async dumpLayout(): Promise<string> {
        return '';
    }
}
