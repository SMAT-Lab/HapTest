import { Page } from '../../model/page';
import { Component } from '../../model/component';
import { CompareSceneIssue, TransitionRecord } from '../types';
import { HapTestLogger } from '../../utils/logger';

const logger = HapTestLogger.getLogger();

const MAX_ANCHOR_TEXT_LENGTH = 12;

export function detectSceneIssues(
    transitionIndex: number,
    mobileTransition: TransitionRecord,
    twoInOneTransition: TransitionRecord,
    mobileScreenshot: string,
    twoInOneScreenshot: string,
    similarityThreshold: number
): CompareSceneIssue[] {
    const mobileEventType = getEventType(mobileTransition);
    const twoInOneEventType = getEventType(twoInOneTransition);
    if (!mobileEventType || !twoInOneEventType || mobileEventType !== twoInOneEventType) {
        return [];
    }

    if (!isLooseSameScene(mobileTransition.from, twoInOneTransition.from, similarityThreshold)) {
        return [];
    }

    const similarity = getBusinessSceneSimilarity(mobileTransition.to, twoInOneTransition.to);
    const sameSceneClass = isSameBusinessSceneClass(
        mobileTransition.to,
        twoInOneTransition.to,
        similarityThreshold,
        similarity
    );

    logger.info(
        `[scene] transition=${transitionIndex} event=${mobileEventType} fromMatch=true toSimilarity=${similarity.toFixed(3)}`
    );

    if (sameSceneClass) {
        return [];
    }

    return [
        {
            transitionIndex,
            eventType: mobileEventType,
            reason: `destination business scene mismatch, similarity=${similarity.toFixed(3)}`,
            similarity,
            mobileFromPagePath: mobileTransition.from.getPagePath(),
            twoInOneFromPagePath: twoInOneTransition.from.getPagePath(),
            mobileToPagePath: mobileTransition.to.getPagePath(),
            twoInOneToPagePath: twoInOneTransition.to.getPagePath(),
            mobileToSceneKey: buildBusinessSceneKey(mobileTransition.to),
            twoInOneToSceneKey: buildBusinessSceneKey(twoInOneTransition.to),
            mobileScreenshot,
            twoInOneScreenshot,
        },
    ];
}

function getEventType(transition: TransitionRecord): string | undefined {
    const json = transition.event?.toJson();
    const type = json?.type;
    return typeof type === 'string' && type.trim().length > 0 ? type.trim() : undefined;
}

function isLooseSameScene(left: Page, right: Page, similarityThreshold: number): boolean {
    if (!isSameAbility(left, right)) {
        return false;
    }

    if (hasSamePagePath(left, right)) {
        return true;
    }

    if (left.getStructualSig() === right.getStructualSig()) {
        return true;
    }

    return getBusinessSceneSimilarity(left, right) >= similarityThreshold;
}

function isSameBusinessSceneClass(
    left: Page,
    right: Page,
    similarityThreshold: number,
    similarity?: number
): boolean {
    if (!isSameAbility(left, right)) {
        return false;
    }

    if (hasSamePagePath(left, right)) {
        return true;
    }

    if (left.getStructualSig() === right.getStructualSig()) {
        return true;
    }

    const sceneSimilarity = similarity ?? getBusinessSceneSimilarity(left, right);
    return sceneSimilarity >= similarityThreshold;
}

function isSameAbility(left: Page, right: Page): boolean {
    return (
        left.getBundleName() === right.getBundleName() &&
        left.getAbilityName() === right.getAbilityName()
    );
}

function hasSamePagePath(left: Page, right: Page): boolean {
    const leftPath = left.getPagePath().trim();
    const rightPath = right.getPagePath().trim();
    return leftPath.length > 0 && leftPath === rightPath;
}

function getBusinessSceneSimilarity(left: Page, right: Page): number {
    const leftAnchors = collectBusinessAnchors(left);
    const rightAnchors = collectBusinessAnchors(right);
    if (leftAnchors.size === 0 || rightAnchors.size === 0) {
        return 0;
    }

    let intersection = 0;
    for (const anchor of leftAnchors) {
        if (rightAnchors.has(anchor)) {
            intersection += 1;
        }
    }

    const union = new Set([...leftAnchors, ...rightAnchors]).size;
    return union === 0 ? 0 : intersection / union;
}

function buildBusinessSceneKey(page: Page): string {
    const anchors = [...collectBusinessAnchors(page)].sort().slice(0, 8);
    return [page.getBundleName(), page.getAbilityName(), page.getPagePath(), anchors.join('|')].join('::');
}

function collectBusinessAnchors(page: Page): Set<string> {
    const anchors = new Set<string>();
    for (const component of page.getComponents()) {
        appendComponentAnchor(anchors, 'id', component.id);
        appendComponentAnchor(anchors, 'key', component.key);
        appendComponentTextAnchor(anchors, component);
    }
    return anchors;
}

function appendComponentAnchor(anchors: Set<string>, prefix: string, value?: string): void {
    const normalized = normalizeAnchorValue(value);
    if (!normalized) {
        return;
    }
    anchors.add(`${prefix}:${normalized}`);
}

function appendComponentTextAnchor(anchors: Set<string>, component: Component): void {
    const text = normalizeTextAnchor(component.text);
    const type = component.type?.trim();
    if (!text || !type) {
        return;
    }
    anchors.add(`text:${type}:${text}`);
}

function normalizeAnchorValue(value?: string): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return undefined;
    }
    return trimmed;
}

function normalizeTextAnchor(text?: string): string | undefined {
    const trimmed = text?.trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed.length > MAX_ANCHOR_TEXT_LENGTH) {
        return undefined;
    }
    if (/^\d+$/.test(trimmed)) {
        return undefined;
    }
    return trimmed;
}