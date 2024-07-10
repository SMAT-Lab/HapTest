import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { PageBuilder } from '../../src/model/builder/page_builder';
import { SerializeUtils } from '../../src/utils/serialize_utils';
import { CombinedKeyEvent } from '../../src/event/key_event';
import { KeyCode } from '../../src/model/key_code';

describe('SerializeUtils Test', () => {
    it('test Component()', async () => {
        let [mainPage, _] = PageBuilder.buildPagesFromDumpLayoutFile(
            path.join(__dirname, '../resource/layout_modalpage.json')
        );
        expect(SerializeUtils.serialize(mainPage.getRoot()).length).eq(380);

        let json = mainPage.getContent();
        expect(json.length).eq(20818);
    });

    it('test event', async () => {
        let event = new CombinedKeyEvent(KeyCode.KEYCODE_POWER, KeyCode.KEYCODE_VOLUME_UP);
        expect(SerializeUtils.serialize(event)).eq('{"keyCode":18,"type":"CombinedKeyEvent","keyCode1":16}');
    })
});
