import fs from 'fs';
import { Event } from '../event/event';
import { KeyCode } from '../model/key_code';
import { DeviceState } from '../model/device_state';
import { Hap } from '../model/hap';
import { Page } from '../model/page';
import { Point } from '../model/point';
import { Hdc } from './hdc';
import path from 'path';
import { Direct, EventSimulator } from './event_simulator';
import { HapBuilder } from '../model/builder/hap_builder';

export class Device implements EventSimulator {
    private hdc: Hdc;
    private output: string;
    private temp: string;
    private width: number;
    private height: number;
    private udid: string;

    constructor(connectkey: string, output: string) {
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

    /**
     * Get output path
     * @returns
     */
    getOutput(): string {
        return this.output;
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
        return new DeviceState(this, page, screen, faultlogs);
    }

    /**
     * Install hap to device
     * @param hap hap file
     */
    installHap(hap: Hap) {
        let targetHap = this.getHapInTarget(hap.bundleName);
        if (targetHap?.versionCode == hap.versionCode) {
            return;
        }
        this.hdc.installHap(hap.hapFile);
    }

    /**
     * Is hap in foreground.
     * @param hap
     * @returns
     */
    isForeground(hap: Hap): boolean {
        return this.hdc.getForegroundProcess().has(hap.bundleName);
    }

    getBundleInfo(bundleName: string): any | undefined {
        return this.hdc.getBundleInfo(bundleName);
    }
}
