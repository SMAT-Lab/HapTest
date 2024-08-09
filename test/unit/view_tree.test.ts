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

    it('test close keyboard', async () => {
        let pages = PageBuilder.buildPagesFromDumpLayoutFile(path.join(__dirname, '../resource/layout_normal_keyboard.json'));
        for (const page of pages) {
            if (page.getBundleName() == 'com.huawei.hmos.inputmethod') {
                let components = page.getComponents().filter((value) => {
                    return value.hasUIEvent();
                })
                expect(components.length).eq(15);
                components = components.sort((a, b) => {
                    if (a.bounds[0].y != b.bounds[0].y) {
                        return a.bounds[0].y - b.bounds[0].y;
                    }

                    return a.bounds[0].x - b.bounds[0].x;
                })

                expect(components[2].bounds[0].x).eq(1153);
            }
        }
    })
});
