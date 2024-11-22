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

import { Component } from '../component';
import * as fs from 'fs';
import { Point } from '../point';
import { Page } from '../page';
import { ViewTree } from '../viewtree';

const BOOLEAN_TYPE_KEYS = new Set([
    'checkable',
    'checked',
    'clickable',
    'enabled',
    'focused',
    'longClickable',
    'longClickable',
    'scrollable',
    'selected',
    'visible',
]);

const POINT_TYPE_KEYS = new Set(['bounds', 'origBounds']);

interface Attribute {
    abilityName?: string;
    bundleName?: string;
    pagePath?: string;
    accessibilityId: string;
    bounds: Point[];
    checkable: boolean;
    checked: boolean;
    clickable: boolean;
    description: string;
    enabled: boolean;
    focused: boolean;
    hashcode: string;
    hint: string;
    hostWindowId: string;
    id: string;
    key: string;
    longClickable: boolean;
    origBounds: Point[];
    scrollable: boolean;
    selected: boolean;
    text: string;
    type: string;
    visible: boolean;
}

interface DumpLayoutNode {
    attributes: Attribute;
    children: DumpLayoutNode[];
}

export class PageBuilder {
    static buildPagesFromJson(json: string): Page[] {
        let layout: DumpLayoutNode = JSON.parse(json, (key: string, value: any) => {
            if (BOOLEAN_TYPE_KEYS.has(key)) {
                return value === 'true';
            } else if (POINT_TYPE_KEYS.has(key)) {
                let points: Point[] = [];
                for (let point of value.split('][')) {
                    let [x, y] = point.replace('[', '').replace(']', '').split(',');
                    if (x && y) {
                        points.push({ x: Number(x), y: Number(y) });
                    }
                }
                return points;
            }
            return value;
        });

        let pages: Page[] = [];
        for (let child of layout.children) {
            pages.push(
                new Page(
                    PageBuilder.buildViewTree(child),
                    child.attributes.abilityName!,
                    child.attributes.bundleName!,
                    child.attributes.pagePath!
                )
            );
        }

        return pages;
    }
    
    static buildPagesFromDumpLayoutFile(layoutFile: string): Page[] {
        return this.buildPagesFromJson(fs.readFileSync(layoutFile, 'utf-8'));
    }

    static buildComponent(node: DumpLayoutNode, parent: Component | null = null): Component {
        let component = new Component();
        component.bounds = node.attributes.bounds;
        component.checkable = node.attributes.checkable;
        component.checked = node.attributes.checked;
        component.clickable = node.attributes.clickable;
        component.enabled = node.attributes.enabled;
        component.focused = node.attributes.focused;
        component.hint = node.attributes.hint;
        component.id = node.attributes.id;
        component.key = node.attributes.key;
        component.longClickable = node.attributes.longClickable;
        component.origBounds = node.attributes.origBounds;
        component.scrollable = node.attributes.scrollable;
        component.selected = node.attributes.selected;
        component.text = node.attributes.text;
        component.type = node.attributes.type;
        component.visible = node.attributes.visible;
        component.parent = parent;

        for (let child of node.children) {
            component.addChild(PageBuilder.buildComponent(child, component));
        }

        return component;
    }

    static buildViewTree(root: DumpLayoutNode): ViewTree {
        let component = PageBuilder.buildComponent(root);
        return new ViewTree(component);
    }
}
