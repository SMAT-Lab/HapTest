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

import path from 'path';
import fs from 'fs';
import moment from 'moment';
import { Device } from '../device/device';
import { Event } from '../event/event';
import { Hap } from '../model/hap';
import { SerializeUtils } from '../utils/serialize_utils';
import { Page } from '../model/page';
import { getLogger } from 'log4js';
const logger = getLogger();

export class EventAction {
    device: Device;
    hap: Hap;
    event: Event;
    eventPageSig: string;
    fromPage: Page;
    toPage: Page;
    output: string;

    constructor(device: Device, hap: Hap, page: Page, event: Event) {
        this.device = device;
        this.hap = hap;
        this.fromPage = page;
        this.event = event;
        this.output = path.join(device.getOutput(), 'events');
        if (!fs.existsSync(this.output)) {
            fs.mkdirSync(this.output, { recursive: true });
        }
    }

    start() {
        logger.info(`EventAction->start: ${this.event.toString()}`);
        this.eventPageSig = this.event.eventPageSig(this.fromPage);
        this.device.sendEvent(this.event);
    }

    stop() {
        this.toPage = this.device.getCurrentPage(this.hap);
        this.save();
    }

    toString(): string {
        return SerializeUtils.serialize(
            {
                event: this.event,
                page: this.fromPage.toJson(),
                event_page_sig: this.eventPageSig,
                from_page: this.fromPage?.getContentSig(),
                to_page: this.toPage?.getContentSig(),
            },
            undefined,
            4
        );
    }

    private save() {
        let now = moment();
        let file = path.join(this.output, `event_${now.format('YYYY-MM-DD-HH-mm-ss-SSS')}.json`);
        fs.writeFileSync(file, this.toString());
    }
}
