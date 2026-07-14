import { describe, expect, it } from 'vitest';
import { Direct } from '../../src/device/event_simulator';
import { Event } from '../../src/event/event';
import { ScrollEvent, TouchEvent } from '../../src/event/ui_event';
import { Component } from '../../src/model/component';
import { Page } from '../../src/model/page';
import { ViewTree } from '../../src/model/viewtree';
import { detectSceneIssues } from '../../src/compare/detectors/scene_detector';
import { TransitionRecord } from '../../src/compare/types';

function createComponent(
    type: string,
    options: {
        text?: string;
        id?: string;
        key?: string;
        children?: Component[];
    } = {}
): Component {
    const component = new Component();
    component.type = type;
    component.text = options.text;
    component.id = options.id;
    component.key = options.key;
    component.bounds = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
    ];
    component.children = options.children ?? [];
    for (const child of component.children) {
        child.parent = component;
    }
    return component;
}

function createPage(pagePath: string, children: Component[]): Page {
    const root = createComponent('root', { children });
    return new Page(new ViewTree(root), 'PhoneAbility', 'com.example.demo', pagePath);
}

function createTransition(from: Page, to: Page, event: Event = new TouchEvent({ x: 10, y: 10 })): TransitionRecord {
    return { from, event, to };
}

describe('detectSceneIssues', () => {
    it('skips when destination pages belong to the same business scene class', () => {
        const mobileFrom = createPage('pages/Home', [
            createComponent('Tabs', { key: 'home_tabs' }),
            createComponent('Text', { text: '首页' }),
        ]);
        const twoInOneFrom = createPage('pages/Home', [
            createComponent('Tabs', { key: 'home_tabs' }),
            createComponent('Text', { text: '首页' }),
            createComponent('Blank'),
        ]);

        const mobileTo = createPage('pages/Detail', [
            createComponent('Text', { text: '评论' }),
            createComponent('Button', { key: 'collect' }),
        ]);
        const twoInOneTo = createPage('pages/Detail', [
            createComponent('Button', { key: 'collect' }),
            createComponent('Text', { text: '评论' }),
            createComponent('Column'),
        ]);

        const issues = detectSceneIssues(
            0,
            createTransition(mobileFrom, mobileTo),
            createTransition(twoInOneFrom, twoInOneTo),
            'mobile.png',
            '2in1.png',
            0.35
        );

        expect(issues).toHaveLength(0);
    });

    it('reports when the event type matches but destination business scenes diverge', () => {
        const sharedFromMobile = createPage('pages/Home', [
            createComponent('Tabs', { key: 'home_tabs' }),
            createComponent('Text', { text: '首页' }),
        ]);
        const sharedFromTwoInOne = createPage('pages/Home', [
            createComponent('Tabs', { key: 'home_tabs' }),
            createComponent('Text', { text: '首页' }),
        ]);

        const mobileTo = createPage('pages/Detail', [
            createComponent('Button', { key: 'comment' }),
            createComponent('Text', { text: '评论' }),
        ]);
        const twoInOneTo = createPage('pages/Profile', [
            createComponent('Button', { key: 'setting' }),
            createComponent('Text', { text: '设置' }),
        ]);

        const issues = detectSceneIssues(
            1,
            createTransition(sharedFromMobile, mobileTo),
            createTransition(sharedFromTwoInOne, twoInOneTo),
            'mobile_detail.png',
            '2in1_profile.png',
            0.35
        );

        expect(issues).toHaveLength(1);
        expect(issues[0].eventType).toBe('TouchEvent');
        expect(issues[0].mobileToPagePath).toBe('pages/Detail');
        expect(issues[0].twoInOneToPagePath).toBe('pages/Profile');
    });

    it('skips when event types do not match', () => {
        const from = createPage('pages/Home', [createComponent('Text', { text: '首页' })]);
        const to = createPage('pages/Detail', [createComponent('Text', { text: '详情' })]);
        const mobileTransition = createTransition(from, to, new TouchEvent({ x: 10, y: 10 }));
        const twoInOneTransition = createTransition(from, to, new ScrollEvent({ x: 10, y: 10 }, Direct.DOWN));

        const issues = detectSceneIssues(2, mobileTransition, twoInOneTransition, 'a.png', 'b.png', 0.35);

        expect(issues).toHaveLength(0);
    });
});