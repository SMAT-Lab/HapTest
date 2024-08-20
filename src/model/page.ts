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

import { EventBuilder } from '../event/event_builder';
import { CryptoUtils } from '../utils/crypto_utils';
import { SerializeUtils } from '../utils/serialize_utils';
import { Component, ComponentType } from './component';
import { UIEvent } from '../event/ui_event';
import { HapRunningState } from './hap';
import { Snapshot } from './snapshot';
import { ViewTree } from './viewtree';
import { Expose } from 'class-transformer';

export class Page {
    @Expose()
    private viewTree: ViewTree;
    @Expose()
    private abilityName: string;
    @Expose()
    private bundleName: string;
    @Expose()
    private pagePath: string;
    @Expose()
    private snapshot: Snapshot;

    constructor(viewTree: ViewTree, abilityName: string, bundleName: string, pagePath: string) {
        this.viewTree = viewTree;
        this.abilityName = abilityName;
        this.bundleName = bundleName;
        this.pagePath = pagePath;
    }

    getSnapshot(): Snapshot {
        return this.snapshot;
    }

    setSnapshot(snapshot: Snapshot) {
        this.snapshot = snapshot;
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
        return SerializeUtils.instanceToPlain(this, { groups: ['Content'] });
    }

    static fromJson(json: any): Page {
        return SerializeUtils.plainToInstance(Page, json, { groups: ['Content'] });
    }

    getContent(): string {
        return SerializeUtils.serialize({
            viewTree: SerializeUtils.instanceToPlain(this.viewTree, { groups: ['Content'] }),
            abilityName: this.abilityName,
            bundleName: this.bundleName,
            pagePath: this.pagePath,
        });
    }

    getStructual(): string {
        return SerializeUtils.serialize({
            viewTree: this.viewTree.getStructual(),
            abilityName: this.abilityName,
            bundleName: this.bundleName,
            pagePath: this.pagePath,
        });
    }

    getContentSig(): string {
        return CryptoUtils.sha1(this.getContent());
    }

    getStructualSig(): string {
        return CryptoUtils.sha1(this.getStructual());
    }

    getPossibleUIEvents(): UIEvent[] {
        return EventBuilder.createPossibleUIEvents(this.getComponents());
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

    isStop(): boolean {
        return this.getContentSig() == STOP_PAGE.getContentSig();
    }

    isBackground(): boolean {
        return this.getContentSig() == BACKGROUND_PAGE.getContentSig();
    }

    isForeground(): boolean {
        return !(this.isStop() || this.isBackground());
    }

    mergeInspector(viewTree: ViewTree) {
        if (!viewTree) {
            return;
        }
        let map = new Map<string, Component>();
        for (const component of viewTree.getComponents()) {
            map.set(component.uniqueId, component);
        }

        for (let component of this.getComponents()) {
            let other = map.get(component.uniqueId);
            if (other) {
                component.debugLine = other.debugLine;
                component.name = other.name;
            }
        }
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
export const BACKGROUND_PAGE = new Page(
    new ViewTree(new Component()),
    '',
    '',
    HapRunningState[HapRunningState.BACKGROUND]
);
