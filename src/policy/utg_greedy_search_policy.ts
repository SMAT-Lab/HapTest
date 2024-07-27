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

import { Hap } from '../model/hap';
import { UTGInputPolicy } from './utg_input_policy';
import { Device } from '../device/device';
import { Event } from '../event/event';
import { InputTextEvent } from '../event/ui_event';
import { ExitEvent, StopHapEvent, AbilityEvent } from '../event/system_event';
import { BACK_KEY_EVENT } from '../event/key_event';
import { RandomUtils } from '../utils/random_utils';
import { Component, ComponentType } from '../model/component';
import { EventBuilder } from '../event/event_builder';
import { Page } from '../model/page';
import { Rank } from '../model/rank';
import Logger from '../utils/logger';
import { PolicyFlag, PolicyName } from './input_policy';

const logger = Logger.getLogger();

export const MAX_NUM_RESTARTS = 5;

/**
 * DFS/BFS (according to search_method) strategy to explore UFG (new)
 */
export class UtgGreedySearchPolicy extends UTGInputPolicy {
    private retryCount: number;
    private pageMap: Map<string, Page>;
    private pageComponentMap: Map<string, Component[]>;
    private selectComponentMap: Map<string, Component[]>;

    private isNewPage: boolean;
    private inputComponents: string[] = [];

    constructor(device: Device, hap: Hap, name: PolicyName) {
        super(device, hap, name, true);
        this.retryCount = 0;
        this.isNewPage = false;
        this.pageMap = new Map();
        this.pageComponentMap = new Map();
        this.inputComponents = [];

        this.selectComponentMap = new Map<string, Component[]>();
    }

    /**
     * Generate an event based on current UTG.
     *
     * @returns {Event} The generated Event object.
     */
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
            return BACK_KEY_EVENT;
        }

        this.updateState();

        // Get all possible input events
        let possibleEvent = this.getPossibleEvent();

        if (possibleEvent == undefined) {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                this.stop();
                return new ExitEvent();
            }
            this.retryCount++;
            return EventBuilder.createRandomTouchEvent(this.device);
        }
        this.retryCount = 0;

        return possibleEvent;
    }

    private getPossibleEvent(): Event | undefined {
        let components: Component[] = this.currentPage.getComponents();
        let pageString: string = this.currentPage.getContentSig();

        // get the sorted components
        if (this.selectComponentMap.has(pageString)) {
            components = this.selectComponentMap.get(pageString) || [];
        } else {
            components = this.getRankedComponent(components);
            this.selectComponentMap.set(pageString, components);
        }

        let events: Event[] = EventBuilder.createPossibleUIEvents(components);

        if (events.length == 0) {
            return undefined;
        }

        if (this.randomInput) {
            RandomUtils.shuffle(events);
        }

        if (this.isNewPage) {
            if (this.name == PolicyName.BFS_GREEDY) {
                events.unshift(BACK_KEY_EVENT);
                if (components.length > 0) {
                    let firstElement = components.splice(0, 1)[0];
                    components.push(firstElement);
                    this.selectComponentMap.set(pageString, components);
                }
            } else if (this.name == PolicyName.DFS_GREEDY) {
                events.push(BACK_KEY_EVENT);
            }
        }

        // If there is an unexplored event, try the event first
        for (const event of events) {
            if (event instanceof InputTextEvent && event.getComponentId() != undefined) {
                const componentId = event.getComponentId();
                if (componentId != undefined && this.inputComponents.includes(componentId)) {
                    continue;
                }
                if (componentId != undefined) {
                    this.inputComponents.push(componentId);
                }
            }

            if (!this.utg.isEventExplored(event, this.currentPage)) {
                return event;
            }
        }

        return undefined;
    }

    private getRankedComponent(components: Component[]): Component[] {
        const rankedComponents: Component[] = [];
        const filteredComponents = components.filter((component) => component.enabled);
        filteredComponents.sort((a, b) => {
            let countA =
                (a.checkable ? 2 : 0) + (a.clickable ? 2 : 0) + (a.longClickable ? 2 : 0) + (a.scrollable ? 2 : 0);
            let countB =
                (a.checkable ? 2 : 0) + (a.clickable ? 2 : 0) + (a.longClickable ? 2 : 0) + (a.scrollable ? 2 : 0);
            if (a.inputable) countA = countA + 1;
            if (b.inputable) countB = countB + 1;

            return countB - countA;
        });

        rankedComponents.push(
            ...filteredComponents.filter((c) => {
                let count =
                    (c.checkable ? 2 : 0) + (c.clickable ? 2 : 0) + (c.longClickable ? 2 : 0) + (c.scrollable ? 2 : 0);
                if (c.inputable) count += 2;
                return count > 0;
            })
        );
        return rankedComponents;
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
}
