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
import path from 'path';
import fs from 'fs';
import {PerfReport} from '../../src/device/perf/perf_report';

describe('Perf Test', () => {
    it('test Perf data parse()', async () => {
        let json = JSON.parse(fs.readFileSync(path.join(__dirname, '../resource/perf.json'), {encoding: 'utf-8'}))
        let perf = new PerfReport(json);
        let sumData = perf.getProcessSumData('com.ss.hm.article.news');
        expect(sumData[0].instructions).eq(11775203);
        expect(sumData[0].cycles).eq(62313005);

        let detail = perf.getProcessFunctionData('com.ss.hm.article.news');
        expect(detail.length).eq(1981);
    });
});