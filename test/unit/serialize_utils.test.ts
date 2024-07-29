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

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { PageBuilder } from '../../src/model/builder/page_builder';
import { SerializeUtils } from '../../src/utils/serialize_utils';
import { CombinedKeyEvent } from '../../src/event/key_event';
import { KeyCode } from '../../src/model/key_code';
import { Page } from '../../src/model/page';

describe('SerializeUtils Test', () => {
    it('test Component()', async () => {
        let [mainPage, _] = PageBuilder.buildPagesFromDumpLayoutFile(
            path.join(__dirname, '../resource/layout_modalpage.json')
        );
        expect(SerializeUtils.serialize(mainPage.getRoot()).length).eq(380);

        let json = mainPage.getContent();
        expect(json.length).eq(20827);

        json = SerializeUtils.serialize(mainPage, { groups: ['Content'] });
        let page = SerializeUtils.plainToInstance(Page, JSON.parse(json), { groups: ['Content'] });
        expect(mainPage.getContentSig()).eq(page.getContentSig());
    });

    it('test event', async () => {
        let event = new CombinedKeyEvent(KeyCode.KEYCODE_POWER, KeyCode.KEYCODE_VOLUME_UP);
        expect(SerializeUtils.serialize(event)).eq('{"keyCode":18,"type":"CombinedKeyEvent","keyCode1":16}');
    });
});
