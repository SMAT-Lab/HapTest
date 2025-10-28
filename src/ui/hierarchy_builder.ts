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

import { randomUUID } from 'crypto';
import { Component } from '../model/component';
import { Point } from '../model/point';

export interface HierarchyRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface HierarchyNode {
    _id: string;
    _parentId: string | null;
    index: number;
    text: string;
    id: string;
    name?: string;
    hint?: string;
    _type: string;
    description?: string;
    checkable: boolean;
    clickable: boolean;
    enabled: boolean;
    focusable: boolean;
    focused: boolean;
    scrollable: boolean;
    longClickable: boolean;
    selected: boolean;
    rect: HierarchyRect;
    bounds: Point[];
    debugLine?: string;
    componentPath: string;
    xpath: string;
    children: HierarchyNode[];
}

export interface HierarchyTree {
    root: HierarchyNode;
    map: Map<string, HierarchyNode>;
}

function toRect(bounds?: Point[]): HierarchyRect {
    if (!bounds || bounds.length < 2) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    const first = bounds[0];
    const second = bounds[1];
    const minX = Math.min(first.x, second.x);
    const minY = Math.min(first.y, second.y);
    return {
        x: minX,
        y: minY,
        width: Math.abs(second.x - first.x),
        height: Math.abs(second.y - first.y),
    };
}

function cloneBounds(bounds?: Point[]): Point[] {
    if (!bounds) {
        return [];
    }
    return bounds.map((point) => ({ x: point.x, y: point.y }));
}

export function buildHierarchy(rootComponent: Component): HierarchyTree {
    const map = new Map<string, HierarchyNode>();

    const visit = (component: Component, parentId: string | null, index: number, parentPath: string): HierarchyNode => {
        const id = randomUUID();
        const rect = toRect(component.bounds);
        const type = component.type ?? '';
        const siblingIndex = index + 1;
        const componentPath = parentPath.length > 0 ? `${parentPath} > ${type || 'Node'}[${siblingIndex}]` : `${type || 'Node'}[1]`;

        const node: HierarchyNode = {
            _id: id,
            _parentId: parentId,
            index,
            text: component.text ?? '',
            id: component.id ?? '',
            name: component.name ?? undefined,
            hint: component.hint ?? undefined,
            _type: type,
            description: component.hint ?? undefined,
            checkable: component.checkable ?? false,
            clickable: component.clickable ?? false,
            enabled: component.enabled ?? false,
            focusable: component.clickable ?? false,
            focused: component.focused ?? false,
            scrollable: component.scrollable ?? false,
            longClickable: component.longClickable ?? false,
            selected: component.selected ?? false,
            rect,
            bounds: cloneBounds(component.bounds),
            debugLine: component.debugLine ?? undefined,
            componentPath,
            xpath: '',
            children: [],
        };

        map.set(id, node);
        node.children = component.children.map((child, childIndex) => visit(child, id, childIndex, componentPath));
        return node;
    };

    const rootNode = visit(rootComponent, null, 0, '');
    return { root: rootNode, map };
}

export function generateXPathLite(nodeId: string, tree: HierarchyTree): string {
    const { map } = tree;
    const node = map.get(nodeId);
    if (!node) {
        return '//';
    }

    const segments: string[] = [];
    let current: HierarchyNode | undefined = node;
    while (current) {
        const parentId = current._parentId;
        const type = current._type || 'Node';
        if (!parentId) {
            segments.unshift(`${type}[1]`);
            break;
        }
        const parent = map.get(parentId);
        if (!parent) {
            segments.unshift(`${type}[1]`);
            break;
        }
        const siblings = parent.children.filter((item) => item._type === current!._type);
        const position = siblings.indexOf(current) + 1;
        segments.unshift(`${type}[${position > 0 ? position : 1}]`);
        current = parent;
    }

    return `//${segments.join('/')}`;
}
