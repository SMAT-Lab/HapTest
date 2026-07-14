import { describe, expect, it, vi } from 'vitest';
import { Device } from '../../src/device/device';
import { ExitEvent, StopHapEvent } from '../../src/event/system_event';
import { Component } from '../../src/model/component';
import { Hap } from '../../src/model/hap';
import { Page } from '../../src/model/page';
import { ViewTree } from '../../src/model/viewtree';
import { PolicyName } from '../../src/policy/policy';
import { PTGPolicy } from '../../src/policy/ptg_policy';
import { SceneDetect } from '../../src/policy/scene_detect';

class TestPTGPolicy extends PTGPolicy {
    generateEventBasedOnPtg(): ExitEvent {
        return new ExitEvent();
    }
}

function createForegroundPage(): Page {
    const root = new Component();
    root.type = 'Root';
    root.bounds = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
    ];
    return new Page(new ViewTree(root), 'MainAbility', 'com.example.demo', 'pages/Home');
}

function createPolicy(startFromCurrentPage: boolean): TestPTGPolicy {
    const device = {
        getOptions: () => ({ startFromCurrentPage }),
        getOutput: () => '/tmp/haptest-test-output',
    } as unknown as Device;
    const hap = new Hap();
    hap.bundleName = 'com.example.demo';
    hap.mainAbility = 'MainAbility';

    return new TestPTGPolicy(device, hap, PolicyName.NAIVE, true);
}

describe('PTGPolicy current page start mode', () => {
    it('keeps the first foreground page and does not emit StopHapEvent when startFromCurrentPage is enabled', async () => {
        const page = createForegroundPage();
        const policy = createPolicy(true);
        const sceneSpy = vi
            .spyOn(SceneDetect.prototype, 'generateEventBasedOnModel')
            .mockReturnValue(undefined);

        const event = await policy.generateEvent(page);

        expect(event).toBeInstanceOf(ExitEvent);
        expect(event).not.toBeInstanceOf(StopHapEvent);
        sceneSpy.mockRestore();
    });

    it('keeps the legacy stop-first behavior when startFromCurrentPage is disabled', async () => {
        const page = createForegroundPage();
        const policy = createPolicy(false);

        const event = await policy.generateEvent(page);

        expect(event).toBeInstanceOf(StopHapEvent);
    });
});