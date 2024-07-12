import Logger from '../utils/logger';
import { UTGInputPolicy } from './utg_input_policy';
import { Device } from '../device/device';
import { Hap } from '../model/hap';
import { Event } from '../event/event';
import { DeviceState } from '../model/device_state';
import { AbilityEvent, ExitEvent, StopHapEvent } from '../event/system_event';
import { PolicyFlag } from './input_policy';
import { BACK_KEY_EVENT } from '../event/key_event';
import { RandomUtils } from '../utils/random_utils';
import { Component , ComponentType} from '../model/component';
import { EventBuilder } from '../event/event_builder';
import { Page } from '../model/page';
import { Rank } from '../model/rank';

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
    // unexplored set of states
    private missedStates : Map<string, DeviceState>;
    // whether to use random exploration mode
    // private randomExplore : Boolean;

    // private navTarget: DeviceState | null = null;;
    // private navNumSteps :number;

    constructor(device: Device, hap: Hap, search_method: String) {
        super(device, hap, true);
        this.retryCount = 0;
        this.searchMethod = search_method;
        // this.navNumSteps = -1;
        // this.preferredButtons = ["yes", "ok", "activate", "detail", "more", "access","allow", "check", "agree", "try", "go", "next"];
        this.missedStates = new Map();
        // this.randomExplore = false;
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

        let hapIsForeground = this.device.isForeground(this.hap);
        if ((this.flag & PolicyFlag.FLAG_START_APP) == 0) {
            if (hapIsForeground) {
                this.flag |= PolicyFlag.FLAG_STOP_APP;
                return new StopHapEvent(this.hap.bundleName);
            } else {
                this.flag |= PolicyFlag.FLAG_START_APP;
                this.retryCount++;
                return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
            }
        }

        if ((this.flag & PolicyFlag.FLAG_STARTED) == 0) {
            if (!hapIsForeground) {
                // check start app count
                if (this.retryCount > MAX_NUM_RESTARTS) {
                    logger.error(`The number of HAP launch attempts exceeds ${MAX_NUM_RESTARTS}`);
                    throw new Error('The HAP cannot be started.');
                }
                this.retryCount++;
                return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
            } else {
                this.retryCount = 0;
                this.flag |= PolicyFlag.FLAG_STARTED;
            }
        }

        if (!hapIsForeground) {
            return BACK_KEY_EVENT;
        }

        this.updateState();

        // Get all possible input events
        let possibleEvents = this.getPossibleEvents();

        if (possibleEvents == undefined) {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                this.stop();
                return new ExitEvent();
            }
            this.retryCount++;
            return EventBuilder.createRandomTouchEvent(this.device);
        }
        this.retryCount = 0;

        return possibleEvents;
    }

    private getPossibleEvents(): Event | undefined {

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
            if (this.randomInput) {
                RandomUtils.shuffle(events);
            }
        }

        if( this.searchMethod == PolicyGreedy.BFS_GREEDY ){
            events.unshift(BACK_KEY_EVENT);
        } else if( this.searchMethod == PolicyGreedy.DFS_GREEDY ){
            events.push(BACK_KEY_EVENT);
        }

        // If there is an unexplored event, try the event first
        for( const event of events){
            if( !this.utg.isEventExplored(event, this.currentState) ){
                logger.info(`Trying an unexplored event.`);
                return event
            }
        }

        // from state translate to state Event
        for (const state of this.utg.getReachableStates(this.currentState)) {
            if (this.utg.isStateExplored(state)) {
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