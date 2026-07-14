import { describe, expect, it } from 'vitest';
import { Component } from '../../src/model/component';
import { Page } from '../../src/model/page';
import { ViewTree } from '../../src/model/viewtree';
import {
    AiComponentMatchContext,
    AiComponentMatcher,
    buildComponentNameMap,
    buildComponentParentMap,
    matchComponentNameMaps,
    matchComponentParentMaps,
} from '../../src/compare/component_matcher';

function createComponent(
    type: string,
    options: {
        id?: string;
        key?: string;
        text?: string;
        children?: Component[];
    } = {}
): Component {
    const component = new Component();
    component.type = type;
    component.id = options.id;
    component.key = options.key;
    component.text = options.text;
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

function createPage(children: Component[]): Page {
    const root = createComponent('Root', { id: 'root', children });
    return new Page(new ViewTree(root), 'Ability', 'com.example.demo', 'pages/index');
}

class MockAiMatcher implements AiComponentMatcher {
    async isSameComponent(
        mobileComponent: Component,
        twoInOneComponent: Component,
        _context: AiComponentMatchContext
    ): Promise<boolean> {
        const mobileText = mobileComponent.text?.trim();
        const twoInOneText = twoInOneComponent.text?.trim();
        return !!mobileText && mobileText === twoInOneText;
    }
}

describe('component_matcher ai fallback', () => {
    it('uses ai fallback for name map when identity differs', async () => {
        const mobilePage = createPage([
            createComponent('Button', { key: 'btn_login_mobile', text: '登录' }),
        ]);
        const twoInOnePage = createPage([
            createComponent('Button', { key: 'btn_login_2in1', text: '登录' }),
        ]);

        const mobileMap = buildComponentNameMap(mobilePage);
        const twoInOneMap = buildComponentNameMap(twoInOnePage);

        const exactMatches = await matchComponentNameMaps(mobileMap, twoInOneMap);
        expect(exactMatches).toHaveLength(1);

        const aiMatches = await matchComponentNameMaps(mobileMap, twoInOneMap, new MockAiMatcher());
        expect(aiMatches).toHaveLength(2);
        expect(aiMatches[1].aiMatched).toBe(true);
    });

    it('uses ai-only mode for name map and skips exact pre-match', async () => {
        const mobilePage = createPage([
            createComponent('Button', { key: 'btn_same_identity', text: '登录' }),
        ]);
        const twoInOnePage = createPage([
            createComponent('Button', { key: 'btn_same_identity', text: '注册' }),
        ]);

        const mobileMap = buildComponentNameMap(mobilePage);
        const twoInOneMap = buildComponentNameMap(twoInOnePage);
        const targetKey = 'Button::btn_same_identity';

        const exactMatches = await matchComponentNameMaps(mobileMap, twoInOneMap);
        expect(exactMatches.some((match) => match.mobileKey === targetKey && match.twoInOneKey === targetKey)).toBe(true);
        expect(exactMatches.some((match) => match.aiMatched)).toBe(false);

        const aiOnlyMatches = await matchComponentNameMaps(mobileMap, twoInOneMap, new MockAiMatcher(), {
            aiOnly: true,
        });
        expect(aiOnlyMatches.some((match) => match.mobileKey === targetKey && match.twoInOneKey === targetKey)).toBe(false);
    });

    it('uses ai fallback for parent map when parent-child identity differs', async () => {
        const mobilePage = createPage([
            createComponent('Column', {
                key: 'container_mobile',
                children: [createComponent('Image', { key: 'cover_mobile', text: '海报' })],
            }),
        ]);
        const twoInOnePage = createPage([
            createComponent('Column', {
                key: 'container_2in1',
                children: [createComponent('Image', { key: 'cover_2in1', text: '海报' })],
            }),
        ]);

        const mobileMap = buildComponentParentMap(mobilePage);
        const twoInOneMap = buildComponentParentMap(twoInOnePage);

        const exactMatches = await matchComponentParentMaps(mobileMap, twoInOneMap);
        expect(exactMatches).toHaveLength(1);

        const aiMatches = await matchComponentParentMaps(mobileMap, twoInOneMap, new MockAiMatcher());
        expect(aiMatches).toHaveLength(2);
        expect(aiMatches[1].aiMatched).toBe(true);
    });

    it('uses ai-only mode for parent map and skips exact pre-match', async () => {
        const mobilePage = createPage([
            createComponent('Column', {
                key: 'container',
                children: [createComponent('Image', { key: 'cover', text: '海报A' })],
            }),
        ]);
        const twoInOnePage = createPage([
            createComponent('Column', {
                key: 'container',
                children: [createComponent('Image', { key: 'cover', text: '海报B' })],
            }),
        ]);

        const mobileMap = buildComponentParentMap(mobilePage);
        const twoInOneMap = buildComponentParentMap(twoInOnePage);
        const targetKey = 'container>>cover';

        const exactMatches = await matchComponentParentMaps(mobileMap, twoInOneMap);
        expect(exactMatches.some((match) => match.mobileKey === targetKey && match.twoInOneKey === targetKey)).toBe(true);
        expect(exactMatches.some((match) => match.aiMatched)).toBe(false);

        const aiOnlyMatches = await matchComponentParentMaps(mobileMap, twoInOneMap, new MockAiMatcher(), {
            aiOnly: true,
        });
        expect(aiOnlyMatches.some((match) => match.mobileKey === targetKey && match.twoInOneKey === targetKey)).toBe(false);
    });
});
