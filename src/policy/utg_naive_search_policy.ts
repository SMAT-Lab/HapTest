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
import { AbilityEvent, ExitEvent, StopHapEvent } from '../event/system_event';
import { Event } from '../event/event';
import { Component, ComponentType } from '../model/component';
import { Hap } from '../model/hap';
import { Page } from '../model/page';
import { RandomUtils } from '../utils/random_utils';
import { UTGInputPolicy } from './utg_input_policy';
import { PolicyFlag, PolicyName } from './input_policy';
import { EventBuilder } from '../event/event_builder';
import { Rank } from '../model/rank';
import { BACK_KEY_EVENT, KeyEvent } from '../event/key_event';
import { KeyCode } from '../model/key_code';
import Logger from '../utils/logger';
const logger = Logger.getLogger();

export const MAX_NUM_RESTARTS = 5;
export class UtgNaiveSearchPolicy extends UTGInputPolicy {
    private retryCount: number;
    private pageMap: Map<string, Page>;
    private pageComponentMap: Map<string, Component[]>;
    private isNewPage: boolean;

    constructor(device: Device, hap: Hap, name: PolicyName) {
        super(device, hap, name, true);
        this.retryCount = 0;
        this.pageMap = new Map();
        this.pageComponentMap = new Map();
        this.isNewPage = false;
    }

    generateEventBasedOnUtg(): Event {
        if (this.flag == PolicyFlag.FLAG_INIT) {
            if (!this.currentPage.isStop()) {
                this.flag |= PolicyFlag.FLAG_STOP_APP;
                return new StopHapEvent(this.hap.bundleName);
            }
        }

        if (this.currentPage.isStop()) {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                logger.error(`The number of HAP launch attempts exceeds ${MAX_NUM_RESTARTS}`);
                throw new Error('The HAP cannot be started.');
            }
            this.retryCount++;
            this.flag |= PolicyFlag.FLAG_START_APP;
            return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
        } else if (this.currentPage.isForeground()) {
            this.flag = PolicyFlag.FLAG_STARTED;
        } else {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                this.flag |= PolicyFlag.FLAG_STOP_APP;
                this.retryCount = 0;
                return new StopHapEvent(this.hap.bundleName);
            }
            this.retryCount++;
            return BACK_KEY_EVENT;
        }

        this.updateState();

        let event = this.selectEvent();
        if (event == undefined) {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                this.stop();
                return new ExitEvent();
            }
            this.retryCount++;
            return EventBuilder.createRandomTouchEvent(this.device);
        }
        this.retryCount = 0;

        return event;
    }

    private updateState(): void {
        if (this.currentPage.getBundleName() != this.hap.bundleName) {
            return;
        }

        let pageSig = this.currentPage.getContentSig();
        if (!this.pageMap.has(pageSig)) {
            this.pageMap.set(pageSig, this.currentPage);
        }

        if (!this.pageComponentMap.has(pageSig)) {
            let components: Component[] = [];
            this.updatePreferableComponentRank(this.currentPage);
            for (const component of this.currentPage.getComponents()) {
                if (component.hasUIEvent()) {
                    components.push(component);
                }
            }
            this.pageComponentMap.set(pageSig, components);
        }
    }

    private selectEvent(): Event | undefined {
        let pageSig = this.currentPage.getContentSig();
        let components = this.pageComponentMap.get(pageSig);
        if (!components) {
            return undefined;
        }

        //unexplored events
        let events = this.getPossibleEvents(components).filter((event) => {
            return !this.utg.isEventExplored(event, this.currentPage);
        });

        // sort by rank
        events.sort((a, b) => {
            return b.getRank() - a.getRank();
        });

        if (events.length > 0) {
            return this.arraySelect(events);
        }

        // from current page translate to unexpored page Event
        for (const page of this.utg.getReachablePages(this.currentPage)) {
            if (this.utg.isPageExplored(page) || page.getBundleName() != this.hap.bundleName) {
                continue;
            }

            let steps = this.utg.getNavigationSteps(this.currentPage, page);
            if (steps && steps.length > 0) {
                return steps[0][1];
            }
        }

        return undefined;
    }

    private updatePreferableComponentRank(page: Page): void {
        for (const component of page.selectComponentsByType([ComponentType.Dialog])) {
            Page.collectComponent(component, (item) => {
                if (item.hasUIEvent()) {
                    item.rank = Rank.HIGH;
                }
                return item.hasUIEvent();
            });
        }
    }

    private arraySelect<T>(components: T[]): T | undefined {
        if (components.length == 0) {
            return undefined;
        }

        if (this.randomInput) {
            RandomUtils.shuffle(components);
        }
        return components[0];
    }

    private getPossibleEvents(components: Component[]): Event[] {
        let events: Event[] = EventBuilder.createPossibleUIEvents(components);
        if (this.isNewPage) {
            let back = new KeyEvent(KeyCode.KEYCODE_BACK);
            if (this.name == PolicyName.BFS_NAIVE) {
                back.setRank(Rank.URGENT);
            } else {
                back.setRank(Rank.LOW);
            }
            events.push(back);
        }
        return events;
    }
}
