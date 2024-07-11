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

import { Device } from '../device/device';
import { EventBuilder } from '../event/event_builder';
import { UIEvent } from '../event/ui_event';
import { CryptoUtils } from '../utils/crypto_utils';
import { SerializeUtils } from '../utils/serialize_utils';
import { Page } from './page';


export class DeviceState {
    /** UI component page */
    page: Page;
    /** cap screen path */
    screen: string;
    /** fault logs in device */
    faultLogs: Set<string>;

    originLogs: Set<string>;

    udid: string;
    width: number;
    height: number;

    constructor(device: Device, page: Page, screen: string, originLogs: Set<string>) {
        this.udid = device.getUdid();
        this.width = device.getWidth();
        this.height = device.getHeight();
        this.page = page;
        this.screen = screen;
        this.originLogs = originLogs;
        this.faultLogs = new Set();
    }

    toJson(): Record<string, any> {
        return SerializeUtils.instanceToPlain({
            udid: this.udid,
            width: this.width,
            height: this.height,
            page: this.page.toJson(),
            screen: this.screen,
            faultLogs: this.faultLogs,
        })
    }

    setFaultLogs(to: DeviceState | undefined): void {
        if (!to) {
            return ;
        }
        for (let log of to.originLogs) {
            if (!this.originLogs.has(log)) {
                this.faultLogs.add(log);
            }
        }
    }

    getPageContentSig(): string {
        return CryptoUtils.sha256(this.getPageContent());
    }

    getPageContent(): string {
        return this.page.getContent();
    }

    getPageStructureSig(): string {
        return CryptoUtils.sha256(this.getPageStructure());
    }

    getPageStructure(): string {
        return this.page.getStructual();
    }

    getPossibleUIEvents(): UIEvent[] {
        let events: UIEvent[] = [];
        for (const component of this.page.getComponents()) {
            events.push(...EventBuilder.createPossibleUIEvents(component));
        }
        return events;
    }
}
