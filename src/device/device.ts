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
import { Event } from '../event/event';
import { KeyCode } from '../model/key_code';
import { DeviceState } from '../model/device_state';
import { Hap, HapRunningState } from '../model/hap';
import { Page } from '../model/page';
import { Point } from '../model/point';
import { Hdc } from './hdc';
import path from 'path';
import { Direct, EventSimulator } from './event_simulator';
import { HapBuilder } from '../model/builder/hap_builder';
import { Coverage } from './coverage';

export class Device implements EventSimulator {
    private hdc: Hdc;
    private coverage: Coverage;
    private output: string;
    private temp: string;
    private width: number;
    private height: number;
    private udid: string;

    constructor(connectkey: string | undefined = undefined, output: string = 'out') {
        this.hdc = new Hdc(connectkey);
        this.output = path.resolve(output);
        let size = this.hdc.getScreenSize();
        this.width = size.x;
        this.height = size.y;
        this.udid = this.hdc.getDeviceUdid();
        if (!fs.existsSync(this.output)) {
            fs.mkdirSync(this.output, { recursive: true });
        }
        this.temp = path.join(this.output, 'temp');
        fs.mkdirSync(this.temp, { recursive: true });
    }

    connect(hap: Hap) {
        // install hap
        this.installHap(hap);
        this.coverage = new Coverage(this, hap);
        this.coverage.startBftp();
    }

    /**
     * Get output path
     * @returns
     */
    getOutput(): string {
        return this.output;
    }

    getHdc(): Hdc {
        return this.hdc;
    }

    /**
     * Get device udid
     * @returns
     */
    getUdid(): string {
        return this.udid;
    }

    /**
     * Send event
     * @param event
     */
    sendEvent(event: Event): void {
        this.wakeupScreen();
        event.send(this);
    }

    /**
     * Get the width of the screen
     * @returns
     */
    getWidth(): number {
        return this.width;
    }

    /**
     * Get the height of the screen
     * @returns
     */
    getHeight(): number {
        return this.height;
    }

    /**
     * Get all bundles install in the device
     * @returns
     */
    getAllBundleNames(): string[] {
        return this.hdc.getAllBundleNames();
    }

    /**
     * Create Hap instance by bundle info
     * @param bundleName
     * @returns
     */
    getHapInTarget(bundleName: string): Hap | undefined {
        return HapBuilder.buildFromBundleName(this, bundleName);
    }

    /**
     * Get fault log in the devive
     * @returns
     */
    collectFaultLogger(): Set<string> {
        return this.hdc.collectFaultLogger();
    }

    /**
     * Get udid of the device
     * @returns
     */
    getDeviceUdid(): string {
        return this.hdc.getDeviceUdid();
    }

    /**
     * Start ablity to run HAP
     * @param bundleName
     * @param abilityName
     * @returns
     */
    startAblity(bundleName: string, abilityName: string): boolean {
        return this.hdc.startAblity(bundleName, abilityName);
    }

    /**
     * Force stop HAP
     * @param bundleName
     */
    forceStop(bundleName: string) {
        this.hdc.forceStop(bundleName);
    }

    /**
     * Dump UI component view tree
     * @returns
     */
    dumpViewTree(): Page {
        let retryCnt = 5;
        while (retryCnt-- >= 0) {
            let pages = this.hdc.dumpViewTree();
            pages.sort((a: Page, b: Page) => {
                return b.getRoot().getHeight() - a.getRoot().getHeight();
            });

            if (pages.length > 0) {
                return pages[0];
            }
        }
        throw new Error('Device->dumpViewTree fail.');
    }

    /**
     * Simulate a single click
     * @param point
     */
    click(point: Point): void {
        this.hdc.click(point);
    }

    /**
     * Simulate a double-click operation
     * @param point
     */
    doubleClick(point: Point) {
        this.hdc.doubleClick(point);
    }

    /**
     * Simulate a long press
     * @param point
     */
    longClick(point: Point) {
        this.hdc.longClick(point);
    }

    /**
     * Simulate the input text operation in the input box
     * @param point
     * @param text
     */
    inputText(point: Point, text: string) {
        this.hdc.inputText(point, text);
    }

    /**
     * Simulate a fast-swipe operation
     * @param from
     * @param to
     * @param velocity value range [200-40000]
     * @param step swipe step size
     */
    fling(from: Point, to: Point, velocity: number = 600, step: number = 50) {
        this.hdc.fling(from, to, velocity, step);
    }

    /**
     * Simulate a fast-direct-swipe operation
     * @param direct
     * @param velocity value range [200-40000]
     * @param step
     */
    directFling(direct: Direct = Direct.LEFT, velocity: number = 600, step: number = 50) {
        this.hdc.directFling(direct, velocity, step);
    }
    /**
     * Simulate a slow swipe operation
     * @param from
     * @param to
     * @param velocity value range [200-40000]
     */
    swipe(from: Point, to: Point, velocity: number = 600) {
        this.hdc.swipe(from, to, velocity);
    }

    /**
     * Simulate drag-and-drop operation
     * @param from
     * @param to
     * @param velocity value range [200-40000]
     */
    drag(from: Point, to: Point, velocity: number = 600) {
        this.hdc.drag(from, to, velocity);
    }

    /**
     * Simulate key input operation
     * @param key0
     * @param key1
     * @param key2
     */
    inputKey(key0: KeyCode, key1: KeyCode | undefined = undefined, key2: KeyCode | undefined = undefined) {
        this.hdc.inputKey(key0, key1, key2);
    }

    /**
     * Take a screenshot
     * @returns screenshot file path
     */
    capScreen(): string {
        return this.hdc.capScreen(this.temp);
    }

    /**
     * wakeup screen
     */
    wakeupScreen(): void {
        this.hdc.wakeupScreen();
    }

    /**
     * Get current device state
     * @returns
     */
    getCurrentState(): DeviceState {
        let page = this.dumpViewTree();
        let screen = this.capScreen();
        let faultlogs = this.collectFaultLogger();
        let state = new DeviceState(this, page, screen, faultlogs);
        this.coverage.getCoverageFile();
        return state;
    }

    /**
     * Install hap to device
     * @param hap hap file
     */
    installHap(hap: Hap) {
        if (hap.hapFile) {
            this.hdc.installHap(hap.hapFile);
            // get more hap info
            let targetHap = this.getHapInTarget(hap.bundleName);
            if (targetHap) {
                hap.ablities = targetHap.ablities;
                hap.mainAbility = targetHap.mainAbility;
                hap.entryModuleName = targetHap.entryModuleName;
                hap.reqPermissions = targetHap.reqPermissions;
                hap.versionCode = targetHap.versionCode;
            }
        }
    }

    /**
     * Get HAP RunningState
     * @param hap
     * @returns
     */
    getHapRunningState(hap: Hap): HapRunningState | undefined {
        return this.hdc.getRunningProcess().get(hap.bundleName);
    }

    getBundleInfo(bundleName: string): any | undefined {
        return this.hdc.getBundleInfo(bundleName);
    }
}
