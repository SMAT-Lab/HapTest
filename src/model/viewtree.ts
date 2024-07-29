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

import { Expose, plainToInstance } from 'class-transformer';
import { SerializeUtils } from '../utils/serialize_utils';
import { Component } from './component';

export class ViewTree {
    @Expose()
    private root: Component;
    private components: Component[];

    constructor(root: Component) {
        this.root = root;
        this.components = [];
    }

    getRoot(): Component {
        return this.root;
    }

    getComponents(): Component[] {
        if (this.components.length == 0) {
            this.walk(this.root);
        }

        return this.components;
    }

    toJson(): Record<string, any> {
        return SerializeUtils.instanceToPlain(this.getRoot(), { groups: ['Content'] });
    }

    static fromJson(json: any): ViewTree {
        let root = plainToInstance(Component, json, { groups: ['Content'] });
        return new ViewTree(root);
    }

    getContent(): string {
        return SerializeUtils.serialize(this.getRoot(), { groups: ['Content'] });
    }

    getStructual(): string {
        let structures: Object[] = [];
        this.getComponents().forEach((value) => {
            structures.push(value.structure());
        });

        return JSON.stringify(structures);
    }

    private walk(component: Component): void {
        this.components.push(component);
        for (let child of component.children) {
            this.walk(child);
        }
    }
}
