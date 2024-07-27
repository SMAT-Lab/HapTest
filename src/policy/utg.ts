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
import { Event } from '../event/event';
import { Hap } from '../model/hap';
import DirectedGraph from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import Logger from '../utils/logger';
import { RandomUtils } from '../utils/random_utils';
import { StopHapEvent } from '../event/system_event';
import { Page } from '../model/page';
const logger = Logger.getLogger();

type EdgeAttributeType = Map<string, { id: number; event: Event }>;

/**
 * UI transition graph
 */
export class UTG {
    device: Device;
    hap: Hap;
    randomInput: boolean;
    transitions: [Page, Event, Page][];
    pageContentGraph: DirectedGraph<Page, EdgeAttributeType>;
    pageStructualGraph: DirectedGraph<Page[], EdgeAttributeType>;
    ineffectiveEvent: Set<string>;
    effectiveEvent: Set<string>;
    exploredPage: Set<string>;
    reachedPage: Set<string>;
    firstPage: Page;
    lastPage: Page;
    stopEvent: StopHapEvent;
    stopPage: Page;

    constructor(device: Device, hap: Hap, randomInput: boolean) {
        this.device = device;
        this.hap = hap;
        this.randomInput = randomInput;
        this.transitions = [];
        this.pageContentGraph = new DirectedGraph();
        this.pageStructualGraph = new DirectedGraph();
        this.ineffectiveEvent = new Set();
        this.effectiveEvent = new Set();
        this.exploredPage = new Set();

        this.reachedPage = new Set();
        this.stopEvent = new StopHapEvent(this.hap.bundleName);
    }

    addTransitionToStop(newPage: Page): void {
        if (!this.stopPage || !newPage.isForeground()) {
            return;
        }

        this.addTransition(this.stopEvent, newPage, this.stopPage);
    }

    addTransition(event: Event, oldPage: Page, newPage: Page): void {
        this.addNode(oldPage);
        this.addNode(newPage);

        this.transitions.push([oldPage, event, newPage]);
        let eventPageSig = event.eventPageSig(oldPage);

        // ineffective event
        if (oldPage.getContentSig() == newPage.getContentSig()) {
            this.ineffectiveEvent.add(eventPageSig);
            return;
        }

        this.effectiveEvent.add(eventPageSig);

        if (!this.pageContentGraph.hasEdge(oldPage.getContentSig(), newPage.getContentSig())) {
            this.pageContentGraph.addEdge(oldPage.getContentSig(), newPage.getContentSig(), new Map());
        }
        let attr = this.pageContentGraph.getEdgeAttributes(oldPage.getContentSig(), newPage.getContentSig());
        attr.set(eventPageSig, { event: event, id: this.effectiveEvent.size });

        if (!this.pageStructualGraph.hasEdge(oldPage.getStructualSig(), newPage.getStructualSig())) {
            this.pageStructualGraph.addEdge(oldPage.getStructualSig(), newPage.getStructualSig(), new Map());
        }

        attr = this.pageStructualGraph.getEdgeAttributes(oldPage.getStructualSig(), newPage.getStructualSig());
        attr.set(eventPageSig, { event: event, id: this.effectiveEvent.size });

        this.lastPage = newPage;
    }

    removeTransition(event: Event, oldPage: Page, newPage: Page): void {
        // event bind oldState
        let eventStr = event.eventPageSig(oldPage);
        if (this.pageContentGraph.hasEdge(oldPage.getStructualSig(), newPage.getStructualSig())) {
            let attr = this.pageContentGraph.getEdgeAttributes(oldPage.getStructualSig(), newPage.getStructualSig);
            if (attr.has(eventStr)) {
                attr.delete(eventStr);
            }
            if (attr.size == 0) {
                this.pageContentGraph.dropEdge(oldPage.getStructualSig(), newPage.getStructualSig());
            }
        }

        if (this.pageStructualGraph.hasEdge(oldPage.getStructualSig(), newPage.getStructualSig())) {
            let attr = this.pageStructualGraph.getEdgeAttributes(oldPage.getStructualSig(), newPage.getStructualSig);
            if (attr.has(eventStr)) {
                attr.delete(eventStr);
            }
            if (attr.size == 0) {
                this.pageStructualGraph.dropEdge(oldPage.getStructualSig(), newPage.getStructualSig());
            }
        }
    }

    isEventExplored(event: Event, page: Page): boolean {
        let eventPageSig = event.eventPageSig(page);
        return this.effectiveEvent.has(eventPageSig) || this.ineffectiveEvent.has(eventPageSig);
    }

    isPageExplored(page: Page): boolean {
        if (this.exploredPage.has(page.getContentSig())) {
            return true;
        }

        for (const event of page.getPossibleUIEvents()) {
            if (!this.isEventExplored(event, page)) {
                return false;
            }
        }

        this.exploredPage.add(page.getContentSig());
        return true;
    }

    isPageReached(page: Page): boolean {
        if (this.reachedPage.has(page.getContentSig())) {
            return true;
        }
        // todo
        this.reachedPage.add(page.getContentSig());
        return false;
    }

    getReachablePages(currentPage: Page): Page[] {
        let reachablePages: Page[] = [];
        this.pageContentGraph.filterOutEdges(currentPage.getContentSig(), (edge, attr, source, target) => {
            let state = this.pageContentGraph.getNodeAttributes(target);
            reachablePages.push(state);
        });
        return reachablePages;
    }

    getNavigationSteps(from: Page, to: Page): [Page, Event][] | undefined {
        const path = bidirectional(this.pageContentGraph, from.getContentSig(), to.getContentSig());
        if (!path || path.length < 2) {
            logger.warn(`error get path from ${from.getContentSig()} to ${to.getContentSig()}`);
            return;
        }

        let steps: [Page, Event][] = [];
        let source = path[0];
        for (let i = 1; i < path.length; i++) {
            let sourceState = this.pageContentGraph.getNodeAttributes(source);
            let target = path[i];
            let edgeAttr = this.pageContentGraph.getEdgeAttributes(source, target);
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

    private addNode(page: Page) {
        if (this.firstPage == undefined) {
            this.firstPage = page;
        }

        if (this.stopPage == undefined && page.isStop()) {
            this.stopPage = page;
        }

        if (!this.pageContentGraph.hasNode(page.getContentSig())) {
            this.pageContentGraph.addNode(page.getContentSig(), page);
        }

        if (!this.pageStructualGraph.hasNode(page.getStructualSig())) {
            this.pageStructualGraph.addNode(page.getStructualSig(), [page]);
        } else {
            this.pageStructualGraph.getNodeAttributes(page.getStructualSig()).push(page);
        }
        // reached ability
    }
}
