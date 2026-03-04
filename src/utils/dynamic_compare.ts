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
import { Component } from '../model/component';
import { Page } from '../model/page';
import { Point } from '../model/point';
import { ViewTree } from '../model/viewtree';
import { HapTestLogger } from './logger';

const logger = HapTestLogger.getLogger();

export interface CompareOptions {
    outputRoot: string;
    appFolder: string;
    mobileDir?: string;
    twoInOneDir?: string;
    reportPath?: string;
    fullWidthTolerance?: number;
}

export interface CompareIssue {
    pageIndex: number;
    componentName: string;
    mobileScreenshot: string;
    twoInOneScreenshot: string;
}

export interface CompareResult {
    issues: CompareIssue[];
    pageCount: number;
    mobilePages: number;
    twoInOnePages: number;
    mobileScreenshots: number;
    twoInOneScreenshots: number;
}

interface TransitionRecord {
    from: Page;
    to: Page;
}

interface ScreenRect {
    left: number;
    right: number;
}

const DEFAULT_TOLERANCE = 1;
const SCREENSHOT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

export function compareDynamicLogs(options: CompareOptions): CompareResult {
    const mobileDir = options.mobileDir ?? 'mobile';
    const twoInOneDir = options.twoInOneDir ?? '2in1';
    const tolerance = Number.isFinite(options.fullWidthTolerance) ? options.fullWidthTolerance! : DEFAULT_TOLERANCE;

    const mobileResolved = resolveRunDirectories(options.outputRoot, mobileDir, options.appFolder, 'mobile');
    const twoInOneResolved = resolveRunDirectories(options.outputRoot, twoInOneDir, options.appFolder, '2in1');

    const mobileEventsDir = mobileResolved.eventsDir;
    const twoInOneEventsDir = twoInOneResolved.eventsDir;
    const mobileTempDir = mobileResolved.tempDir;
    const twoInOneTempDir = twoInOneResolved.tempDir;

    const mobileTransitions = loadTransitions(mobileEventsDir);
    const twoInOneTransitions = loadTransitions(twoInOneEventsDir);

    const mobilePages = buildPageSequence(mobileTransitions);
    const twoInOnePages = buildPageSequence(twoInOneTransitions);

    const mobileScreenshots = listScreenshots(mobileTempDir);
    const twoInOneScreenshots = listScreenshots(twoInOneTempDir);

    const pageCount = Math.min(mobilePages.length, twoInOnePages.length, mobileScreenshots.length, twoInOneScreenshots.length);
    if (mobilePages.length !== twoInOnePages.length) {
        logger.warn(`Page count mismatch: mobile=${mobilePages.length}, 2in1=${twoInOnePages.length}. Using min=${pageCount}.`);
    }
    if (mobileScreenshots.length !== twoInOneScreenshots.length) {
        logger.warn(
            `Screenshot count mismatch: mobile=${mobileScreenshots.length}, 2in1=${twoInOneScreenshots.length}. Using min=${pageCount}.`
        );
    }

    const issues: CompareIssue[] = [];
    for (let i = 0; i < pageCount; i += 1) {
        const mobilePage = mobilePages[i];
        const twoInOnePage = twoInOnePages[i];
        const mobileScreen = mobileScreenshots[i];
        const twoInOneScreen = twoInOneScreenshots[i];

        const mobileRect = getScreenRect(mobilePage);
        const twoInOneRect = getScreenRect(twoInOnePage);
        if (!mobileRect || !twoInOneRect) {
            logger.warn(`Skipping pageIndex=${i} because screen rect is missing.`);
            continue;
        }

        const mobileMap = buildComponentNameMap(mobilePage);
        const twoInOneMap = buildComponentNameMap(twoInOnePage);
        const sharedNames = new Set<string>();
        for (const name of mobileMap.keys()) {
            if (twoInOneMap.has(name)) {
                sharedNames.add(name);
            }
        }

        for (const name of sharedNames) {
            const mobileComponents = mobileMap.get(name)!;
            const twoInOneComponents = twoInOneMap.get(name)!;
            if (
                hasFullWidthComponent(mobileComponents, mobileRect, tolerance) &&
                hasFullWidthComponent(twoInOneComponents, twoInOneRect, tolerance)
            ) {
                issues.push({
                    pageIndex: i,
                    componentName: name,
                    mobileScreenshot: mobileScreen,
                    twoInOneScreenshot: twoInOneScreen,
                });
            }
        }
    }

    const result: CompareResult = {
        issues,
        pageCount,
        mobilePages: mobilePages.length,
        twoInOnePages: twoInOnePages.length,
        mobileScreenshots: mobileScreenshots.length,
        twoInOneScreenshots: twoInOneScreenshots.length,
    };

    if (options.reportPath) {
        fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
        fs.writeFileSync(options.reportPath, JSON.stringify(result, null, 2), { encoding: 'utf-8' });
        logger.info(`Dynamic compare report saved: ${options.reportPath}`);
    }

    logger.info(`Dynamic compare finished. Issues=${issues.length}, PagesCompared=${pageCount}`);
    return result;
}

function resolveRunDirectories(
    outputRoot: string,
    deviceDir: string,
    appFolder: string,
    label: string
): { eventsDir: string; tempDir: string } {
    const deviceRoot = resolveDeviceRoot(outputRoot, deviceDir, label);
    const appRoot = path.join(deviceRoot, appFolder);
    ensureDirectory(appRoot, `${label} app folder`);

    const runRoot = resolveRunRoot(appRoot, label);
    const eventsDir = path.join(runRoot, 'events');
    const tempDir = path.join(runRoot, 'temp');
    ensureDirectory(eventsDir, `${label} events`);
    ensureDirectory(tempDir, `${label} temp`);
    return { eventsDir, tempDir };
}

function resolveDeviceRoot(outputRoot: string, deviceDir: string, label: string): string {
    const exact = path.join(outputRoot, deviceDir);
    if (fs.existsSync(exact)) {
        return exact;
    }

    const entries = fs.readdirSync(outputRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    const trimmedMatch = entries.find((entry) => entry.name.trim() === deviceDir);
    if (trimmedMatch) {
        const resolved = path.join(outputRoot, trimmedMatch.name);
        logger.warn(`Resolved ${label} device dir "${deviceDir}" -> "${trimmedMatch.name}"`);
        return resolved;
    }

    throw new Error(`Missing ${label} device directory: ${exact}`);
}

function resolveRunRoot(appRoot: string, label: string): string {
    const directEvents = path.join(appRoot, 'events');
    const directTemp = path.join(appRoot, 'temp');
    if (fs.existsSync(directEvents) && fs.existsSync(directTemp)) {
        return appRoot;
    }

    const runDirs = fs
        .readdirSync(appRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => {
            const runRoot = path.join(appRoot, name);
            return fs.existsSync(path.join(runRoot, 'events')) && fs.existsSync(path.join(runRoot, 'temp'));
        })
        .sort()
        .reverse();

    if (runDirs.length === 0) {
        throw new Error(`No run directory with events/temp found under ${label} app folder: ${appRoot}`);
    }

    if (runDirs.length > 1) {
        logger.warn(`Multiple ${label} runs found. Using latest: ${runDirs[0]}`);
    }

    return path.join(appRoot, runDirs[0]);
}

function ensureDirectory(dirPath: string, label: string): void {
    if (!fs.existsSync(dirPath)) {
        throw new Error(`Missing ${label} directory: ${dirPath}`);
    }
}

function loadTransitions(eventsDir: string): TransitionRecord[] {
    const files = fs
        .readdirSync(eventsDir)
        .filter((file) => file.endsWith('.json'))
        .sort();

    return files.map((file) => {
        const fullPath = path.join(eventsDir, file);
        const raw = fs.readFileSync(fullPath, { encoding: 'utf-8' });
        const parsed = JSON.parse(raw) as { from?: unknown; to?: unknown };
        if (!parsed.from || !parsed.to) {
            throw new Error(`Invalid transition file: ${fullPath}`);
        }
        return {
            from: revivePage(parsed.from),
            to: revivePage(parsed.to),
        };
    });
}

function revivePage(raw: any): Page {
    const abilityName = raw?.abilityName ?? '';
    const bundleName = raw?.bundleName ?? '';
    const pagePath = raw?.pagePath ?? '';
    const viewTreeRaw = raw?.viewTree ?? raw?.viewtree ?? raw?.root ?? raw;
    const rootRaw = viewTreeRaw?.root ?? viewTreeRaw;
    if (!rootRaw) {
        throw new Error('Invalid page data: missing viewTree root');
    }
    const root = reviveComponent(rootRaw);
    const viewTree = new ViewTree(root);
    return new Page(viewTree, abilityName, bundleName, pagePath);
}

function reviveComponent(raw: any): Component {
    const component = Object.assign(new Component(), raw);
    component.bounds = parseBounds(raw?.bounds ?? component.bounds);
    component.origBounds = parseBounds(raw?.origBounds ?? component.origBounds);
    const children = Array.isArray(raw?.children) ? raw.children : [];
    component.children = children.map((child: any) => {
        const revived = reviveComponent(child);
        revived.parent = component;
        return revived;
    });
    return component;
}

function parseBounds(bounds: any): Point[] | undefined {
    if (!bounds) {
        return undefined;
    }
    if (typeof bounds === 'string') {
        const regex = /\[(\d+),(\d+)\]/g;
        const points: Point[] = [];
        let match;
        while ((match = regex.exec(bounds)) !== null) {
            points.push({ x: parseInt(match[1], 10), y: parseInt(match[2], 10) });
        }
        return points.length ? points : undefined;
    }
    if (Array.isArray(bounds)) {
        return bounds
            .map((item) => {
                if (!item || typeof item !== 'object') {
                    return undefined;
                }
                const x = Number((item as any).x);
                const y = Number((item as any).y);
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    return { x, y } as Point;
                }
                return undefined;
            })
            .filter((item): item is Point => Boolean(item));
    }
    return undefined;
}

function buildPageSequence(transitions: TransitionRecord[]): Page[] {
    if (transitions.length === 0) {
        return [];
    }
    const pages: Page[] = [];
    pages.push(transitions[0].from);
    for (const transition of transitions) {
        pages.push(transition.to);
    }
    return pages;
}

function listScreenshots(tempDir: string): string[] {
    return fs
        .readdirSync(tempDir)
        .filter((file) => SCREENSHOT_EXTENSIONS.has(path.extname(file).toLowerCase()))
        .sort()
        .map((file) => path.join(tempDir, file));
}

function buildComponentNameMap(page: Page): Map<string, Component[]> {
    const map = new Map<string, Component[]>();
    for (const component of page.getComponents()) {
        const matchKey = buildMatchKey(component);
        if (!matchKey) {
            continue;
        }
        const list = map.get(matchKey);
        if (list) {
            list.push(component);
        } else {
            map.set(matchKey, [component]);
        }
    }
    return map;
}

function buildMatchKey(component: Component): string | undefined {
    const type = component.type?.trim();
    if (!type) {
        return undefined;
    }
    const keyOrId = (component.key ?? component.id ?? '').trim();
    if (!keyOrId) {
        return undefined;
    }
    return `${type}::${keyOrId}`;
}

function hasFullWidthComponent(components: Component[], screenRect: ScreenRect, tolerance: number): boolean {
    return components.some((component) => isFullWidth(component, screenRect, tolerance));
}

function isFullWidth(component: Component, screenRect: ScreenRect, tolerance: number): boolean {
    const rect = getBoundsRect(component.bounds ?? component.origBounds);
    if (!rect) {
        return false;
    }
    return rect.left <= screenRect.left + tolerance && rect.right >= screenRect.right - tolerance;
}

function getScreenRect(page: Page): ScreenRect | undefined {
    const root = page.getRoot();
    const rootRect = getBoundsRect(root.bounds ?? root.origBounds);
    if (rootRect && rootRect.right > rootRect.left) {
        return rootRect;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const component of page.getComponents()) {
        const rect = getBoundsRect(component.bounds ?? component.origBounds);
        if (!rect) {
            continue;
        }
        minX = Math.min(minX, rect.left);
        maxX = Math.max(maxX, rect.right);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) {
        return undefined;
    }

    return { left: minX, right: maxX };
}

function getBoundsRect(bounds?: Point[]): ScreenRect | undefined {
    if (!bounds || bounds.length < 2) {
        return undefined;
    }
    const xs = bounds.map((point) => point.x);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    return { left, right };
}
