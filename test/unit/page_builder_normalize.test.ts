import { describe, expect, it } from 'vitest';
import { PageBuilder } from '../../src/model/builder/page_builder';

describe('PageBuilder layout normalization', () => {
    const baseAttributes = {
        abilityName: 'MainAbility',
        bundleName: 'com.example.demo',
        pagePath: '/Main',
        accessibilityId: '',
        bounds: [
            [0, 0],
            [100, 200],
        ],
        origBounds: [
            [0, 0],
            [100, 200],
        ],
        checkable: false,
        checked: false,
        clickable: false,
        description: '',
        enabled: true,
        focused: false,
        hashcode: 'root',
        hint: '',
        hostWindowId: '1',
        id: 'root',
        key: 'root-key',
        longClickable: false,
        scrollable: false,
        selected: false,
        text: 'Root',
        type: 'RootNode',
        visible: true,
    };

    const childAttributes = {
        ...baseAttributes,
        bounds: [
            [10, 20],
            [60, 80],
        ],
        origBounds: [
            [10, 20],
            [60, 80],
        ],
        id: 'child',
        key: 'child-key',
        text: 'Child',
        type: 'Text',
    };

    it('parses layout object wrapped in data->windows->root', () => {
        const layout = {
            data: {
                windows: [
                    {
                        metadata: {
                            abilityName: 'MainAbility',
                            bundleName: 'com.example.demo',
                            pagePath: '/Main',
                        },
                        root: {
                            attributes: baseAttributes,
                            children: [
                                {
                                    attributes: childAttributes,
                                    children: [],
                                },
                            ],
                        },
                    },
                ],
            },
        };

        const pages = PageBuilder.buildPagesFromLayout(layout);

        expect(pages.length).toBe(1);
        const page = pages[0];
        expect(page.getBundleName()).toBe('com.example.demo');
        expect(page.getAbilityName()).toBe('MainAbility');
        expect(page.getPagePath()).toBe('/Main');

        const root = page.getRoot();
        expect(root.bounds).toEqual([
            { x: 0, y: 0 },
            { x: 100, y: 200 },
        ]);
        expect(root.children.length).toBe(1);
        expect(root.children[0].bounds).toEqual([
            { x: 10, y: 20 },
            { x: 60, y: 80 },
        ]);
    });

    it('parses layout when provided as stringified JSON', () => {
        const stringified = JSON.stringify({
            data: {
                pages: [
                    {
                        metadata: {
                            abilityName: 'SecondAbility',
                            bundleName: 'com.example.demo',
                            pagePath: '/Second',
                        },
                        root: {
                            attributes: {
                                ...baseAttributes,
                                abilityName: 'SecondAbility',
                                pagePath: '/Second',
                                bounds: [
                                    [5, 5],
                                    [50, 50],
                                ],
                                origBounds: [
                                    [5, 5],
                                    [50, 50],
                                ],
                                id: 'root-2',
                                key: 'root-key-2',
                                text: 'Root2',
                            },
                            children: [],
                        },
                    },
                ],
            },
        });

        const pages = PageBuilder.buildPagesFromLayout(stringified);
        expect(pages.length).toBe(1);
        const page = pages[0];
        expect(page.getBundleName()).toBe('com.example.demo');
        expect(page.getAbilityName()).toBe('SecondAbility');
        expect(page.getPagePath()).toBe('/Second');
        expect(page.getRoot().bounds).toEqual([
            { x: 5, y: 5 },
            { x: 50, y: 50 },
        ]);
    });
});
