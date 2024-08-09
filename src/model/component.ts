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

import { Expose, Transform } from 'class-transformer';
import { Point } from './point';
import { Rank } from './rank';

export enum ComponentType {
    ModalPage = 'ModalPage',
    Dialog = 'Dialog',
    TextInput = 'TextInput',
    TextArea = 'TextArea',
    SearchField = 'SearchField',
}

const TEXT_INPUTABLE_TYPE: Set<string> = new Set([
    ComponentType[ComponentType.TextInput],
    ComponentType[ComponentType.TextArea],
    ComponentType[ComponentType.SearchField],
]);

export class Component {
    accessibilityId: string;
    @Expose()
    bounds: Point[];
    @Expose()
    checkable: boolean;
    @Expose()
    checked: boolean;
    @Expose()
    clickable: boolean;
    @Expose()
    description: string;
    @Expose()
    enabled: boolean;
    @Expose()
    focused: boolean;
    hashcode: string;
    @Expose()
    hint: string;
    @Expose()
    hostWindowId: string;
    @Expose()
    id: string;
    @Expose()
    key: string;
    @Expose()
    longClickable: boolean;
    @Expose()
    origBounds: Point[];
    @Expose()
    scrollable: boolean;
    @Expose()
    selected: boolean;
    @Expose()
    @Transform(({ value, key, obj, type }) => {
        if (TEXT_INPUTABLE_TYPE.has(obj.type)) {
            return '';
        } else {
            return value;
        }
    })
    text: string;
    @Expose()
    type: string;
    @Expose()
    visible: boolean;

    rank: number;

    parent: Component | null;
    @Expose({ groups: ['Content'] })
    children: Component[];

    constructor() {
        this.children = [];
        this.rank = Rank.NORMAL;
    }

    addChild(child: Component) {
        this.children.push(child);
    }

    getCenterPoint(): Point {
        const centerX = Math.round((this.bounds[0].x + this.bounds[1].x) / 2);
        const centerY = Math.round((this.bounds[0].y + this.bounds[1].y) / 2);
        return { x: centerX, y: centerY };
    }

    getWidth(): number {
        return Math.abs(this.bounds[0].x - this.bounds[1].x);
    }

    getHeight(): number {
        return Math.abs(this.bounds[0].y - this.bounds[1].y);
    }

    structure(): Object {
        return { accessibilityId: this.accessibilityId, type: this.type };
    }

    hasUIEvent(): boolean {
        return this.enabled && (this.checkable || this.clickable || this.longClickable || this.scrollable || this.inputable);
    }

    get inputable(): boolean {
        return TEXT_INPUTABLE_TYPE.has(this.type);
    }
}
