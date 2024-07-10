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
    static buildPagesFromDumpLayoutFile(layoutFile: string): Page[] {
        let layout: DumpLayoutNode = JSON.parse(fs.readFileSync(layoutFile, 'utf-8'), (key: string, value: any) => {
            if (BOOLEAN_TYPE_KEYS.has(key)) {
                return value == 'true';
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

    static buildComponent(node: DumpLayoutNode, parent: Component | null = null): Component {
        let component = new Component();
        component.accessibilityId = node.attributes.accessibilityId;
        component.bounds = node.attributes.bounds;
        component.checkable = node.attributes.checkable;
        component.checked = node.attributes.checked;
        component.clickable = node.attributes.clickable;
        component.description = node.attributes.description;
        component.enabled = node.attributes.enabled;
        component.focused = node.attributes.focused;
        component.hashcode = node.attributes.hashcode;
        component.hint = node.attributes.hint;
        component.hostWindowId = node.attributes.hostWindowId;
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
