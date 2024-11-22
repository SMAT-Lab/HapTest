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

import { spawn } from 'child_process';
import { Hdc, NEWLINE } from './hdc';
import { BACK_KEY_EVENT, CombinedKeyEvent, HOME_KEY_EVENT, KeyEvent } from '../event/key_event';
import { Event } from '../event/event';
import { DoubleClickEvent, FlingEvent, LongTouchEvent, SwipeEvent, TouchEvent, DragEvent } from '../event/ui_event';
import { getLogger } from 'log4js';

const logger = getLogger();

const Json2NumberKey = new Set([
    'KeyCode1',
    'KeyCode2',
    'KeyCode3',
    'keyItemsCount',
    'X_POSI',
    'Y_POSI',
    'X2_POSI',
    'Y2_POSI',
    'fingerNumber',
    'VELO',
    'LENGTH',
]);

type UIEventObserver = (event: Event) => void;
const NO_OPERATION_LOG = 'No operation detected for 5 seconds, press ctrl + c to save this file?';

/**
 * uitest uiRecord and uitest dumpLayout conflicting with each other, so the event can only be collected once
 */
export class UIRecord {
    private hdc: Hdc;
    private status: boolean;

    constructor(hdc: Hdc) {
        this.hdc = hdc;
        this.status = false;
    }

    async recordOnceEvent(): Promise<Event> {
        return new Promise((resolve) => {
            this.start((event) => {
                this.stop();
                resolve(event);
            });
        });
    }

    private start(callback: UIEventObserver): void {
        let uiRecord = spawn('hdc', ['shell', 'uitest', 'uiRecord', 'record'], {
            shell: true,
        });

        uiRecord.stdout.on('data', (data) => {
            let msg = data.toString();
            if (msg.trim() === 'Started Recording Successfully...') {
                this.status = true;
                logger.info('Please operate the app UI once > ');
                return;
            }
            if (msg.trim() === NO_OPERATION_LOG) {
                logger.info(NO_OPERATION_LOG);
            } else if (this.status) {
                let event = this.readUiRecord();
                if (event) {
                    callback(event);
                }
            }
        });
    }

    private stop(): void {
        this.hdc.kill('uitest');
        this.status = false;
    }

    private readUiRecord(): Event | undefined {
        let output = this.hdc.excuteShellCommand(...['uitest', 'uiRecord', 'read']);
        let line = output.split(NEWLINE)[0];
        logger.debug(line);
        let event = this.parseEvent(line);
        return event;
    }

    private parseEvent(jsonText: string): Event | undefined {
        try {
            let uiop = JSON.parse(jsonText, (key: string, value: string) => {
                if (Json2NumberKey.has(key)) {
                    return Number(value);
                }
                return value;
            });

            if (uiop.OP_TYPE === 'key') {
                if (uiop.keyItemsCount === 1) {
                    return new KeyEvent(uiop.KeyCode1);
                } else {
                    return new CombinedKeyEvent(uiop.KeyCode1, uiop.KeyCode2, uiop.KeyCode3);
                }
            }

            if (uiop.OP_TYPE === 'back') {
                return BACK_KEY_EVENT;
            }

            if (uiop.OP_TYPE === 'home') {
                return HOME_KEY_EVENT;
            }

            if (uiop.OP_TYPE === 'click') {
                return new TouchEvent({
                    x: Math.round((uiop.fingerList[0].X_POSI + uiop.fingerList[0].X2_POSI) / 2),
                    y: Math.round((uiop.fingerList[0].Y_POSI + uiop.fingerList[0].Y2_POSI) / 2),
                });
            }

            if (uiop.OP_TYPE === 'longClick') {
                return new LongTouchEvent({
                    x: Math.round((uiop.fingerList[0].X_POSI + uiop.fingerList[0].X2_POSI) / 2),
                    y: Math.round((uiop.fingerList[0].Y_POSI + uiop.fingerList[0].Y2_POSI) / 2),
                });
            }

            if (uiop.OP_TYPE === 'doubleClick') {
                return new DoubleClickEvent({
                    x: Math.round((uiop.fingerList[0].X_POSI + uiop.fingerList[0].X2_POSI) / 2),
                    y: Math.round((uiop.fingerList[0].Y_POSI + uiop.fingerList[0].Y2_POSI) / 2),
                });
            }

            if (uiop.OP_TYPE === 'recent' || uiop.OP_TYPE === 'swipe') {
                return new SwipeEvent(
                    { x: uiop.fingerList[0].X_POSI, y: uiop.fingerList[0].Y_POSI },
                    { x: uiop.fingerList[0].X2_POSI, y: uiop.fingerList[0].Y2_POSI },
                    uiop.VELO
                );
            }

            if (uiop.OP_TYPE === 'fling') {
                return new FlingEvent(
                    { x: uiop.fingerList[0].X_POSI, y: uiop.fingerList[0].Y_POSI },
                    { x: uiop.fingerList[0].X2_POSI, y: uiop.fingerList[0].Y2_POSI },
                    Math.round(uiop.LENGTH / 2),
                    uiop.VELO
                );
            }

            if (uiop.OP_TYPE === 'drag') {
                return new DragEvent(
                    { x: uiop.fingerList[0].X_POSI, y: uiop.fingerList[0].Y_POSI },
                    { x: uiop.fingerList[0].X2_POSI, y: uiop.fingerList[0].Y2_POSI },
                    uiop.VELO
                );
            }

            
        } catch (error) {}

        return undefined;
    }
}
