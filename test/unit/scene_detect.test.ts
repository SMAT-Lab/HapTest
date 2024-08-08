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
import { SceneDetect } from '../../src/policy/scene_detect';
import { PageBuilder } from '../../src/model/builder/page_builder';
import path from 'path';
import { InputTextEvent, TouchEvent } from '../../src/event/ui_event';

describe('SceneDetect Test', () => {
    it('test init()', async () => {
        let detect = new SceneDetect();
        expect(detect.models.get('login.json')!.events.length).eq(3);
        let [page, _] = PageBuilder.buildPagesFromDumpLayoutFile(path.join(__dirname, '../resource/layout_login.json'));

        let event1 = detect.generateEventBasedOnModel(page) as InputTextEvent;
        expect(event1.getText()).eq('admin');
        let event2 = detect.generateEventBasedOnModel(page) as InputTextEvent;
        expect(event2.getText()).eq('123456');
        let event3 = detect.generateEventBasedOnModel(page) as TouchEvent;
        expect(event3);
        let event4 = detect.generateEventBasedOnModel(page);
        expect(event4).eq(undefined);
    });
});
