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
import { HapBuilder } from '../../src/model/builder/hap_builder';
import * as path from 'path';

describe('HapBuilder Test', () => {
    it('test buildFromHapFile()', async () => {
        let hap = HapBuilder.buildFromHapFile(path.join(__dirname, '../resource/test.hap'));
        expect(hap.bundleName).eq('com.example.instrumentdemo');
        expect(hap.mainAbility).eq('EntryAbility');
        expect(hap.versionCode).eq(1000000);
    });
});