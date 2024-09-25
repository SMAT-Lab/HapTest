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

import { vi, describe, it, expect } from 'vitest';
import { Hdc } from '../../src/device/hdc';
import * as path from 'path';
import fs from 'fs';

const MOCK_SHELL_OUTPUT_GetForegroundProcess = fs.readFileSync(path.join(__dirname, '../resource/aa_dump.txt'), {
    encoding: 'utf-8',
});
const MOCK_SHELL_OUTPUT_Netstat = fs.readFileSync(path.join(__dirname, '../resource/netstat.txt'), {
    encoding: 'utf-8',
});
describe('hdc Test', async () => {
    let hdc = new Hdc();

    it('test getForegroundProcess', async () => {
        hdc.excuteShellCommand = vi.fn().mockReturnValueOnce(MOCK_SHELL_OUTPUT_GetForegroundProcess);
        let process = hdc.getRunningProcess();
        expect(process.has('com.huawei.hmsapp.himovie')).eq(true);
    });

    it('test netstatInfo', async () => {
        hdc.excuteShellCommand = vi.fn().mockReturnValue(MOCK_SHELL_OUTPUT_Netstat);
        let info = hdc.netstatInfo();
        expect(info.has(60000)).eq(true);
    });
});
