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
import { UIEvent } from '../event/ui_event';
import { Event } from '../event/event';
import { Component, ComponentType } from '../model/component';
import { DeviceState } from '../model/device_state';
import { Hap, HapRunningState } from '../model/hap';
import { Page } from '../model/page';
import { RandomUtils } from '../utils/random_utils';
import { UTGInputPolicy } from './utg_input_policy';
import Logger from '../utils/logger';
import { PolicyFlag } from './input_policy';
import { EventBuilder } from '../event/event_builder';
import { Rank } from '../model/rank';
import { BACK_KEY_EVENT } from '../event/key_event';
const logger = Logger.getLogger();

export const MAX_NUM_RESTARTS = 5;
export class UtgNaiveSearchPolicy extends UTGInputPolicy {
    private retryCount: number;
    private pageStateMap: Map<string, Set<string>>;
    private stateMap: Map<string, DeviceState>;
    private stateComponentMap: Map<string, Component[]>;

    constructor(device: Device, hap: Hap) {
        super(device, hap, true);
        this.retryCount = 0;
        this.pageStateMap = new Map();
        this.stateMap = new Map();
        this.stateComponentMap = new Map();
    }

    generateEventBasedOnUtg(): Event {
        let runningState: HapRunningState | undefined;
        if (this.currentState.page.getBundleName() == this.hap.bundleName) {
            runningState = HapRunningState.FOREGROUND;
        } else {
            runningState = this.device.getHapRunningState(this.hap);
        }
        if (this.flag == PolicyFlag.FLAG_INIT) {
            if (runningState != undefined ) {
                this.flag |= PolicyFlag.FLAG_STOP_APP;
                return new StopHapEvent(this.hap.bundleName);
            }
        }

        if (runningState == undefined) {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                logger.error(`The number of HAP launch attempts exceeds ${MAX_NUM_RESTARTS}`);
                throw new Error('The HAP cannot be started.');
            }
            this.retryCount++;
            this.flag |= PolicyFlag.FLAG_START_APP;
            return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
        } else if (runningState == HapRunningState.FOREGROUND) {
            this.flag = PolicyFlag.FLAG_STARTED;
        } else {
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

    private updateState() {
        if (this.currentState.page.getBundleName() != this.hap.bundleName) {
            return;
        }

        if (!this.pageStateMap.has(this.getPageKey())) {
            this.pageStateMap.set(this.getPageKey(), new Set());
        }

        let stateSig = this.currentState.getPageContentSig();
        let stateSet = this.pageStateMap.get(this.getPageKey())!;
        if (!stateSet.has(stateSig)) {
            stateSet.add(stateSig);
            this.stateMap.set(stateSig, this.currentState);
        }

        if (!this.stateComponentMap.has(stateSig)) {
            let components: Component[] = [];
            this.updatePreferableComponentRank(this.currentState);
            for (const component of this.currentState.page.getComponents()) {
                if (component.hasUIEvent()) {
                    components.push(component);
                }
            }
            this.stateComponentMap.set(stateSig, components);
        }
    }

    private selectEvent(): Event | undefined {
        let stateSig = this.currentState.getPageContentSig();
        let components = this.stateComponentMap.get(stateSig);
        if (!components) {
            return undefined;
        }

        //unexplored events
        let events = this.getPossibleUIEvents(components).filter((event) => {
            return !this.utg.isEventExplored(event, this.currentState);
        });

        // sort by rank
        events.sort((a, b) => {
            return b.getRank() - a.getRank();
        });

        if (events.length > 0) {
            return this.arraySelect(events);
        }

        // from state translate to state Event
        for (const state of this.utg.getReachableStates(this.currentState)) {
            if (this.utg.isStateExplored(state) || state.page.getBundleName() != this.hap.bundleName) {
                continue;
            }

            let steps = this.utg.getNavigationSteps(this.currentState, state);
            if (steps && steps.length > 0) {
                return steps[0][1];
            }
        }

        if (!this.allPageExplored()) {
            return new StopHapEvent(this.hap.bundleName);
        }

        return undefined;
    }

    private updatePreferableComponentRank(state: DeviceState): void {
        for (const component of state.page.selectComponentsByType([ComponentType.ModalPage, ComponentType.Dialog])) {
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

    private getPageKey(): string {
        return `${this.currentState.page.getAbilityName()}:${this.currentState.page.getPagePath()}`;
    }

    private getPossibleUIEvents(components: Component[]): UIEvent[] {
        let events: UIEvent[] = [];
        for (const component of components) {
            events.push(...EventBuilder.createPossibleUIEvents(component));
        }
        return events;
    }

    private allPageExplored(): boolean {
        for (const pageKey of this.pageStateMap.keys()) {
            if (!this.isPageExplored(pageKey)) {
                return false;
            }
        }
        return true;
    }

    private isPageExplored(pageKey: string): boolean {
        for (const stateSig of this.pageStateMap.get(pageKey)!) {
            let state = this.stateMap.get(stateSig)!;
            if (!this.utg.isStateExplored(state)) {
                return false;
            }
        }

        return true;
    }
}
