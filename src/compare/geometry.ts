import { Component } from '../model/component';
import { Page } from '../model/page';
import { Point } from '../model/point';
import { BoundsBox, ScreenRect } from './types';

export function getScreenRect(page: Page): ScreenRect | undefined {
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

export function getBoundsRect(bounds?: Point[]): ScreenRect | undefined {
    const box = getBoundsBox(bounds);
    if (!box) {
        return undefined;
    }
    return { left: box.left, right: box.right };
}

export function getBoundsBox(bounds?: Point[]): BoundsBox | undefined {
    if (!bounds || bounds.length < 2) {
        return undefined;
    }
    const xs = bounds.map((point) => point.x);
    const ys = bounds.map((point) => point.y);
    return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
    };
}

export function getAspectRatio(component: Component): number | undefined {
    const rect = getBoundsBox(component.bounds ?? component.origBounds);
    if (!rect) {
        return undefined;
    }
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    if (width <= 0 || height <= 0) {
        return undefined;
    }
    return width / height;
}
