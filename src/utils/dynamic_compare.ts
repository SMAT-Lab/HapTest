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
import { HapTestLogger } from './logger';
import { detectAspectRatioIssues } from '../compare/detectors/ratio_detector';
import { detectFullWidthIssues } from '../compare/detectors/full_width_detector';
import { detectSceneIssues } from '../compare/detectors/scene_detector';
import { detectComponentDiffIssues } from '../compare/detectors/diff_detector';
import { OpenAiComponentMatcher } from '../compare/ai_component_matcher';
import {
    buildPageSequence,
    listScreenshots,
    loadTransitions,
    resolveRunDirectories,
} from '../compare/page_loader';
import {
    CompareAspectRatioIssue,
    CompareComponentDiffIssue,
    CompareDetector,
    CompareIssue,
    CompareOptions,
    CompareResult,
    CompareSceneIssue,
    DEFAULT_RATIO_TOLERANCE,
    DEFAULT_SCENE_SIMILARITY_THRESHOLD,
    DEFAULT_TOLERANCE,
} from '../compare/types';

const logger = HapTestLogger.getLogger();

export type {
    CompareAspectRatioIssue,
    CompareComponentDiffIssue,
    CompareDetector,
    CompareIssue,
    CompareOptions,
    CompareResult,
    CompareSceneIssue,
};

export async function compareDynamicLogs(options: CompareOptions): Promise<CompareResult> {
    const detector: CompareDetector = options.detector ?? 'all';
    const runFullWidth = detector === 'all' || detector === 'full-width';
    const runAspectRatio = detector === 'all' || detector === 'ratio';
    const runScene = detector === 'all' || detector === 'scene';
    const runDiff = detector === 'all' || detector === 'diff';
    const mobileDir = options.mobileDir ?? 'mobile';
    const twoInOneDir = options.twoInOneDir ?? '2in1';
    const tolerance = Number.isFinite(options.fullWidthTolerance) ? options.fullWidthTolerance! : DEFAULT_TOLERANCE;
    const aspectRatioTolerance = Number.isFinite(options.aspectRatioTolerance)
        ? options.aspectRatioTolerance!
        : DEFAULT_RATIO_TOLERANCE;
    const sceneSimilarityThreshold = Number.isFinite(options.sceneSimilarityThreshold)
        ? options.sceneSimilarityThreshold!
        : DEFAULT_SCENE_SIMILARITY_THRESHOLD;
    const aiComponentMatcher = options.aiComponentMatch
        ? OpenAiComponentMatcher.createFromConfig({
              configPath: options.aiComponentConfigPath,
              model: options.aiComponentModel,
              threshold: options.aiComponentThreshold,
              maxCalls: options.aiComponentMaxCalls,
          })
        : undefined;
    const aiOnlyMatch = options.aiComponentMatch === true;

    const mobileResolved = resolveRunDirectories(options.outputRoot, mobileDir, options.appFolder, 'mobile');
    const twoInOneResolved = resolveRunDirectories(options.outputRoot, twoInOneDir, options.appFolder, '2in1');

    const mobileTransitions = loadTransitions(mobileResolved.eventsDir);
    const twoInOneTransitions = loadTransitions(twoInOneResolved.eventsDir);

    const mobilePages = buildPageSequence(mobileTransitions);
    const twoInOnePages = buildPageSequence(twoInOneTransitions);

    const mobileScreenshots = listScreenshots(mobileResolved.tempDir);
    const twoInOneScreenshots = listScreenshots(twoInOneResolved.tempDir);

    const pageCount = Math.min(mobilePages.length, twoInOnePages.length, mobileScreenshots.length, twoInOneScreenshots.length);
    const transitionCount = Math.min(mobileTransitions.length, twoInOneTransitions.length);
    if (mobilePages.length !== twoInOnePages.length) {
        logger.warn(`Page count mismatch: mobile=${mobilePages.length}, 2in1=${twoInOnePages.length}. Using min=${pageCount}.`);
    }
    if (mobileScreenshots.length !== twoInOneScreenshots.length) {
        logger.warn(
            `Screenshot count mismatch: mobile=${mobileScreenshots.length}, 2in1=${twoInOneScreenshots.length}. Using min=${pageCount}.`
        );
    }

    const issues: CompareIssue[] = [];
    const aspectRatioIssues: CompareAspectRatioIssue[] = [];
    const sceneIssues: CompareSceneIssue[] = [];
    const componentDiffIssues: CompareComponentDiffIssue[] = [];
    for (let i = 0; i < pageCount; i += 1) {
        const mobilePage = mobilePages[i];
        const twoInOnePage = twoInOnePages[i];
        const mobileScreen = mobileScreenshots[i];
        const twoInOneScreen = twoInOneScreenshots[i];

        if (runFullWidth) {
            const fullWidthFindings = await detectFullWidthIssues(
                i,
                mobilePage,
                twoInOnePage,
                mobileScreen,
                twoInOneScreen,
                tolerance,
                aiComponentMatcher,
                aiOnlyMatch
            );
            issues.push(...fullWidthFindings);
        }

        if (runAspectRatio) {
            const ratioFindings = await detectAspectRatioIssues(
                i,
                mobilePage,
                twoInOnePage,
                mobileScreen,
                twoInOneScreen,
                aspectRatioTolerance,
                aiComponentMatcher,
                aiOnlyMatch
            );
            aspectRatioIssues.push(...ratioFindings);
        }

        if (runDiff) {
            const diffFindings = await detectComponentDiffIssues(
                i,
                mobilePage,
                twoInOnePage,
                mobileScreen,
                twoInOneScreen,
                aiComponentMatcher,
                aiOnlyMatch
            );
            componentDiffIssues.push(...diffFindings);
        }
    }

    if (runScene) {
        for (let i = 0; i < transitionCount; i += 1) {
            const mobileTransition = mobileTransitions[i];
            const twoInOneTransition = twoInOneTransitions[i];
            const mobileScreen = getTransitionScreenshot(mobileScreenshots, i);
            const twoInOneScreen = getTransitionScreenshot(twoInOneScreenshots, i);
            const findings = detectSceneIssues(
                i,
                mobileTransition,
                twoInOneTransition,
                mobileScreen,
                twoInOneScreen,
                sceneSimilarityThreshold
            );
            sceneIssues.push(...findings);
        }
    }

    const result: CompareResult = {
        issues,
        aspectRatioIssues,
        sceneIssues,
        componentDiffIssues,
        pageCount,
        transitionCount,
        mobilePages: mobilePages.length,
        twoInOnePages: twoInOnePages.length,
        mobileTransitions: mobileTransitions.length,
        twoInOneTransitions: twoInOneTransitions.length,
        mobileScreenshots: mobileScreenshots.length,
        twoInOneScreenshots: twoInOneScreenshots.length,
    };

    if (options.reportPath) {
        fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
        fs.writeFileSync(options.reportPath, JSON.stringify(result, null, 2), { encoding: 'utf-8' });
        logger.info(`Dynamic compare report saved: ${options.reportPath}`);
    }

    const issueCounters: string[] = [];
    const fullWidthIssueCount = issues.length;
    const aspectRatioIssueCount = aspectRatioIssues.length;
    const sceneIssueCount = sceneIssues.length;
    const componentDiffIssueCount = componentDiffIssues.length;

    if (detector === 'all') {
        const totalIssues = fullWidthIssueCount + aspectRatioIssueCount + sceneIssueCount + componentDiffIssueCount;
        issueCounters.push(`Issues=${totalIssues}`);
        issueCounters.push(`FullWidthIssues=${fullWidthIssueCount}`);
        issueCounters.push(`AspectRatioIssues=${aspectRatioIssueCount}`);
        issueCounters.push(`SceneIssues=${sceneIssueCount}`);
        issueCounters.push(`ComponentDiffIssues=${componentDiffIssueCount}`);
    } else {
        if (runFullWidth) {
            issueCounters.push(`FullWidthIssues=${fullWidthIssueCount}`);
        }
        if (runAspectRatio) {
            issueCounters.push(`AspectRatioIssues=${aspectRatioIssueCount}`);
        }
        if (runScene) {
            issueCounters.push(`SceneIssues=${sceneIssueCount}`);
        }
        if (runDiff) {
            issueCounters.push(`ComponentDiffIssues=${componentDiffIssueCount}`);
        }
    }
    const detectorSummary = issueCounters.join(', ');

    logger.info(
        `Dynamic compare finished. Detector=${detector}, ${detectorSummary}, PagesCompared=${pageCount}, TransitionsCompared=${transitionCount}`
    );
    return result;
}

function getTransitionScreenshot(screenshots: string[], transitionIndex: number): string {
    if (screenshots.length === 0) {
        return '';
    }
    return screenshots[Math.min(transitionIndex + 1, screenshots.length - 1)];
}
