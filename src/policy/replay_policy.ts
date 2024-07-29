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

import fs from 'fs';
import { Device } from '../device/device';
import { Event } from '../event/event';
import { Hap } from '../model/hap';
import { Page } from '../model/page';
import { InputPolicy, PolicyName } from './input_policy';
import { ExitEvent } from '../event/system_event';
import path from 'path';
import { EventBuilder } from '../event/event_builder';

export class ReplayPolicy extends InputPolicy {
    steps:[Page, Event][];
    currentStep: number;
    
    constructor(device: Device, hap: Hap, name: PolicyName, reportRoot: string) {
        super(device, hap, name);
        this.steps = [];
        this.currentStep = 0;
        this.loadEvents(path.join(reportRoot, 'events'));
    }

    generateEvent(page: Page): Event {
        if (this.currentStep == this.steps.length) {
            this.stop();
            return new ExitEvent();
        }

        this.logger.info(page.getContentSig(), this.steps[this.currentStep][0].getContentSig());

        return this.steps[this.currentStep++][1];
    }

    private loadEvents(reportRoot: string) {
        if (!fs.existsSync(reportRoot)) {
            this.logger.error(`Path ${reportRoot} is not exists.`);
            process.exit();
        }

        let files = fs.readdirSync(reportRoot);
        for (let file of files) {
            let report = JSON.parse(fs.readFileSync(path.resolve(reportRoot, file), {encoding: 'utf-8'}));
            let event = EventBuilder.createEventFromJson(report.event);
            let page = Page.fromJson(report.page);
            this.steps.push([page, event]);
        }
    }
}
