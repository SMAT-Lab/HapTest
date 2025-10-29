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

interface NormalizedPageEntry {
    node: DumpLayoutNode;
    metaSources: any[];
}

function parsePointTokens(value: string): Point[] {
    const points: Point[] = [];
    const tokens = value.split('][');
    for (const token of tokens) {
        const cleaned = token.replace('[', '').replace(']', '');
        if (!cleaned) {
            continue;
        }
        const [x, y] = cleaned.split(',');
        if (x !== undefined && y !== undefined) {
            const px = Number(x);
            const py = Number(y);
            if (!Number.isNaN(px) && !Number.isNaN(py)) {
                points.push({ x: px, y: py });
            }
        }
    }
    return points;
}

function normalizePointValue(value: any): Point[] {
    if (Array.isArray(value)) {
        const points: Point[] = [];
        for (const entry of value) {
            if (Array.isArray(entry) && entry.length >= 2) {
                const [x, y] = entry;
                points.push({ x: Number(x), y: Number(y) });
            } else if (entry && typeof entry === 'object') {
                const x = 'x' in entry ? Number(entry.x) : Number((entry as any)[0]);
                const y = 'y' in entry ? Number(entry.y) : Number((entry as any)[1]);
                if (!Number.isNaN(x) && !Number.isNaN(y)) {
                    points.push({ x, y });
                }
            }
        }
        return points;
    }
    if (typeof value === 'string') {
        return parsePointTokens(value);
    }
    return [];
}

function dumpLayoutReviver(key: string, value: any): any {
    if (BOOLEAN_TYPE_KEYS.has(key)) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            return value === 'true';
        }
        return Boolean(value);
    }
    if (POINT_TYPE_KEYS.has(key)) {
        return normalizePointValue(value);
    }
    return value;
}

export class PageBuilder {
    static buildPagesFromJson(json: string): Page[] {
        return this.buildPagesFromLayout(json);
    }

    static buildPagesFromLayout(layoutInput: unknown): Page[] {
        const layout = this.decodeLayout(layoutInput);
        const normalized = this.normalizePages(layout);

        const pages: Page[] = [];
        for (const entry of normalized) {
            const meta = this.extractMeta(entry.metaSources);
            pages.push(new Page(this.buildViewTree(entry.node), meta.abilityName, meta.bundleName, meta.pagePath));
        }

        return pages;
    }

    static buildPagesFromDumpLayoutFile(layoutFile: string): Page[] {
        return this.buildPagesFromJson(fs.readFileSync(layoutFile, 'utf-8'));
    }

    private static decodeLayout(layoutInput: unknown): any {
        if (layoutInput === null || layoutInput === undefined) {
            return null;
        }
        if (typeof layoutInput === 'string') {
            const trimmed = layoutInput.trim();
            if (!trimmed) {
                return null;
            }
            return JSON.parse(trimmed, dumpLayoutReviver);
        }
        if (typeof layoutInput === 'object') {
            try {
                return JSON.parse(JSON.stringify(layoutInput), dumpLayoutReviver);
            } catch {
                return null;
            }
        }
        return null;
    }

    private static normalizePages(layout: any): NormalizedPageEntry[] {
        if (!layout) {
            return [];
        }

        if (Array.isArray(layout)) {
            return layout.flatMap((item) => this.normalizePages(item));
        }

        if (layout.data) {
            return this.normalizePages(layout.data);
        }

        if (layout.result) {
            return this.normalizePages(layout.result);
        }

        const result: NormalizedPageEntry[] = [];
        const pushNode = (node: any, metaSources: any[]) => {
            if (!node || typeof node !== 'object') {
                return;
            }
            if (!node.attributes) {
                return;
            }
            if (!Array.isArray(node.children)) {
                node.children = Array.isArray(node.children) ? node.children : [];
            }
            const sources = metaSources.filter(Boolean);
            result.push({ node: node as DumpLayoutNode, metaSources: sources });
        };

        if (Array.isArray(layout.children) && layout.children.length > 0) {
            for (const child of layout.children) {
                pushNode(child, [child?.attributes, layout?.attributes, layout?.metadata, layout]);
            }
            return result;
        }

        if (Array.isArray(layout.pages) && layout.pages.length > 0) {
            for (const page of layout.pages) {
                if (page?.root) {
                    pushNode(page.root, [page.root?.attributes, page?.metadata, page, layout?.metadata, layout]);
                } else {
                    pushNode(page, [page?.attributes, page?.metadata, layout?.metadata, layout]);
                }
            }
            return result;
        }

        if (Array.isArray(layout.windows) && layout.windows.length > 0) {
            for (const win of layout.windows) {
                if (win?.root) {
                    pushNode(win.root, [win.root?.attributes, win?.metadata, win, layout?.metadata, layout]);
                }
            }
            if (result.length > 0) {
                return result;
            }
        }

        if (layout.root) {
            pushNode(layout.root, [layout.root?.attributes, layout?.metadata, layout]);
            if (result.length > 0) {
                return result;
            }
        }

        pushNode(layout, [layout?.attributes, layout?.metadata, layout]);
        if (result.length === 0) {
            const fallback = this.findFirstNode(layout);
            if (fallback) {
                result.push(fallback);
            }
        }
        return result;
    }

    private static extractMeta(metaSources: any[]): { abilityName: string; bundleName: string; pagePath: string } {
        return {
            abilityName: this.extractMetaValue(metaSources, 'abilityName'),
            bundleName: this.extractMetaValue(metaSources, 'bundleName'),
            pagePath: this.extractMetaValue(metaSources, 'pagePath'),
        };
    }

    private static findFirstNode(value: any, ancestors: any[] = []): NormalizedPageEntry | null {
        if (!value || typeof value !== 'object') {
            return null;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                const found = this.findFirstNode(item, ancestors);
                if (found) {
                    return found;
                }
            }
            return null;
        }

        const metaSources = [value?.attributes, value?.metadata, value, ...ancestors].filter(Boolean);
        if (value.attributes && (Array.isArray(value.children) || value.children === undefined)) {
            if (!Array.isArray(value.children)) {
                value.children = Array.isArray(value.children) ? value.children : [];
            }
            return { node: value as DumpLayoutNode, metaSources };
        }

        for (const key of Object.keys(value)) {
            if (key === 'attributes' || key === 'metadata') {
                continue;
            }
            const found = this.findFirstNode(value[key], metaSources);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private static extractMetaValue(metaSources: any[], key: string): string {
        const normalizedKey = key.toLowerCase();
        for (const source of metaSources) {
            if (!source || typeof source !== 'object') {
                continue;
            }
            if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
                return String(source[key]);
            }
            for (const prop of Object.keys(source)) {
                if (prop.toLowerCase() === normalizedKey) {
                    const value = source[prop];
                    if (value !== undefined && value !== null && value !== '') {
                        return String(value);
                    }
                }
            }
        }
        return '';
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
