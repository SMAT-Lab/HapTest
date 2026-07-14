import { describe, expect, it } from 'vitest';
import { Component } from '../../src/model/component';
import { Page } from '../../src/model/page';
import { ViewTree } from '../../src/model/viewtree';
import { detectComponentDiffIssues } from '../../src/compare/detectors/diff_detector';

function createComponent(
    type: string,
    options: {
        id?: string;
        key?: string;
        text?: string;
        visible?: boolean;
        children?: Component[];
        bounds?: Array<{ x: number; y: number }>;
    } = {}
): Component {
    const component = new Component();
    component.type = type;
    component.id = options.id;
    component.key = options.key;
    component.text = options.text;
    component.visible = options.visible;
    component.bounds = options.bounds ?? [
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

describe('detectComponentDiffIssues', () => {
    it('returns empty when matched components are identical', async () => {
        const mobilePage = createPage([
            createComponent('Column', {
                key: 'container',
                children: [
                    createComponent('Button', {
                        key: 'btn_submit',
                        text: '提交',
                        visible: true,
                    }),
                ],
            }),
        ]);

        const twoInOnePage = createPage([
            createComponent('Column', {
                key: 'container',
                children: [
                    createComponent('Button', {
                        key: 'btn_submit',
                        text: '提交',
                        visible: true,
                    }),
                ],
            }),
        ]);

        const issues = await detectComponentDiffIssues(0, mobilePage, twoInOnePage, 'mobile.png', '2in1.png');
        expect(issues).toHaveLength(0);
    });

    it('reports every field-level difference for matched components', async () => {
        const mobilePage = createPage([
            createComponent('Column', {
                key: 'container',
                children: [
                    createComponent('Button', {
                        key: 'btn_submit',
                        text: '提交',
                        visible: true,
                        bounds: [
                            { x: 10, y: 20 },
                            { x: 110, y: 80 },
                        ],
                    }),
                ],
            }),
        ]);

        const twoInOnePage = createPage([
            createComponent('Column', {
                key: 'container',
                children: [
                    createComponent('Button', {
                        key: 'btn_submit',
                        text: '确认',
                        visible: false,
                        bounds: [
                            { x: 12, y: 20 },
                            { x: 140, y: 86 },
                        ],
                    }),
                ],
            }),
        ]);

        const issues = await detectComponentDiffIssues(1, mobilePage, twoInOnePage, 'mobile.png', '2in1.png');
        expect(issues).toHaveLength(1);
        expect(issues[0].componentName).toBe('btn_submit');

        const structuralFields = issues[0].diffs.structuralDiffs.map((item) => item.field);
        const statusFields = issues[0].diffs.statusDiffs.map((item) => item.field);
        const textFields = issues[0].diffs.textDiffs.map((item) => item.field);

        expect(structuralFields).toContain('bounds');
        expect(statusFields).toContain('visible');
        expect(textFields).toContain('text');
    });
});
