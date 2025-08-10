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

import fs from 'fs';
import { attribute as _, Digraph, Node, Edge, toDot } from 'ts-graphviz';
import { Event } from '../event/event';
import { Hap } from './hap';
import DirectedGraph from 'graphology';
import { bidirectional } from 'graphology-shortest-path';
import { RandomUtils } from '../utils/random_utils';
import { StopHapEvent } from '../event/system_event';
import { Page } from './page';
import { getLogger } from 'log4js';
import * as path from 'path';
const logger = getLogger();

type EdgeAttributeType = Map<string, { id: number; event: Event }>;

export interface Transition {
    from: Page;
    to: Page;
    event: Event;
}

/**
 * UI Page transition graph
 */
export class PTG {
    private hap: Hap;
    private randomInput: boolean;
    private transitions: Transition[];
    private pageContentGraph: DirectedGraph<Page, EdgeAttributeType>;
    private pageStructualGraph: DirectedGraph<Page[], EdgeAttributeType>;
    private ineffectiveEvent: Set<string>;
    private effectiveEvent: Set<string>;
    private exploredPage: Set<string>;
    private reachedPage: Set<string>;
    private exploredAbility: Set<string>; //xmq
    private firstPage?: Page;
    private stopEvent: StopHapEvent;
    private stopPage?: Page;
    private wantTransition?: Transition;

    constructor(hap: Hap, randomInput: boolean) {
        this.hap = hap;
        this.randomInput = randomInput;
        this.transitions = [];
        this.pageContentGraph = new DirectedGraph();
        this.pageStructualGraph = new DirectedGraph();
        this.ineffectiveEvent = new Set();
        this.effectiveEvent = new Set();
        this.exploredPage = new Set();
        this.exploredAbility = new Set();
        this.reachedPage = new Set();
        this.stopEvent = new StopHapEvent(this.hap.bundleName);
    }

    setWantTransition(transition: Transition) {
        this.wantTransition = transition;
        logger.info(`ptg want transition ${transition.from.getContentSig()} -> ${transition.to.getContentSig()}`);
    }

    addTransitionToStop(newPage: Page): void {
        if (!this.stopPage || !newPage.isForeground()) {
            return;
        }

        this.addTransition(this.stopEvent, newPage, this.stopPage);
    }

    addTransition(event: Event, oldPage: Page, newPage: Page): void {
        if (this.wantTransition) {
            logger.info(`ptg want transition ${oldPage.getContentSig()} -> ${newPage.getContentSig()}`);
            if (
                this.wantTransition.from === oldPage &&
                this.wantTransition.event === event &&
                this.wantTransition.to.getContentSig() !== newPage.getContentSig()
            ) {
                logger.info(
                    `ptg drop edge ${this.wantTransition.from.getContentSig()} -> ${this.wantTransition.to.getContentSig()}`
                );
                this.pageContentGraph.dropDirectedEdge(
                    this.wantTransition.from.getContentSig(),
                    this.wantTransition.to.getContentSig()
                );
                this.wantTransition = undefined;
            } else {
                logger.info(
                    `ptg not need drop ${this.wantTransition.from === oldPage}, ${this.wantTransition.event === event}, ${
                        this.wantTransition.to.getContentSig() !== newPage.getContentSig()
                    }`
                );
            }
        }

        this.addNode(oldPage);
        this.addNode(newPage);

        this.transitions.push({ from: oldPage, event: event, to: newPage });
        let eventPageSig = event.eventPageSig(oldPage);

        // ineffective event
        if (oldPage.getContentSig() === newPage.getContentSig()) {
            this.ineffectiveEvent.add(eventPageSig);
            return;
        }

        this.effectiveEvent.add(eventPageSig);

        if (!this.pageContentGraph.hasDirectedEdge(oldPage.getContentSig(), newPage.getContentSig())) {
            this.pageContentGraph.addDirectedEdge(oldPage.getContentSig(), newPage.getContentSig(), new Map());
            logger.info(`ptg add edge ${oldPage.getContentSig()} -> ${newPage.getContentSig()}`);
        }
        let attr = this.pageContentGraph.getEdgeAttributes(oldPage.getContentSig(), newPage.getContentSig());
        attr.set(eventPageSig, { event: event, id: this.effectiveEvent.size });

        if (!this.pageStructualGraph.hasDirectedEdge(oldPage.getStructualSig(), newPage.getStructualSig())) {
            this.pageStructualGraph.addDirectedEdge(oldPage.getStructualSig(), newPage.getStructualSig(), new Map());
        }

        attr = this.pageStructualGraph.getEdgeAttributes(oldPage.getStructualSig(), newPage.getStructualSig());
        attr.set(eventPageSig, { event: event, id: this.effectiveEvent.size });
    }

    removeTransition(event: Event, oldPage: Page, newPage: Page): void {
        // event bind oldState
        let eventStr = event.eventPageSig(oldPage);
        if (this.pageContentGraph.hasEdge(oldPage.getStructualSig(), newPage.getStructualSig())) {
            let attr = this.pageContentGraph.getEdgeAttributes(oldPage.getStructualSig(), newPage.getStructualSig);
            if (attr.has(eventStr)) {
                attr.delete(eventStr);
            }
            if (attr.size === 0) {
                this.pageContentGraph.dropEdge(oldPage.getStructualSig(), newPage.getStructualSig());
            }
        }

        if (this.pageStructualGraph.hasEdge(oldPage.getStructualSig(), newPage.getStructualSig())) {
            let attr = this.pageStructualGraph.getEdgeAttributes(oldPage.getStructualSig(), newPage.getStructualSig);
            if (attr.has(eventStr)) {
                attr.delete(eventStr);
            }
            if (attr.size === 0) {
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

    isAbilityExplored(abilityName: string): boolean {
        if (this.exploredAbility.has(abilityName)){
            return true;
        }
        this.exploredAbility.add(abilityName);
        return false;
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
        if (!this.pageContentGraph.hasNode(currentPage.getContentSig())) {
            return reachablePages;
        }
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

        logger.info(`shortest path ${from.getContentSig()} -> ${to.getContentSig()} ${path}`);

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

    async dumpSvg(output: string, rootUrl: string) {
        const dotGraph = new Digraph('PTG');
        dotGraph.node({
            fontname: 'Helvetica,Arial,sans-serif',
            fontsize: 12,
            width: 4,
            color: '#8383cc',
            fixedsize: true,
        });
        dotGraph.edge({ color: 'pink' });
        let nodes = new Map<string, Node>();
        for (const id of this.pageStructualGraph.nodes()) {
            let pages: Page[] = this.pageStructualGraph.getNodeAttributes(id);
            let faultLogs: Set<string> = new Set<string>();
            pages.map((v) =>
                v.getSnapshot()?.faultLogs.forEach((log) => {
                    let filename = path.basename(log);
                    if (!filename.includes('uitest')) {
                        faultLogs.add(filename);
                    }
                })
            );
            let dotNode = new Node(id, {
                [_.label]: `${id}\n${Array.from(faultLogs).join('\n')}`,
                [_.URL]: `${rootUrl}/node/${id}`,
                [_.image]: `${pages[0].getSnapshot()?.screenCapPath}`,
            });
            dotGraph.addNode(dotNode);
            nodes.set(id, dotNode);
        }

        for (const source of this.pageStructualGraph.nodes()) {
            for (const target of this.pageStructualGraph.nodes()) {
                if (this.pageStructualGraph.hasDirectedEdge(source, target)) {
                    const edge = new Edge([nodes.get(source)!, nodes.get(target)!], {
                        [_.URL]: `${rootUrl}/edge/${source}/${target}`,
                    });
                    dotGraph.addEdge(edge);
                }
            }
        }

        try {
            const dot = toDot(dotGraph);
            fs.writeFileSync(path.join(output, 'ptg.dot'), dot);
        } catch(error) {
            
        }
    }

    private addNode(page: Page) {
        if (this.firstPage === undefined) {
            this.firstPage = page;
        }

        if (this.stopPage === undefined && page.isStop()) {
            this.stopPage = page;
        }

        if (!this.pageContentGraph.hasNode(page.getContentSig())) {
            this.pageContentGraph.addNode(page.getContentSig(), page);
            logger.info(`ptg add node ${page.getContentSig()}`);
        }

        if (!this.pageStructualGraph.hasNode(page.getStructualSig())) {
            this.pageStructualGraph.addNode(page.getStructualSig(), [page]);
        } else {
            this.pageStructualGraph.getNodeAttributes(page.getStructualSig()).push(page);
        }
        // reached ability
    }

    getExploredAbilities(): string[] {
        return Array.from(this.exploredAbility);
    }
}
