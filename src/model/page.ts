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

import { SerializeUtils } from '../utils/serialize_utils';
import { Component, ComponentType } from './component';
import { HapRunningState } from './hap';
import { ViewTree } from './viewtree';

export class Page {
    private viewTree: ViewTree;
    private abilityName: string;
    private bundleName: string;
    private pagePath: string;

    constructor(viewTree: ViewTree, abilityName: string, bundleName: string, pagePath: string) {
        this.viewTree = viewTree;
        this.abilityName = abilityName;
        this.bundleName = bundleName;
        this.pagePath = pagePath;
    }

    getBundleName(): string {
        return this.bundleName;
    }

    getAbilityName(): string {
        return this.abilityName;
    }

    getPagePath(): string {
        return this.pagePath;
    }

    getRoot(): Component {
        return this.viewTree.getRoot();
    }

    getComponents(): Component[] {
        return this.viewTree.getComponents();
    }

    toJson(): Record<string, any> {
        return SerializeUtils.instanceToPlain({
            viewTree: this.viewTree.toJson(),
            abilityName: this.abilityName,
            bundleName: this.bundleName,
            pagePath: this.pagePath,
        })
    }

    getContent(): string {
        return SerializeUtils.serialize(this.toJson());
    }

    getStructual(): string {
        return SerializeUtils.serialize({
            viewTree: this.viewTree.getStructual(),
            abilityName: this.abilityName,
            bundleName: this.bundleName,
            pagePath: this.pagePath,
        });
    }

    isHome(): boolean {
        return this.bundleName == 'com.ohos.sceneboard' && this.abilityName == 'com.ohos.sceneboard.MainAbility';
    }

    isLocked(): boolean {
        if (!this.isHome()) {
            return false;
        }

        for (let com of this.viewTree.getComponents()) {
            if (com.id == 'ScreenLock-SCBScreenLock_Screen_Lock_Home') {
                return true;
            }
        }
        return false;
    }

    selectComponents(selector: (item: Component) => boolean): Component[] {
        return Page.collectComponent(this.getRoot(), selector);
    }

    selectComponentsByType(types: string[]): Component[] {
        let typeSet = new Set(types);
        return this.selectComponents((item) => {
            return typeSet.has(item.type);
        });
    }

    getModalPage(): Component[] {
        return this.selectComponentsByType([ComponentType.ModalPage]);
    }

    getDialog(): Component[] {
        return this.selectComponentsByType([ComponentType.Dialog]);
    }

    static collectComponent(component: Component, selector: (item: Component) => boolean): Component[] {
        if (!selector) {
            selector = (item) => {
                return true;
            };
        }
        let children: Component[] = [];
        Page.innerCollectComponent(component, selector, children);

        return children;
    }

    private static innerCollectComponent(
        component: Component,
        selector: (item: Component) => boolean,
        children: Component[]
    ): void {
        if (selector(component)) {
            children.push(component);
        }

        for (let child of component.children) {
            Page.innerCollectComponent(child, selector, children);
        }
    }
}

export const STOP_PAGE = new Page(new ViewTree(new Component()), '', '', HapRunningState[HapRunningState.STOP]);
export const BACKGROUND_PAGE = new Page(new ViewTree(new Component()), '', '', HapRunningState[HapRunningState.BACKGROUND]);