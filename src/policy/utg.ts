import { Device } from '../device/device';
import { Event } from '../event/event';
import { Hap } from '../model/hap';
import { DeviceState } from '../model/device_state';
import DirectedGraph from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import Logger from '../utils/logger';
import { RandomUtils } from '../utils/random_utils';
const logger = Logger.getLogger();

type EdgeAttributeType = Map<string, { id: number; event: Event }>;

/**
 * UI transition graph
 */
export class UTG {
    device: Device;
    hap: Hap;
    randomInput: boolean;
    transitions: [DeviceState, Event, DeviceState][];
    contentStateGraph: DirectedGraph<DeviceState, EdgeAttributeType>;
    structualStateGraph: DirectedGraph<DeviceState[], EdgeAttributeType>;
    ineffectiveEvent: Set<string>;
    effectiveEvent: Set<string>;
    exploredState: Set<string>;
    reachedState: Set<string>;
    reachedPages: Set<string>;
    firstState: DeviceState;
    lastState: DeviceState;

    constructor(device: Device, hap: Hap, randomInput: boolean) {
        this.device = device;
        this.hap = hap;
        this.randomInput = randomInput;
        this.transitions = [];
        this.contentStateGraph = new DirectedGraph();
        this.structualStateGraph = new DirectedGraph();
        this.ineffectiveEvent = new Set();
        this.effectiveEvent = new Set();
        this.exploredState = new Set();
        this.reachedState = new Set();
        this.reachedPages = new Set();
    }

    addTransition(event: Event, oldState: DeviceState, newState: DeviceState): void {
        this.addNode(oldState);
        this.addNode(newState);

        this.transitions.push([oldState, event, newState]);
        let eventState = event.eventStateSig(oldState);

        // ineffective event
        if (oldState.getPageContentSig() == newState.getPageContentSig()) {
            this.ineffectiveEvent.add(eventState);
            return;
        }

        this.effectiveEvent.add(eventState);

        if (!this.contentStateGraph.hasEdge(oldState.getPageContentSig(), newState.getPageContentSig())) {
            this.contentStateGraph.addEdge(oldState.getPageContentSig(), newState.getPageContentSig(), new Map());
        }
        let attr = this.contentStateGraph.getEdgeAttributes(oldState.getPageContentSig(), newState.getPageContentSig());
        attr.set(eventState, { event: event, id: this.effectiveEvent.size });

        if (!this.structualStateGraph.hasEdge(oldState.getPageStructureSig(), newState.getPageStructureSig())) {
            this.structualStateGraph.addEdge(oldState.getPageStructureSig(), newState.getPageStructureSig(), new Map());
        }

        attr = this.structualStateGraph.getEdgeAttributes(oldState.getPageStructureSig(), newState.getPageStructureSig());
        attr.set(eventState, { event: event, id: this.effectiveEvent.size });

        this.lastState = newState;

        this.outputHtml();
    }

    removeTransition(event: Event, oldState: DeviceState, newState: DeviceState): void {
        // event bind oldState
        let eventStr = event.eventStateSig(oldState);
        if (this.contentStateGraph.hasEdge(oldState.getPageContentSig(), newState.getPageContentSig())) {
            let attr = this.contentStateGraph.getEdgeAttributes(oldState.getPageContentSig(), newState.getPageContentSig());
            if (attr.has(eventStr)) {
                attr.delete(eventStr);
            }
            if (attr.size == 0) {
                this.contentStateGraph.dropEdge(oldState.getPageContentSig(), newState.getPageContentSig());
            }
        }

        if (this.structualStateGraph.hasEdge(oldState.getPageStructureSig(), newState.getPageStructureSig())) {
            let attr = this.structualStateGraph.getEdgeAttributes(
                oldState.getPageStructureSig(),
                newState.getPageStructureSig()
            );
            if (attr.has(eventStr)) {
                attr.delete(eventStr);
            }
            if (attr.size == 0) {
                this.structualStateGraph.dropEdge(oldState.getPageStructureSig(), newState.getPageStructureSig());
            }
        }
    }

    isEventExplored(event: Event, state: DeviceState): boolean {
        let eventState = event.eventStateSig(state);
        return this.effectiveEvent.has(eventState) || this.ineffectiveEvent.has(eventState);
    }

    isStateExplored(state: DeviceState): boolean {
        if (this.exploredState.has(state.getPageContentSig())) {
            return true;
        }

        for (const event of state.getPossibleUIEvents()) {
            if (!this.isEventExplored(event, state)) {
                return false;
            }
        }

        this.exploredState.add(state.getPageContentSig());
        return true;
    }

    isStateReached(state: DeviceState): boolean {
        if (this.reachedState.has(state.getPageContentSig())) {
            return true;
        }
        // todo
        this.reachedState.add(state.getPageContentSig());
        return false;
    }

    getReachableStates(currentState: DeviceState): DeviceState[] {
        let reachableStates: DeviceState[] = [];
        this.contentStateGraph.filterInEdges(currentState.getPageContentSig(), (edge, attr, source, target) => {
            if (source == currentState.getPageContentSig()) {
                let state = this.contentStateGraph.getNodeAttributes(target);
                reachableStates.push(state);
            }
        });
        return reachableStates;
    }

    getNavigationSteps(from: DeviceState, to: DeviceState): [DeviceState, Event][] | undefined {
        const path = bidirectional(this.contentStateGraph, from.getPageContentSig(), to.getPageContentSig());
        if (!path || path.length < 2) {
            logger.warn(`error get path from ${from.getPageContentSig()} to ${to.getPageContentSig()}`);
            return;
        }

        let steps: [DeviceState, Event][] = [];
        let source = path[0];
        for (let i = 1; i < path.length; i++) {
            let sourceState = this.contentStateGraph.getNodeAttributes(source);
            let target = path[i];
            let edgeAttr = this.contentStateGraph.getEdgeAttributes(source, target);
            let eventKeys = Array.from(edgeAttr.keys());
            if (this.randomInput) {
                RandomUtils.shuffle(eventKeys);
            }
            let event = edgeAttr.get(eventKeys[0])?.event;
            steps.push([sourceState, event!]);
            source = target;
        }

        return steps;
    }

    private addNode(state: DeviceState) {
        if (this.firstState == undefined) {
            this.firstState = state;
        }

        if (!this.contentStateGraph.hasNode(state.getPageContentSig())) {
            // state.save2dir()
            this.contentStateGraph.addNode(state.getPageContentSig(), state);
        }

        if (!this.structualStateGraph.hasNode(state.getPageStructureSig())) {
            this.structualStateGraph.addNode(state.getPageStructureSig(), [state]);
        } else {
            this.structualStateGraph.getNodeAttributes(state.getPageStructureSig()).push(state);
        }
        // reached ability
    }

    private outputHtml() {}
}
