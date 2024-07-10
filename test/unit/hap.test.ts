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