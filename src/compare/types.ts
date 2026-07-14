import { Event } from '../event/event';
import { Page } from '../model/page';

export type CompareDetector = 'all' | 'full-width' | 'ratio' | 'scene' | 'diff';

export interface CompareOptions {
    outputRoot: string;
    appFolder: string;
    mobileDir?: string;
    twoInOneDir?: string;
    reportPath?: string;
    fullWidthTolerance?: number;
    aspectRatioTolerance?: number;
    sceneSimilarityThreshold?: number;
    detector?: CompareDetector;
    aiComponentMatch?: boolean;
    aiComponentModel?: string;
    aiComponentThreshold?: number;
    aiComponentMaxCalls?: number;
    aiComponentConfigPath?: string;
}

export interface CompareIssue {
    pageIndex: number;
    componentName: string;
    mobileScreenshot: string;
    twoInOneScreenshot: string;
}

export interface CompareAspectRatioIssue {
    pageIndex: number;
    componentName: string;
    parentName: string;
    mobileAspectRatio: number;
    twoInOneAspectRatio: number;
    mobileScreenshot: string;
    twoInOneScreenshot: string;
}

export interface CompareSceneIssue {
    transitionIndex: number;
    eventType: string;
    reason: string;
    similarity: number;
    mobileFromPagePath: string;
    twoInOneFromPagePath: string;
    mobileToPagePath: string;
    twoInOneToPagePath: string;
    mobileToSceneKey: string;
    twoInOneToSceneKey: string;
    mobileScreenshot: string;
    twoInOneScreenshot: string;
}

export interface CompareComponentFieldDiff {
    field: string;
    mobileValue: string;
    twoInOneValue: string;
}

export interface CompareComponentDiffGroups {
    structuralDiffs: CompareComponentFieldDiff[];
    statusDiffs: CompareComponentFieldDiff[];
    textDiffs: CompareComponentFieldDiff[];
}

export interface CompareComponentDiffIssue {
    pageIndex: number;
    componentName: string;
    parentName: string;
    mobileScreenshot: string;
    twoInOneScreenshot: string;
    diffs: CompareComponentDiffGroups;
}

export interface CompareResult {
    issues: CompareIssue[];
    aspectRatioIssues: CompareAspectRatioIssue[];
    sceneIssues: CompareSceneIssue[];
    componentDiffIssues: CompareComponentDiffIssue[];
    pageCount: number;
    transitionCount: number;
    mobilePages: number;
    twoInOnePages: number;
    mobileTransitions: number;
    twoInOneTransitions: number;
    mobileScreenshots: number;
    twoInOneScreenshots: number;
}

export interface TransitionRecord {
    from: Page;
    event?: Event;
    to: Page;
}

export interface ScreenRect {
    left: number;
    right: number;
}

export interface BoundsBox {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export const DEFAULT_TOLERANCE = 1;
export const DEFAULT_RATIO_TOLERANCE = 0.01;
export const DEFAULT_SCENE_SIMILARITY_THRESHOLD = 0.35;
export const SCREENSHOT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
