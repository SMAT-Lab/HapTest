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
import { Hap, HapRunningState } from '../model/hap';
import { BACKGROUND_PAGE, Page, STOP_PAGE } from '../model/page';
import { Point } from '../model/point';
import { Hdc } from './hdc';
import path from 'path';
import { Direct, EventSimulator } from './event_simulator';
import { HapBuilder } from '../model/builder/hap_builder';
import { Coverage } from './coverage';
import { FuzzOptions } from '../runner/fuzz_options';
import { execSync } from 'child_process';
import { HapProject } from 'bjc';
import { findFiles } from '../utils/file_utils';
import { Snapshot } from '../model/snapshot';
import { getLogger } from 'log4js';
import moment from 'moment';
import { ArkUIInspector } from './arkui_inspector';
import { TouchEvent } from '../event/ui_event';
const logger = getLogger();

export class Device implements EventSimulator {
    private hdc: Hdc;
    private coverage: Coverage;
    private output: string;
    private temp: string;
    private width: number;
    private height: number;
    private sn: string;
    private options: FuzzOptions;
    private arkuiInspector: ArkUIInspector;

    constructor(options: FuzzOptions) {
        this.options = options;
        this.hdc = new Hdc(options.connectkey);
        this.output = path.join(path.resolve(options.output), moment().format('YYYY-MM-DD-HH-mm-ss'));
        let size = this.hdc.getScreenSize();
        this.width = size.x;
        this.height = size.y;
        this.sn = this.hdc.getDeviceSN();
        if (!fs.existsSync(this.output)) {
            fs.mkdirSync(this.output, { recursive: true });
        }
        this.temp = path.join(this.output, 'temp');
        fs.mkdirSync(this.temp, { recursive: true });
        this.arkuiInspector = new ArkUIInspector(this.hdc);
    }

    connect(hap: Hap) {
        // install hap
        this.installHap(hap);
        if (this.options.coverage) {
            this.coverage = new Coverage(this, hap);
            this.coverage.startBftp();
        }
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
     * Get device sn
     * @returns
     */
    getSN(): string {
        return this.sn;
    }

    /**
     * Get device type, eg: [phone, tablet, wearable, car, tv, 2in1]
     * @returns
     */
    getDeviceType(): string {
        return this.hdc.getDeviceType();
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
     * Get SN of the device
     * @returns
     */
    getDeviceSN(): string {
        return this.hdc.getDeviceSN();
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
            // if exist keyboard then close and dump again.
            if (this.closeKeyboard(pages)) {
                // for sleep
                this.hdc.getDeviceSN();
                continue;
            }
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
     * Detect keyboard and close it.
     * @param pages
     * @returns
     */
    private closeKeyboard(pages: Page[]): boolean {
        for (const page of pages) {
            if (page.getBundleName() != 'com.huawei.hmos.inputmethod') {
                continue;
            }

            for (const component of page.getComponents()) {
                if (component.id == 'hideButton') {
                    this.sendEvent(new TouchEvent(component));
                    return true;
                }
            }

            let components = page.getComponents().filter((value) => {
                return value.hasUIEvent();
            });

            components = components.sort((a, b) => {
                if (a.bounds[0].y != b.bounds[0].y) {
                    return a.bounds[0].y - b.bounds[0].y;
                }

                return a.bounds[0].x - b.bounds[0].x;
            });

            this.sendEvent(new TouchEvent(components[2]));
            return true;
        }

        return false;
    }

    /**
     * Dump inspector layout and snapshot
     * @param bundleName
     * @returns
     */
    async dumpInspector(bundleName: string): Promise<any[]> {
        return this.arkuiInspector.dump(bundleName, this.options.connectkey);
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
        let retryCnt = 5;
        while (retryCnt-- >= 0) {
            try {
                return this.hdc.capScreen(this.temp);
            } catch (error) {}
        }
        return '';
    }

    /**
     * wakeup screen
     */
    wakeupScreen(): void {
        this.hdc.wakeupScreen();
    }

    /**
     * get crrent Page
     * @param hap
     * @returns
     */
    getCurrentPage(hap: Hap): Page {
        let page = this.dumpViewTree();

        // set hap running state
        if (page.getBundleName() == hap.bundleName) {
            let snapshot = this.getSnapshot(true);
            page.setSnapshot(snapshot);
            return page;
        }

        let runningState = this.getHapRunningState(hap);
        let snapshot = this.getSnapshot(false);
        if (runningState == HapRunningState.STOP) {
            page = STOP_PAGE;
            page.setSnapshot(snapshot);
        } else if (runningState == HapRunningState.BACKGROUND) {
            page = BACKGROUND_PAGE;
            page.setSnapshot(snapshot);
        }

        return page;
    }

    /**
     * Get current device state
     * @returns
     */
    getSnapshot(onForeground: boolean): Snapshot {
        let screen = this.capScreen();
        let faultlogs = this.collectFaultLogger();
        return new Snapshot(
            this,
            screen,
            faultlogs,
            this.coverage ? this.coverage.getCoverageFile(onForeground) : undefined
        );
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
    getHapRunningState(hap: Hap): HapRunningState {
        let process = this.hdc.getRunningProcess();
        if (process.has(hap.bundleName)) {
            return process.get(hap.bundleName)!;
        }
        return HapRunningState.STOP;
    }

    getBundleInfo(bundleName: string): any | undefined {
        return this.hdc.getBundleInfo(bundleName);
    }

    buildHap(device: Device): Hap {
        // using hvigorw to build HAP
        if (this.options.sourceRoot) {
            execSync(`hvigorw -p buildMode=debug -p coverage-mode=bjc -p debugLine=true clean assembleHap`, {
                stdio: 'inherit',
                cwd: this.options.sourceRoot,
            });

            let deviceType = device.getDeviceType();
            let project = new HapProject(this.options.sourceRoot);
            let module = project.getModule(deviceType);
            let hapFiles = findFiles(path.join(module.path, 'build'), ['.hap']);
            hapFiles.sort();
            if (hapFiles.length > 0) {
                this.options.hapFile = hapFiles[0];
            }
        }

        if (this.options.hapFile) {
            return HapBuilder.buildFromHapFile(this.options.hapFile);
        }

        if (this.options.bundleName) {
            return HapBuilder.buildFromBundleName(device, this.options.bundleName);
        }

        logger.error(`Not found HAP ${this.options.hap}`);
        process.exit();
    }

    /**
     * Excute cmd 'hdc shell aa dump -c -l' to trigger save cov file.
     */
    aaDumpMission() {
        this.hdc.aaDumpMission();
    }
}
