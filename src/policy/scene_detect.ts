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
import { findFiles } from '../utils/file_utils';
import * as fs from 'fs';
import { Page } from '../model/page';
import { Component } from '../model/component';
import { UIEvent } from '../event/ui_event';
import { Event } from '../event/event';
import { EventBuilder } from '../event/event_builder';

export interface SceneDetectionModel {
    events: any[];
}

export class SceneDetect {
    models: Map<string, SceneDetectionModel>;
    matchedPages: Map<string, UIEvent[]>;
    matchedPagesEventIdx: Map<string, number>;

    constructor() {
        this.models = new Map();
        this.matchedPages = new Map();
        this.matchedPagesEventIdx = new Map();

        this.loadDetectionModel();
    }

    private loadDetectionModel() {
        let modelFiles = findFiles(path.join(__dirname, '..', '..', 'config', 'scene_detection_model'), ['.json']);
        for (const file of modelFiles) {
            this.models.set(path.basename(file), JSON.parse(fs.readFileSync(file, { encoding: 'utf-8' })));
        }
    }

    generateEventBasedOnModel(page: Page): Event | undefined {
        let sig = page.getStructualSig();
        if (!this.matchedPages.has(sig)) {
            let events = this.match(page);
            if (events.length == 0) {
                return undefined;
            }
            this.matchedPages.set(sig, events);
            this.matchedPagesEventIdx.set(sig, 0);
        }

        let events = this.matchedPages.get(sig)!;
        let idx = this.matchedPagesEventIdx.get(sig)!;
        let event = events[idx++];
        this.matchedPagesEventIdx.set(sig, idx);
        return event;
    }

    private match(page: Page): UIEvent[] {
        let idComponentMap = new Map<string, Component>();
        for (const component of page.getComponents()) {
            idComponentMap.set(component.uniqueId, component);
        }
        let events: UIEvent[] = [];
        for (const [_, value] of this.models) {
            events = [];
            for (const event of value.events) {
                let component = new Component();
                component.type = event.component.type;
                component.bounds = event.component.bounds;
                if (!idComponentMap.has(component.uniqueId)) {
                    break;
                }

                let target = idComponentMap.get(component.uniqueId);
                event.component = target;
                events.push(EventBuilder.createEventFromJson(event) as UIEvent);
            }

            if (events.length != value.events.length) {
                // not match clear
                events = [];
            } else {
                // matched
                break;
            }
        }
        return events;
    }
}
