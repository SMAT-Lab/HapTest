import { Page } from '../../model/page';
import { Component } from '../../model/component';
import { AiComponentMatcher, buildComponentNameMap, matchComponentNameMaps } from '../component_matcher';
import { getBoundsRect, getScreenRect } from '../geometry';
import { CompareIssue, ScreenRect } from '../types';
import { HapTestLogger } from '../../utils/logger';

const logger = HapTestLogger.getLogger();

export async function detectFullWidthIssues(
    pageIndex: number,
    mobilePage: Page,
    twoInOnePage: Page,
    mobileScreenshot: string,
    twoInOneScreenshot: string,
    tolerance: number,
    aiMatcher?: AiComponentMatcher,
    aiOnlyMatch = false
): Promise<CompareIssue[]> {
    const mobileRect = getScreenRect(mobilePage);
    const twoInOneRect = getScreenRect(twoInOnePage);
    if (!mobileRect || !twoInOneRect) {
        return [];
    }

    const mobileMap = buildComponentNameMap(mobilePage);
    const twoInOneMap = buildComponentNameMap(twoInOnePage);
    const matchedGroups = await matchComponentNameMaps(mobileMap, twoInOneMap, aiMatcher, { aiOnly: aiOnlyMatch });

    let matchedComponentCount = 0;
    let aiMatchedCount = 0;
    for (const group of matchedGroups) {
        const mobileComponents = group.mobileComponents;
        const twoInOneComponents = group.twoInOneComponents;
        matchedComponentCount += Math.min(mobileComponents.length, twoInOneComponents.length);
        if (group.aiMatched) {
            aiMatchedCount += 1;
        }
    }
    const aiLog = aiMatcher ? ` (ai-matched: ${aiMatchedCount})` : '';
    logger.info(`[full-width] Matched components: ${matchedComponentCount}${aiLog} (pageIndex=${pageIndex})`);

    const issues: CompareIssue[] = [];
    for (const group of matchedGroups) {
        const mobileComponents = group.mobileComponents;
        const twoInOneComponents = group.twoInOneComponents;
        if (
            hasFullWidthComponent(mobileComponents, mobileRect, tolerance) &&
            hasFullWidthComponent(twoInOneComponents, twoInOneRect, tolerance)
        ) {
            issues.push({
                pageIndex,
                componentName: group.matchedName,
                mobileScreenshot,
                twoInOneScreenshot,
            });
        }
    }
    return issues;
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
