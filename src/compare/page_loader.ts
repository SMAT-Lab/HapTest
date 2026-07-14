import fs from 'fs';
import path from 'path';
import { EventBuilder } from '../event/event_builder';
import { Component } from '../model/component';
import { Page } from '../model/page';
import { Point } from '../model/point';
import { ViewTree } from '../model/viewtree';
import { HapTestLogger } from '../utils/logger';
import { SCREENSHOT_EXTENSIONS, TransitionRecord } from './types';

const logger = HapTestLogger.getLogger();

export function resolveRunDirectories(
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

export function loadTransitions(eventsDir: string): TransitionRecord[] {
    const files = fs
        .readdirSync(eventsDir)
        .filter((file) => file.endsWith('.json'))
        .sort();

    return files.map((file) => {
        const fullPath = path.join(eventsDir, file);
        const raw = fs.readFileSync(fullPath, { encoding: 'utf-8' });
        const parsed = JSON.parse(raw) as { from?: unknown; event?: unknown; to?: unknown };
        if (!parsed.from || !parsed.to) {
            throw new Error(`Invalid transition file: ${fullPath}`);
        }
        return {
            from: revivePage(parsed.from),
            event: parsed.event ? EventBuilder.createEventFromJson(parsed.event) : undefined,
            to: revivePage(parsed.to),
        };
    });
}

export function buildPageSequence(transitions: TransitionRecord[]): Page[] {
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

export function listScreenshots(tempDir: string): string[] {
    return fs
        .readdirSync(tempDir)
        .filter((file) => SCREENSHOT_EXTENSIONS.has(path.extname(file).toLowerCase()))
        .sort()
        .map((file) => path.join(tempDir, file));
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
