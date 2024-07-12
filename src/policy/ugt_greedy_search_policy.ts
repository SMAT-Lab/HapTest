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

import { Hap, HapRunningState } from '../model/hap';
import { UTGInputPolicy } from './utg_input_policy';
import { Device } from '../device/device';
import { Event } from '../event/event';
import { KeyEvent } from '../event/key_event';
import { DeviceState } from '../model/device_state';
import { ExitEvent, StopHapEvent, AbilityEvent } from '../event/system_event';
import { BACK_KEY_EVENT } from '../event/key_event';
import { RandomUtils } from '../utils/random_utils';
import { Component , ComponentType} from '../model/component';
import { EventBuilder } from '../event/event_builder';
import { Page } from '../model/page';
import { Rank } from '../model/rank';
import Logger from '../utils/logger';
import { PolicyFlag } from './input_policy';

const logger = Logger.getLogger();

enum PolicyGreedy {
    DFS_GREEDY = "greedy_dfs",
    BFS_GREEDY = "greedy_bfs" 
}

export const MAX_NUM_RESTARTS = 5;

/**
 * DFS/BFS (according to search_method) strategy to explore UFG (new)
 */
export class UtgGreedySearchPolicy extends UTGInputPolicy{

    private retryCount: number;
    private pageStateMap: Map<string, Set<string>>;
    private stateMap: Map<string, DeviceState>;
    private stateComponentMap: Map<string, Component[]>;
    // search strategy
    private searchMethod: String;
    // priority button list
    // private preferredButtons : string [];
    // whether to use random exploration mode
    // private randomExplore : Boolean;

    private missedStates : Map<string, DeviceState>;

    private navTarget: DeviceState | null = null;;
    // private navNumSteps :number;

    constructor(device: Device, hap: Hap, search_method: String) {
        super(device, hap, true);
        this.retryCount = 0;
        this.searchMethod = search_method;
        // this.navNumSteps = -1;
        // this.preferredButtons = ["yes", "ok", "activate", "detail", "more", "access","allow", "check", "agree", "try", "go", "next"];
        // this.randomExplore = false;
        this.missedStates = new Map();
        this.pageStateMap = new Map();
        this.stateMap = new Map();
        this.stateComponentMap = new Map();
    }
   
    /**
     * Generate an event based on current UTG.
     * 
     * @returns {Event} The generated Event object.
     */
    generateEventBasedOnUtg(): Event {
        logger.info(`Current state: ${this.currentState.udid}`);
    
        if( this.missedStates.has(this.currentState.udid) ){
            this.missedStates.delete(this.currentState.udid)
        }

        let runningState: HapRunningState | undefined;
        if (this.currentState.page.getBundleName() == this.hap.bundleName) {
            runningState = HapRunningState.FOREGROUND;
        } else {
            runningState = this.device.getHapRunningState(this.hap);
        }
        if (this.flag == PolicyFlag.FLAG_INIT) {
            if (runningState != undefined) {
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

        let events: Event[] = [];
        
        events.push(...this.currentState.getPossibleUIEvents());

        // sort by rank
        events.sort((a, b) => {
            return a.getRank() - b.getRank();
        });

        if (events.length > 0) {
            if (events.length == 0) {
                return undefined;
            }
        }

        if( this.searchMethod == PolicyGreedy.BFS_GREEDY){
            events.unshift(BACK_KEY_EVENT);
        } else if( this.searchMethod == PolicyGreedy.DFS_GREEDY ){
            events.push(BACK_KEY_EVENT);
        } 

        if (this.randomInput) {
            RandomUtils.shuffle(events);
        }

        // If there is an unexplored event, try the event first
        for( const event of events){
            if( !this.utg.isEventExplored(event, this.currentState) ){
                if( event instanceof KeyEvent ){
                    if( this.currentState.page.getBundleName() == this.hap.bundleName || this.currentState.page.isHome()){
                        continue;
                    }
                }
                logger.info(`Trying an unexplored event.`);
                return event
            }
        }

        let targetState = this.getNavTarget();
        if( targetState != undefined ){
            let navSteps = this.utg.getNavigationSteps(this.currentState,targetState);
            if( navSteps && navSteps.length > 0){
                return navSteps[0][1];
            }
        }

        if (!this.allPageExplored()) {
            return new StopHapEvent(this.hap.bundleName);
        }

        return undefined;
    }

    private getNavTarget(): DeviceState | undefined {

        if( this.navTarget ){
            if( this.lastState.page == this.navTarget.page ){
                let stateSig = this.navTarget.getPageContentSig();
                this.missedStates.set(stateSig,this.navTarget);
            }
        }
        // from state translate to state Event
        let reachableStates: DeviceState[] = this.utg.getReachableStates(this.currentState);
        for (const state of reachableStates) {
            // Only consider foreground states
            if( this.device.getHapRunningState(this.hap) != HapRunningState.FOREGROUND ){
                continue;
            }
            // Do not consider missed states
            if( this.missedStates.has(state.getPageContentSig())){
                continue;
            }
            // Do not consider explored states
            if (this.utg.isStateExplored(state)) {
                continue;
            }

            this.navTarget = state;
            let steps = this.utg.getNavigationSteps(this.currentState, this.navTarget);
            if (steps && steps.length > 0) {
                return state;
            }    
            
        }
        this.navTarget = null;
        return undefined;
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

    private getPageKey(): string {
        return `${this.currentState.page.getAbilityName()}:${this.currentState.page.getPagePath()}`;
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

}