import { Page } from '../../model/page';
import { AiComponentMatcher, buildComponentParentMap, matchComponentParentMaps } from '../component_matcher';
import { getAspectRatio } from '../geometry';
import { CompareAspectRatioIssue } from '../types';
import { HapTestLogger } from '../../utils/logger';

const logger = HapTestLogger.getLogger();

export async function detectAspectRatioIssues(
    pageIndex: number,
    mobilePage: Page,
    twoInOnePage: Page,
    mobileScreenshot: string,
    twoInOneScreenshot: string,
    tolerance: number,
    aiMatcher?: AiComponentMatcher,
    aiOnlyMatch = false
): Promise<CompareAspectRatioIssue[]> {
    const mobileParentMap = buildComponentParentMap(mobilePage);
    const twoInOneParentMap = buildComponentParentMap(twoInOnePage);
    const matchedGroups = await matchComponentParentMaps(mobileParentMap, twoInOneParentMap, aiMatcher, { aiOnly: aiOnlyMatch });

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
    logger.info(`[ratio] Matched components: ${matchedComponentCount}${aiLog} (pageIndex=${pageIndex})`);

    const issues: CompareAspectRatioIssue[] = [];
    for (const group of matchedGroups) {
        const mobileComponents = group.mobileComponents;
        const twoInOneComponents = group.twoInOneComponents;
        const pairCount = Math.min(mobileComponents.length, twoInOneComponents.length);
        for (let index = 0; index < pairCount; index += 1) {
            const mobileComponent = mobileComponents[index];
            const twoInOneComponent = twoInOneComponents[index];
            const mobileRatio = getAspectRatio(mobileComponent.component);
            const twoInOneRatio = getAspectRatio(twoInOneComponent.component);
            if (mobileRatio === undefined || twoInOneRatio === undefined) {
                continue;
            }
            if (Math.abs(mobileRatio - twoInOneRatio) > tolerance) {
                issues.push({
                    pageIndex,
                    componentName: mobileComponent.componentName,
                    parentName: mobileComponent.parentName,
                    mobileAspectRatio: mobileRatio,
                    twoInOneAspectRatio: twoInOneRatio,
                    mobileScreenshot,
                    twoInOneScreenshot,
                });
            }
        }
    }

    return issues;
}
