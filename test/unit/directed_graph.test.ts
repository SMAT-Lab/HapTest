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

import { describe, it, expect } from 'vitest';
import DirectedGraph from 'graphology';
import { bidirectional } from 'graphology-shortest-path';

describe('DirectedGraph Test', () => {
    it('test()', async () => {
        let graph = new DirectedGraph();
        graph.addNode(1);
        graph.addNode(2);
        graph.addNode(3);
        graph.addNode(4);
        graph.addNode(5);

        graph.addDirectedEdge(1, 2);
        graph.addDirectedEdge(1, 3);

        graph.addDirectedEdge(2, 4);
        
        graph.addDirectedEdge(3, 5);

        graph.addDirectedEdge(4, 5);

        let edges = graph.filterOutEdges(1, (edge, attr, source, target) => {
            return true;
        });

        expect(edges.length).eq(2);

        let shortestPath = bidirectional(graph, 1, 5);
        expect(shortestPath?.length).eq(3);

        graph.dropDirectedEdge(3, 5);
        shortestPath = bidirectional(graph, 1, 5);
        expect(shortestPath?.length).eq(4);

        edges = graph.filterOutEdges(3, (edge, attr, source, target) => {
            console.log(edge, source, target);
            return true;
        });

        expect(edges.length).eq(0);
    });
});