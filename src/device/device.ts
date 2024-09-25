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
import { EventSimulator } from './event_simulator';
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
import { ArkUiDriver } from './uidriver/arkui_driver';
import { buildDriverImpl } from './uidriver/build';
import { Gesture } from '../event/gesture';
const logger = getLogger();

export class Device implements EventSimulator {
    private hdc: Hdc;
    private coverage?: Coverage;
    private output: string;
    private temp: string;
    private displaySize?: Point;
    private udid: string;
    private options: FuzzOptions;
    private arkuiInspector: ArkUIInspector;
    private lastFaultlogs: Set<string>;
    private driver?: ArkUiDriver;

    constructor(options: FuzzOptions) {
        this.options = options;
        this.hdc = new Hdc(options.connectkey);
        this.output = path.join(path.resolve(options.output), moment().format('YYYY-MM-DD-HH-mm-ss'));
        this.udid = this.hdc.getDeviceUdid();
        if (!fs.existsSync(this.output)) {
            fs.mkdirSync(this.output, { recursive: true });
        }
        this.temp = path.join(this.output, 'temp');
        fs.mkdirSync(this.temp, { recursive: true });
        this.arkuiInspector = new ArkUIInspector(this.hdc);
        this.lastFaultlogs = this.collectFaultLogger();
    }

    async connect(hap: Hap) {
        // install hap
        this.installHap(hap);
        if (this.options.coverage) {
            this.coverage = new Coverage(this, hap);
            this.coverage.startBftp();
        }

        this.driver = await buildDriverImpl(this);
        this.displaySize = await this.driver.getDisplaySize();
    }

    getDriver(): ArkUiDriver {
        return this.driver!;
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
    async sendEvent(event: Event): Promise<void> {
        this.wakeupScreen();
        await event.send(this);
    }

    /**
     * Get the width of the screen
     * @returns
     */
    getWidth(): number {
        return this.displaySize!.x;
    }

    /**
     * Get the height of the screen
     * @returns
     */
    getHeight(): number {
        return this.displaySize!.y;
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
        this.hdc.recvFile('/data/log/faultlog/', this.output);
        return new Set<string>(findFiles(path.join(this.output, 'faultlog'), []));
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
            let pages = this.hdc.dumpViewTree(this.temp);
            // if exist keyboard then close and dump again.
            if (this.closeKeyboard(pages)) {
                // for sleep
                this.hdc.getDeviceUdid();
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
    async dumpInspector(bundleName: string): Promise<any> {
        return this.arkuiInspector.dump(bundleName, this.options.connectkey);
    }

    /**
     * Simulate a single click
     * @param point
     */
    async click(point: Point): Promise<void> {
        await this.driver?.click(point.x, point.y);
    }

    /**
     * Simulate a double-click operation
     * @param point
     */
    async doubleClick(point: Point): Promise<void> {
        await this.driver?.doubleClick(point.x, point.y);
    }

    /**
     * Simulate a long press
     * @param point
     */
    async longClick(point: Point): Promise<void> {
        await this.driver?.longClick(point.x, point.y);
    }

    /**
     * Simulate the input text operation in the input box
     * @param point
     * @param text
     */
    async inputText(point: Point, text: string): Promise<void> {
        await this.driver?.inputText(point, text);
    }

    /**
     * Simulate a fast-swipe operation
     * @param from
     * @param to
     * @param speed value range [200-40000]
     * @param step swipe step size
     */
    async fling(from: Point, to: Point, step: number = 50, speed: number = 600): Promise<void> {
        await this.driver?.fling(from, to, step, speed);
    }

    /**
     * Simulate a slow swipe operation
     * @param from
     * @param to
     * @param speed value range [200-40000]
     */
    async swipe(from: Point, to: Point, speed: number = 600) {
        await this.driver?.swipe(from.x, from.y, to.x, to.y, speed);
    }

    /**
     * Simulate drag-and-drop operation
     * @param from
     * @param to
     * @param speed value range [200-40000]
     */
    async drag(from: Point, to: Point, speed: number = 600) {
        await this.driver?.drag(from.x, from.y, to.x, to.y, speed);
    }

    /**
     * Simulate key input operation
     * @param key0
     * @param key1
     * @param key2
     */
    async inputKey(key0: KeyCode, key1?: KeyCode, key2?: KeyCode) {
        if (!key1) {
            await this.driver?.triggerKey(key0);
        } else {
            await this.driver?.triggerCombineKeys(key0, key1, key2);
        }
    }

    async injectGesture(gestures: Gesture[], speed: number) {
        await this.driver?.injectGesture(gestures, speed);
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
    async getCurrentPage(hap: Hap): Promise<Page> {
        let page = this.dumpViewTree();
        let inspector = await this.dumpInspector(hap.bundleName);
        page.mergeInspector(inspector.layout);

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
        let diffLogs = new Set<string>();
        for (const log of faultlogs) {
            if (!this.lastFaultlogs.has(log)) {
                diffLogs.add(log);
            }
        }
        this.lastFaultlogs = faultlogs;

        return new Snapshot(
            this,
            screen,
            diffLogs,
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
            execSync(`hvigorw -p buildMode=debug -p coverage-mode=full -p debugLine=true clean assembleHap`, {
                stdio: 'inherit',
                cwd: this.options.sourceRoot,
            });

            let deviceType = device.getDeviceType();
            let project = new HapProject(this.options.sourceRoot);
            let module = project.getModule(deviceType);
            if (!module) {
                logger.error(`${deviceType}`);
                process.exit();
            }
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
