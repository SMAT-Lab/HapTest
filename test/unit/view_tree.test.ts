import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { PageBuilder } from '../../src/model/builder/page_builder';
import { Page } from '../../src/model/page';

describe('ViewTree Test', () => {
    it('test dumpLayout', async () => {
        let [mainPage, _] = PageBuilder.buildPagesFromDumpLayoutFile(
            path.join(__dirname, '../resource/layout_modalpage.json')
        );
        let modalPage = mainPage.getModalPage();
        expect(modalPage.length).eq(1);
        let clickableBtns = Page.collectComponent(modalPage[0], (item): boolean => {
            return item.clickable;
        });

        expect(clickableBtns.length).eq(3);
    });
});
