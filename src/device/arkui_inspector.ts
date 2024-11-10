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

import WebSocket from 'ws';
import { Hdc } from './hdc';
import { getLogger } from 'log4js';
import { Component } from '../model/component';
import { Point } from '../model/point';
import { ViewTree } from '../model/viewtree';
import { hostUnusedPort } from '../utils/net_utils';
const logger = getLogger();

/**
 * ArkUI have a inspector wss node (ark:pid@bundleName)，when client send {'type': 'tree'},
 * server will repose two message layout and screen snapshot.
 * So, we used hdc fport tcp:{port} ark:{pid}@{bundleName} to forword remode node to local.
 * Then used wss to dump ArkUI layout and snapshot.
 */
export class ArkUIInspector {
    private hdc: Hdc;

    constructor(hdc: Hdc) {
        this.hdc = hdc;
    }

    private buildComponent(node: any, parent: Component | null = null): Component {
        let component = new Component();
        let points: Point[] = [];
        if (node.$rect) {
            for (let point of node.$rect.split('],[')) {
                let [x, y] = point.replace('[', '').replace(']', '').split(',');
                if (x && y) {
                    points.push({ x: Math.floor(Number(x)), y: Math.floor(Number(y)) });
                }
            }
            component.bounds = points;
        }
        component.type = node.$type;
        component.debugLine = node.$debugLine;
        component.name = node.state?.viewInfo.componentName;
        component.parent = parent;

        if (node.$children) {
            for (let child of node.$children) {
                component.addChild(this.buildComponent(child, component));
            }
        }

        return component;
    }

    async dump(bundleName: string, sn?: string): Promise<any> {
        // remove last forward
        let fportls = this.hdc.fportLs();
        fportls.forEach((value) => {
            if (sn) {
                if (value[0] == sn && value[2].indexOf(`@${bundleName}`) > 0 && value[3] == '[Forward]') {
                    this.hdc.fportRm(value[1], value[2]);
                }
            } else {
                if (value[2].indexOf(`@${bundleName}`) > 0 && value[3] == '[Forward]') {
                    this.hdc.fportRm(value[1], value[2]);
                }
            }
        });

        let port = await hostUnusedPort();
        return new Promise((resolve, reject) => {
            let pid = this.hdc.pidof(bundleName);
            if (pid == 0) {
                resolve({ err: 'bundle not running.' });
                return;
            }

            // forward
            this.hdc.fport(`tcp:${port}`, `ark:${pid}@${bundleName}`);
            let response: any = {};
            let idx = 0;

            const wss = new WebSocket(`ws://localhost:${port}`);
            wss.on('open', () => {
                wss.send(JSON.stringify({ type: 'tree' }));
                setTimeout(() => {
                    wss.close();
                }, 1000);
            });

            wss.on('message', (data: WebSocket.RawData) => {
                let object = JSON.parse(data.toString('utf-8'));
                if (object.type == 'root') {
                    let component = this.buildComponent(object.content);
                    response.layout = new ViewTree(component);
                } else if (object.type == 'snapShot') {
                    response.screen = Buffer.from(object.pixelMapBase64, 'base64');
                }

                if (++idx == 2) {
                    wss.close();
                }
            });

            wss.on('error', (err: Error) => {
                logger.error(`ArkUIInspector wss error: ${err}`);
                resolve({ err: err.message });
            });

            wss.on('close', () => {
                resolve(response);
            });
        });
    }
}
