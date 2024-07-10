import { vi, describe, it, expect } from 'vitest';
import { Hdc } from '../../src/device/hdc';
import * as path from 'path';
import fs from 'fs';

const MOCK_SHELL_OUTPUT_GetScreenSize = fs.readFileSync(path.join(__dirname, '../resource/hidumper_screen.txt'), {
    encoding: 'utf-8',
});
const MOCK_SHELL_GetForegroundProcess = fs.readFileSync(path.join(__dirname, '../resource/aa_dump.txt'), {
    encoding: 'utf-8',
});

describe('hdc Test', () => {
    let hdc = new Hdc();

    it('test getForegroundProcess', async () => {
        hdc.excuteShellCommand = vi.fn().mockReturnValue(MOCK_SHELL_GetForegroundProcess);
        let process = hdc.getForegroundProcess();
        expect(process.has('com.huawei.hmsapp.himovie')).eq(true);
    });

    it('test getScreenSize', async () => {
        hdc.excuteShellCommand = vi.fn().mockReturnValue(MOCK_SHELL_OUTPUT_GetScreenSize);
        let size = hdc.getScreenSize();
        expect(size.x).eq(1344);
        expect(size.y).eq(2772);
    });
});
