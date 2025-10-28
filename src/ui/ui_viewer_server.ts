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
import { Hap } from '../model/hap';
import { FuzzOptions } from '../runner/fuzz_options';
import { LOG_LEVEL } from '../utils/logger';
import { HierarchyTree, buildHierarchy, generateXPathLite } from './hierarchy_builder';
import { Snapshot } from '../model/snapshot';
import { Page } from '../model/page';

const logger = getLogger('haptest-ui-viewer');

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

class UIViewerSession {
    private requestedBundleName?: string;
    private connectKey?: string;
    private readonly outputDir: string;
    private device?: Device;
    private hap?: Hap;
    private lastPage?: Page;
    private lastSnapshot?: Snapshot;
    private lastScreenshotBase64?: string;
    private hierarchy?: HierarchyTree;
    private refreshing: Promise<void> | null;

    constructor(bundleName: string | undefined, connectKey: string | undefined, outputDir: string) {
        this.requestedBundleName = bundleName?.trim() || undefined;
        this.connectKey = connectKey;
        this.outputDir = outputDir;
        this.refreshing = null;
    }

    private invalidateCache(): void {
        this.lastPage = undefined;
        this.lastSnapshot = undefined;
        this.lastScreenshotBase64 = undefined;
        this.hierarchy = undefined;
    }

    updateBundleName(bundleName?: string) {
        const normalized = bundleName?.trim();
        if (!normalized) {
            if (this.requestedBundleName) {
                this.requestedBundleName = undefined;
                if (this.hap) {
                    this.hap.bundleName = '';
                }
                this.invalidateCache();
            }
            return;
        }

        if (normalized === this.requestedBundleName) {
            return;
        }

        this.requestedBundleName = normalized;
        if (this.hap) {
            this.hap.bundleName = normalized;
        }
        this.invalidateCache();
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
            return;
        }

        const fuzzOptions = this.buildFuzzOptions();
        this.device = new Device(fuzzOptions);
        this.hap = new Hap();
        this.hap.bundleName = this.requestedBundleName ?? '';
        await this.device.connect(this.hap);
    }

    async ensureDeviceConnected(bundleName?: string): Promise<void> {
        if (bundleName !== undefined) {
            this.updateBundleName(bundleName);
        }
        await this.ensureConnected();
    }

    private async innerRefresh(): Promise<void> {
        await this.ensureConnected();
        if (!this.device || !this.hap) {
            throw new Error('device is not ready.');
        }

        this.hap.bundleName = this.requestedBundleName ?? '';
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

    app.get('/api/harmony/serials', (_req: Request, res: Response) => {
        res.json(success([session.getTargetAlias()]));
    });

    const connectHandler = async (req: Request, res: Response) => {
        try {
            const { bundleName } = req.body ?? {};
            await session.ensureDeviceConnected(bundleName);
            res.json(success({ alias: session.getTargetAlias() }));
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
