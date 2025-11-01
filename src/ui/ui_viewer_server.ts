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
import path from 'path';
import express, { Request, Response } from 'express';
import { getLogger } from 'log4js';
import { Device } from '../device/device';
import { Hdc, HdcTargetInfo } from '../device/hdc';
import { Hap } from '../model/hap';
import { FuzzOptions } from '../runner/fuzz_options';
import { LOG_LEVEL } from '../utils/logger';
import { HierarchyTree, buildHierarchy, generateXPathLite } from './hierarchy_builder';
import { Snapshot } from '../model/snapshot';
import { Page } from '../model/page';

const logger = getLogger('haptest-ui-viewer');
const DEVICE_CLEANUP_INTERVAL = 60 * 1000;

interface CachedDeviceEntry {
    key: string;
    device: Device;
    lastUsed: number;
    refCount: number;
    connectPromise: Promise<void> | null;
    ready: boolean;
}

class DevicePool {
    private static entries: Map<string, CachedDeviceEntry> = new Map();
    private static cleanupTimer: NodeJS.Timeout | null = null;
    private static lastReleaseTimestamps: Map<string, number> = new Map();
    private static readonly MIN_RECONNECT_DELAY_MS = 750;
    private static readonly DEVICE_INACTIVE_TTL = 60 * 1000;

    private static makeKey(connectKey: string | undefined, outputDir: string): string {
        return `${connectKey ?? 'auto'}|${outputDir}`;
    }

    static async acquire(options: FuzzOptions, bundleName?: string): Promise<{ key: string; device: Device }> {
        const key = this.makeKey(options.connectkey as string | undefined, options.output);
        logger.info(
            `[DevicePool] acquire requested | key=${key} | connectKey=${options.connectkey ?? 'auto'} | output=${options.output}`
        );
        let entry = this.entries.get(key);
        const now = Date.now();
        const lastRelease = this.lastReleaseTimestamps.get(key);
        if (lastRelease) {
            const elapsed = now - lastRelease;
            if (elapsed < this.MIN_RECONNECT_DELAY_MS) {
                const delay = this.MIN_RECONNECT_DELAY_MS - elapsed;
                logger.info(`[DevicePool] reconnection delay ${delay}ms enforced for key=${key}`);
                await sleep(delay);
            }
        }

        if (!entry) {
            const device = new Device(options);
            logger.info(`[DevicePool] creating new device entry for key=${key}`);
            entry = {
                key,
                device,
                lastUsed: Date.now(),
                refCount: 0,
                connectPromise: null,
                ready: false,
            };
            this.entries.set(key, entry);
            entry.connectPromise = (async () => {
                try {
                    const initialHap = new Hap();
                    initialHap.bundleName = bundleName ?? '';
                    logger.info(`[DevicePool] connecting device key=${key} with bundle=${initialHap.bundleName || 'auto'}`);
                    await device.connect(initialHap);
                    entry.ready = true;
                    logger.info(`[DevicePool] device key=${key} connected`);
                } catch (err) {
                    this.entries.delete(key);
                    logger.error(`[DevicePool] device key=${key} failed to connect: ${String(err)}`);
                    throw err;
                } finally {
                    entry.connectPromise = null;
                    entry.lastUsed = Date.now();
                }
            })();
        } else {
            logger.info(
                `[DevicePool] reusing cached device key=${key} (refCount=${entry.refCount}, ready=${entry.ready})`
            );
        }

        entry.refCount += 1;
        logger.info(`[DevicePool] device key=${key} refCount incremented to ${entry.refCount}`);
        this.startCleanupLoop();

        if (entry.connectPromise) {
            try {
                await entry.connectPromise;
            } catch (err) {
                entry.refCount = Math.max(0, entry.refCount - 1);
                logger.error(`[DevicePool] connect promise failed for key=${key}: ${String(err)}`);
                throw err;
            }
        }

        entry.lastUsed = Date.now();
        return { key, device: entry.device };
    }

    static async release(
        key: string | undefined,
        reason: string = 'release',
        options: { force?: boolean } = {}
    ): Promise<void> {
        if (!key) {
            return;
        }
        const entry = this.entries.get(key);
        if (!entry) {
            logger.warn(`[DevicePool] release requested for missing key=${key}`);
            return;
        }
        if (entry.refCount > 0) {
            entry.refCount -= 1;
        }
        entry.lastUsed = Date.now();
        logger.info(
            `[DevicePool] release key=${key} | reason=${reason} | refCount=${entry.refCount} | force=${Boolean(
                options.force
            )}`
        );
        if (entry.connectPromise) {
            try {
                await entry.connectPromise;
            } catch (err) {
                logger.warn(`[DevicePool] connect promise rejection during release key=${key}: ${String(err)}`);
            }
        }
        if (entry.refCount <= 0) {
            this.lastReleaseTimestamps.set(key, entry.lastUsed);
            if (options.force) {
                await this.disposeEntry(key, entry, reason);
                return;
            }
        }
        this.startCleanupLoop();
    }

    static touch(key: string | undefined): void {
        if (!key) {
            return;
        }
        const entry = this.entries.get(key);
        if (entry) {
            entry.lastUsed = Date.now();
        }
    }

    private static startCleanupLoop(): void {
        if (this.cleanupTimer) {
            return;
        }
        this.cleanupTimer = setInterval(() => {
            this.runCleanup().catch((err) => {
                logger.warn(`DevicePool cleanup failed: ${String(err)}`);
            });
        }, DEVICE_CLEANUP_INTERVAL);
    }

    private static async runCleanup(): Promise<void> {
        const now = Date.now();
        for (const [key, entry] of this.entries.entries()) {
            if (
                entry.refCount === 0 &&
                entry.ready &&
                !entry.connectPromise &&
                now - entry.lastUsed > this.DEVICE_INACTIVE_TTL
            ) {
                await this.disposeEntry(key, entry, 'cleanup');
            }
        }

        if (this.entries.size === 0 && this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    private static async disposeEntry(key: string, entry: CachedDeviceEntry, reason: string): Promise<void> {
        if (!this.entries.has(key)) {
            logger.debug(`[DevicePool] disposeEntry key=${key} already removed`);
        }
        this.entries.delete(key);
        try {
            logger.info(`[DevicePool] disposing device key=${key} | reason=${reason}`);
            const disconnect = (entry.device as unknown as { disconnect?: () => Promise<void> | void }).disconnect;
            if (typeof disconnect === 'function') {
                await disconnect.call(entry.device);
                logger.info(`[DevicePool] device key=${key} disconnected`);
            } else {
                logger.debug(`[DevicePool] device key=${key} has no disconnect method, skipping teardown`);
            }
        } catch (err) {
            logger.warn(`[DevicePool] failed to disconnect device key=${key} | reason=${reason} | error=${String(err)}`);
        }
    }
}

interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    message: string | null;
}

interface UIViewerServerOptions {
    bundleName?: string;
    connectKey?: string;
    outputDir: string;
    port: number;
    logLevel: LOG_LEVEL;
    version: string;
}

interface HierarchyResponse {
    jsonHierarchy: any;
    activityName: string;
    packageName: string;
    pagePath: string;
    windowSize: [number, number];
    scale: number;
    updatedAt: string;
}

const success = <T>(data: T): ApiResponse<T> => ({ success: true, data, message: null });
const failure = (message: string): ApiResponse<null> => ({ success: false, data: null, message });

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class UIViewerSession {
    private requestedBundleName?: string;
    private connectKey?: string;
    private readonly outputDir: string;
    private device?: Device;
    private deviceCacheKey?: string;
    private hap?: Hap;
    private lastPage?: Page;
    private lastSnapshot?: Snapshot;
    private lastScreenshotBase64?: string;
    private hierarchy?: HierarchyTree;
    private refreshing: Promise<void> | null;
    private connectPromise: Promise<void> | null;

    constructor(bundleName: string | undefined, connectKey: string | undefined, outputDir: string) {
        this.requestedBundleName = bundleName?.trim() || undefined;
        this.connectKey = connectKey?.trim() || undefined;
        this.outputDir = outputDir;
        this.refreshing = null;
        this.connectPromise = null;
    }

    private describeSession(): string {
        return `connectKey=${this.connectKey ?? 'auto'}, bundle=${this.requestedBundleName ?? 'auto'}, output=${this.outputDir}`;
    }

    private logInfo(message: string): void {
        logger.info(`[UIViewerSession] ${message} | ${this.describeSession()}`);
    }

    private logDebug(message: string): void {
        logger.debug(`[UIViewerSession] ${message} | ${this.describeSession()}`);
    }

    private logWarn(message: string, err?: unknown): void {
        if (err) {
            logger.warn(`[UIViewerSession] ${message} | ${this.describeSession()} | error=${String(err)}`);
        } else {
            logger.warn(`[UIViewerSession] ${message} | ${this.describeSession()}`);
        }
    }

    private invalidateCache(): void {
        this.lastPage = undefined;
        this.lastSnapshot = undefined;
        this.lastScreenshotBase64 = undefined;
        this.hierarchy = undefined;
        this.refreshing = null;
    }

    private async drainRefresh(): Promise<void> {
        const pending = this.refreshing;
        if (!pending) {
            return;
        }
        try {
            await pending;
        } catch {
            // ignore refresh failure
        } finally {
            if (this.refreshing === pending) {
                this.refreshing = null;
            }
        }
    }

    updateBundleName(bundleName?: string) {
        const normalized = bundleName?.trim();
        if (!normalized) {
            if (this.requestedBundleName) {
                this.requestedBundleName = undefined;
                if (this.hap) {
                    this.hap.bundleName = '';
                }
                this.logInfo('Cleared bundle name');
                this.invalidateCache();
            }
            return;
        }

        if (normalized === this.requestedBundleName) {
            return;
        }

        this.requestedBundleName = normalized;
        this.logInfo(`Updated bundle name to ${normalized}`);
        if (this.hap) {
            this.hap.bundleName = normalized;
        }
        this.invalidateCache();
    }

    private async updateConnectKey(connectKey?: string): Promise<void> {
        const normalized = connectKey ? connectKey.trim() : undefined;
        if (normalized === this.connectKey) {
            return;
        }
        this.logInfo(`Updating connect key to ${normalized ?? 'auto'}`);
        if (this.connectPromise) {
            try {
                await this.connectPromise;
            } catch {
                // ignore errors from previous connection attempt
            }
        }
        await this.drainRefresh();
        await this.disposeDevice('connect-key-change');
        this.connectKey = normalized;
    }

    private async disposeDevice(reason: string = 'session-dispose'): Promise<void> {
        await this.drainRefresh();
        if (this.deviceCacheKey) {
            this.logDebug(`Disposing device cache with key=${this.deviceCacheKey} reason=${reason}`);
            const force = reason === 'session-dispose' || reason === 'acquire-failed';
            await DevicePool.release(this.deviceCacheKey, reason, { force });
        }
        this.device = undefined;
        this.hap = undefined;
        this.deviceCacheKey = undefined;
        this.invalidateCache();
    }

    private ensureConnectKeyResolved(): void {
        if (this.connectKey && this.connectKey.length > 0) {
            return;
        }
        let targets: HdcTargetInfo[];
        try {
            targets = Hdc.listTargets();
        } catch (err) {
            throw this.normalizeConnectionError(err);
        }
        const connected = targets.filter((item) => item.state.toLowerCase() === 'connected');
        if (connected.length === 0) {
            throw new Error(
                'No connected devices detected. Please ensure HDC is installed and a device is connected (run "hdc list targets -v").'
            );
        }
        if (connected.length > 1) {
            throw new Error('Multiple connected devices detected. Please select a target device before connecting.');
        }
        this.connectKey = connected[0].serial;
    }

    private normalizeConnectionError(err: unknown): Error {
        const message = err instanceof Error ? err.message : String(err);
        const lower = message.toLowerCase();
        if (
            lower.includes('enoent') ||
            lower.includes('not recognized') ||
            lower.includes('command not found') ||
            lower.includes('hdc: not found')
        ) {
            return new Error('Unable to execute "hdc". Please install HDC and ensure it is available in your PATH.');
        }
        if (lower.includes('need connect-key') || lower.includes('please confirm a device')) {
            return new Error('Multiple devices detected. Please select a target device before connecting.');
        }
        return err instanceof Error ? err : new Error(message);
    }

    getConnectKey(): string | undefined {
        return this.connectKey;
    }

    async listDevices(): Promise<HdcTargetInfo[]> {
        try {
            return Hdc.listTargets();
        } catch (err) {
            throw this.normalizeConnectionError(err);
        }
    }

    getTargetAlias(): string {
        if (this.connectKey) {
            return this.connectKey;
        }
        if (this.device) {
            try {
                return this.device.getUdid();
            } catch (err) {
                logger.warn(`Failed to get device udid: ${String(err)}`);
            }
        }
        return 'local-device';
    }

    private buildFuzzOptions(): FuzzOptions {
        return {
            connectkey: this.connectKey as any,
            hap: this.requestedBundleName ?? '',
            policyName: 'ui-viewer',
            output: this.outputDir,
            coverage: false,
            reportRoot: undefined,
            excludes: undefined,
            llm: false,
            simK: 8,
            staticConfig: undefined,
        };
    }

    private async ensureConnected(): Promise<void> {
        if (this.device && this.hap) {
            DevicePool.touch(this.deviceCacheKey);
            this.logDebug('Device already connected, reusing existing session');
            return;
        }

        if (this.connectPromise) {
            await this.connectPromise;
            return;
        }

        this.connectPromise = (async () => {
            try {
                this.ensureConnectKeyResolved();
                const fuzzOptions = this.buildFuzzOptions();
                this.logInfo(`Acquiring device from pool`);
                const { key, device } = await DevicePool.acquire(fuzzOptions, this.requestedBundleName);
                this.deviceCacheKey = key;
                this.device = device;
                this.hap = new Hap();
                this.hap.bundleName = this.requestedBundleName ?? '';
                DevicePool.touch(this.deviceCacheKey);
                this.logInfo(`Device acquired with cacheKey=${key}`);
            } catch (err) {
                this.logWarn('Failed to acquire device', err);
                await this.disposeDevice('acquire-failed');
                throw this.normalizeConnectionError(err);
            } finally {
                this.connectPromise = null;
            }
        })();

        await this.connectPromise;
    }

    async ensureDeviceConnected(bundleName?: string, connectKey?: string): Promise<void> {
        if (bundleName !== undefined) {
            this.updateBundleName(bundleName);
        }
        if (connectKey !== undefined) {
            await this.updateConnectKey(connectKey);
        }
        this.logInfo('ensureDeviceConnected invoked');
        await this.ensureConnected();
    }

    private async innerRefresh(): Promise<void> {
        await this.ensureConnected();
        DevicePool.touch(this.deviceCacheKey);
        if (!this.device || !this.hap) {
            throw new Error('device is not ready.');
        }

        this.hap.bundleName = this.requestedBundleName ?? '';
        this.logInfo('Refreshing device snapshot');
        const page = await this.device.getCurrentPage(this.hap);
        const snapshot = page.getSnapshot();
        if (!snapshot) {
            throw new Error('Snapshot unavailable from device.');
        }

        const screenshotBase64 = this.loadScreenshot(snapshot.screenCapPath);
        this.lastPage = page;
        this.lastSnapshot = snapshot;
        this.lastScreenshotBase64 = screenshotBase64;
        this.hierarchy = buildHierarchy(page.getRoot());
        this.logInfo('Device snapshot refreshed successfully');
    }

    private loadScreenshot(screenCapPath: string): string {
        const buffer = fs.readFileSync(screenCapPath);
        try {
            fs.unlinkSync(screenCapPath);
        } catch (err) {
            logger.warn(`Failed to remove screenshot file ${screenCapPath}: ${String(err)}`);
        }
        return buffer.toString('base64');
    }

    async refresh(): Promise<void> {
        if (this.refreshing) {
            return this.refreshing;
        }

        this.refreshing = this.innerRefresh()
            .catch((err) => {
                logger.error('Refresh device snapshot failed.', err);
                throw err;
            })
            .finally(() => {
                this.refreshing = null;
            });

        return this.refreshing;
    }

    async ensureHierarchyReady(): Promise<void> {
        if (!this.lastPage || !this.hierarchy || !this.lastSnapshot) {
            await this.refresh();
        }
    }

    async getScreenshot(): Promise<string> {
        await this.refresh();
        if (!this.lastScreenshotBase64) {
            throw new Error('Screenshot not available.');
        }
        return this.lastScreenshotBase64;
    }

    async getHierarchy(): Promise<HierarchyResponse> {
        await this.ensureHierarchyReady();
        if (!this.lastPage || !this.hierarchy || !this.lastSnapshot) {
            throw new Error('Hierarchy not available.');
        }

        return {
            jsonHierarchy: this.hierarchy.root,
            activityName: this.lastPage.getAbilityName(),
            packageName: this.lastPage.getBundleName(),
            pagePath: this.lastPage.getPagePath(),
            windowSize: [this.lastSnapshot.screenWidth, this.lastSnapshot.screenHeight],
            scale: 1,
            updatedAt: new Date().toISOString(),
        };
    }

    async getXPathLite(nodeId: string): Promise<string> {
        await this.ensureHierarchyReady();
        if (!this.hierarchy) {
            throw new Error('Hierarchy not available.');
        }
        return generateXPathLite(nodeId, this.hierarchy);
    }
}

export async function startUIViewerServer(options: UIViewerServerOptions): Promise<void> {
    const app = express();
    app.use(express.json({ limit: '5mb' }));

    const session = new UIViewerSession(options.bundleName, options.connectKey, options.outputDir);

    app.get('/api/version', (_req: Request, res: Response) => {
        res.json(success(options.version));
    });

    app.get('/api/health', (_req: Request, res: Response) => {
        res.json(success('ok'));
    });

    app.get('/api/harmony/devices', async (_req: Request, res: Response) => {
        try {
            const devices = await session.listDevices();
            res.json(success(devices));
        } catch (err) {
            logger.error('Failed to list harmony devices.', err);
            res.status(500).json(failure(err instanceof Error ? err.message : String(err)));
        }
    });

    app.get('/api/harmony/serials', async (_req: Request, res: Response) => {
        try {
            const devices = await session.listDevices();
            res.json(success(devices.map((item) => item.serial)));
        } catch (err) {
            logger.error('Failed to list harmony serials.', err);
            res.status(500).json(failure(err instanceof Error ? err.message : String(err)));
        }
    });

    const connectHandler = async (req: Request, res: Response) => {
        try {
            const { bundleName, connectKey } = req.body ?? {};
            await session.ensureDeviceConnected(bundleName, connectKey);
            res.json(success({ alias: session.getTargetAlias(), connectKey: session.getConnectKey() }));
        } catch (err) {
            logger.error('Failed to connect device.', err);
            res.status(500).json(failure(err instanceof Error ? err.message : String(err)));
        }
    };

    const screenshotHandler = async (_req: Request, res: Response) => {
        try {
            const base64 = await session.getScreenshot();
            res.json(success(base64));
        } catch (err) {
            logger.error('Failed to fetch screenshot.', err);
            res.status(500).json(failure(err instanceof Error ? err.message : String(err)));
        }
    };

    const hierarchyHandler = async (_req: Request, res: Response) => {
        try {
            const data = await session.getHierarchy();
            res.json(success(data));
        } catch (err) {
            logger.error('Failed to fetch hierarchy.', err);
            res.status(500).json(failure(err instanceof Error ? err.message : String(err)));
        }
    };

    app.post('/api/harmony/connect', connectHandler);
    app.post('/api/harmony/:serial/connect', connectHandler);

    app.get('/api/harmony/screenshot', screenshotHandler);
    app.get('/api/harmony/:serial/screenshot', screenshotHandler);

    app.get('/api/harmony/hierarchy', hierarchyHandler);
    app.get('/api/harmony/:serial/hierarchy', hierarchyHandler);

    app.post('/api/harmony/hierarchy/xpathLite', async (req: Request, res: Response) => {
        try {
            const nodeId = req.body?.node_id;
            if (!nodeId) {
                res.status(400).json(failure('node_id is required.'));
                return;
            }
            const xpath = await session.getXPathLite(nodeId);
            res.json(success(xpath));
        } catch (err) {
            logger.error('Failed to fetch xpath.', err);
            res.status(500).json(failure(err instanceof Error ? err.message : String(err)));
        }
    });

    const staticRoot = path.join(__dirname, '../../res/ui-viewer');
    const staticDir = path.join(staticRoot, 'static');
    if (fs.existsSync(staticDir)) {
        app.use('/static', express.static(staticDir));
    } else {
        logger.warn(`Static directory ${staticDir} not found. UI assets may be unavailable.`);
    }

    const indexFile = path.join(staticRoot, 'index.html');
    app.get('/', (_req: Request, res: Response) => {
        if (fs.existsSync(indexFile)) {
            res.sendFile(indexFile);
        } else {
            res.status(404).send('index.html not found');
        }
    });

    app.get('/ui-viewer', (_req: Request, res: Response) => {
        if (fs.existsSync(indexFile)) {
            res.sendFile(indexFile);
        } else {
            res.status(404).send('index.html not found');
        }
    });

    return new Promise((resolve, reject) => {
        const server = app.listen(options.port, () => {
            logger.info(`haptest ui-viewer listening on http://localhost:${options.port}`);
            resolve();
        });
        server.on('error', (err) => {
            logger.error('haptest ui-viewer server error.', err);
            reject(err);
        });
    });
}
