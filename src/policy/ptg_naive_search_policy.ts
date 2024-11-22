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
import { ExitEvent } from '../event/system_event';
import { Event } from '../event/event';
import { Component, ComponentType } from '../model/component';
import { Hap } from '../model/hap';
import { Page } from '../model/page';
import { RandomUtils } from '../utils/random_utils';
import { MAX_NUM_RESTARTS, PTGPolicy } from './ptg_policy';
import { PolicyName } from './policy';
import { EventBuilder } from '../event/event_builder';
import { Rank } from '../model/rank';

export class PtgNaiveSearchPolicy extends PTGPolicy {
    private pageComponentMap: Map<string, Component[]>;

    constructor(device: Device, hap: Hap, name: PolicyName) {
        super(device, hap, name, true);
        this.retryCount = 0;
        this.pageComponentMap = new Map();
    }

    generateEventBasedOnPtg(): Event {
        this.updateState();
        let event = this.selectEvent();
        if (event === undefined) {
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
        if (!this.currentPage!.isForeground()) {
            return;
        }

        let pageSig = this.currentPage!.getContentSig();
        if (!this.pageComponentMap.has(pageSig)) {
            this.updatePreferableComponentRank(this.currentPage!);
            this.pageComponentMap.set(pageSig, this.currentPage!.getComponents());
        }
    }

    private selectEvent(): Event | undefined {
        let pageSig = this.currentPage!.getContentSig();
        let components = this.pageComponentMap.get(pageSig);
        if (!components) {
            return undefined;
        }

        // unexplored events
        let events = this.getPossibleEvents(components).filter((event) => {
            return !this.ptg.isEventExplored(event, this.currentPage!);
        });

        // sort by rank
        events.sort((a, b) => {
            return b.getRank() - a.getRank();
        });

        if (events.length > 0) {
            return this.arraySelect(events);
        }

        // from current page translate to unexpored page Event
        for (const page of this.ptg.getReachablePages(this.currentPage!)) {
            if (this.ptg.isPageExplored(page) || page.getBundleName() !== this.hap.bundleName) {
                continue;
            }

            let steps = this.ptg.getNavigationSteps(this.currentPage!, page);
            if (steps && steps.length > 0) {
                if (steps.length === 1) {
                    this.ptg.setWantTransition({ from: this.currentPage!, event: steps[0][1], to: page });
                } else {
                    this.ptg.setWantTransition({ from: this.currentPage!, event: steps[0][1], to: steps[1][0] });
                }

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
        if (components.length === 0) {
            return undefined;
        }

        if (this.randomInput) {
            RandomUtils.shuffle(components);
        }
        return components[0];
    }

    private getPossibleEvents(components: Component[]): Event[] {
        return EventBuilder.createPossibleUIEvents(components);
    }
}
