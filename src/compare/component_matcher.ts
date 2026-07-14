import { Component } from '../model/component';
import { Page } from '../model/page';

export interface ComponentWithParent {
    component: Component;
    componentName: string;
    parentName: string;
}

export interface AiComponentMatchContext {
    mode: 'type-and-identity' | 'parent-and-identity';
    mobileKey: string;
    twoInOneKey: string;
}

export interface AiComponentMatcher {
    isSameComponent(
        mobileComponent: Component,
        twoInOneComponent: Component,
        context: AiComponentMatchContext
    ): Promise<boolean>;
}

export interface MatchedNameComponents {
    mobileKey: string;
    twoInOneKey: string;
    matchedName: string;
    mobileComponents: Component[];
    twoInOneComponents: Component[];
    aiMatched: boolean;
}

export interface MatchedParentComponents {
    mobileKey: string;
    twoInOneKey: string;
    matchedName: string;
    mobileComponents: ComponentWithParent[];
    twoInOneComponents: ComponentWithParent[];
    aiMatched: boolean;
}

export interface ComponentMatchOptions {
    aiOnly?: boolean;
}

export function buildComponentNameMap(page: Page): Map<string, Component[]> {
    const map = new Map<string, Component[]>();
    for (const component of page.getComponents()) {
        const matchKey = buildTypeAndIdentityMatchKey(component);
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

export function buildComponentParentMap(page: Page): Map<string, ComponentWithParent[]> {
    const map = new Map<string, ComponentWithParent[]>();
    for (const component of page.getComponents()) {
        const key = buildParentIdentityMatchKey(component);
        if (!key) {
            continue;
        }
        const componentName = getIdentityLabel(component);
        const parentName = component.parent ? getIdentityLabel(component.parent) : 'ROOT';
        if (!componentName || !parentName) {
            continue;
        }
        const item: ComponentWithParent = {
            component,
            componentName,
            parentName,
        };
        const list = map.get(key);
        if (list) {
            list.push(item);
        } else {
            map.set(key, [item]);
        }
    }
    return map;
}

export async function matchComponentNameMaps(
    mobileMap: Map<string, Component[]>,
    twoInOneMap: Map<string, Component[]>,
    aiMatcher?: AiComponentMatcher,
    options: ComponentMatchOptions = {}
): Promise<MatchedNameComponents[]> {
    const aiOnly = options.aiOnly === true;
    const matches: MatchedNameComponents[] = [];
    const usedTwoInOneKeys = new Set<string>();

    if (!aiOnly) {
        for (const mobileKey of mobileMap.keys()) {
            if (!twoInOneMap.has(mobileKey)) {
                continue;
            }
            usedTwoInOneKeys.add(mobileKey);
            matches.push({
                mobileKey,
                twoInOneKey: mobileKey,
                matchedName: mobileKey,
                mobileComponents: mobileMap.get(mobileKey)!,
                twoInOneComponents: twoInOneMap.get(mobileKey)!,
                aiMatched: false,
            });
        }
    }

    if (!aiMatcher) {
        return matches;
    }

    const unresolvedMobileKeys = aiOnly
        ? [...mobileMap.keys()]
        : [...mobileMap.keys()].filter((mobileKey) => !twoInOneMap.has(mobileKey));
    const unresolvedTwoInOneKeys = aiOnly
        ? [...twoInOneMap.keys()]
        : [...twoInOneMap.keys()].filter((twoInOneKey) => !usedTwoInOneKeys.has(twoInOneKey));

    for (const mobileKey of unresolvedMobileKeys) {
        const mobileComponents = mobileMap.get(mobileKey);
        if (!mobileComponents || mobileComponents.length === 0) {
            continue;
        }
        const representativeMobile = pickRepresentativeComponent(mobileComponents);
        if (!representativeMobile) {
            continue;
        }

        let matchedTwoInOneKey: string | undefined;
        for (const twoInOneKey of unresolvedTwoInOneKeys) {
            if (usedTwoInOneKeys.has(twoInOneKey)) {
                continue;
            }
            const twoInOneComponents = twoInOneMap.get(twoInOneKey);
            if (!twoInOneComponents || twoInOneComponents.length === 0) {
                continue;
            }
            const representativeTwoInOne = pickRepresentativeComponent(twoInOneComponents);
            if (!representativeTwoInOne) {
                continue;
            }
            if (!isSameType(representativeMobile, representativeTwoInOne)) {
                continue;
            }

            const isSame = await aiMatcher.isSameComponent(representativeMobile, representativeTwoInOne, {
                mode: 'type-and-identity',
                mobileKey,
                twoInOneKey,
            });
            if (!isSame) {
                continue;
            }

            matchedTwoInOneKey = twoInOneKey;
            break;
        }

        if (!matchedTwoInOneKey) {
            continue;
        }

        usedTwoInOneKeys.add(matchedTwoInOneKey);
        matches.push({
            mobileKey,
            twoInOneKey: matchedTwoInOneKey,
            matchedName: `${mobileKey}~${matchedTwoInOneKey}`,
            mobileComponents: mobileComponents,
            twoInOneComponents: twoInOneMap.get(matchedTwoInOneKey)!,
            aiMatched: true,
        });
    }

    return matches;
}

export async function matchComponentParentMaps(
    mobileMap: Map<string, ComponentWithParent[]>,
    twoInOneMap: Map<string, ComponentWithParent[]>,
    aiMatcher?: AiComponentMatcher,
    options: ComponentMatchOptions = {}
): Promise<MatchedParentComponents[]> {
    const aiOnly = options.aiOnly === true;
    const matches: MatchedParentComponents[] = [];
    const usedTwoInOneKeys = new Set<string>();

    if (!aiOnly) {
        for (const mobileKey of mobileMap.keys()) {
            if (!twoInOneMap.has(mobileKey)) {
                continue;
            }
            usedTwoInOneKeys.add(mobileKey);
            matches.push({
                mobileKey,
                twoInOneKey: mobileKey,
                matchedName: mobileKey,
                mobileComponents: mobileMap.get(mobileKey)!,
                twoInOneComponents: twoInOneMap.get(mobileKey)!,
                aiMatched: false,
            });
        }
    }

    if (!aiMatcher) {
        return matches;
    }

    const unresolvedMobileKeys = aiOnly
        ? [...mobileMap.keys()]
        : [...mobileMap.keys()].filter((mobileKey) => !twoInOneMap.has(mobileKey));
    const unresolvedTwoInOneKeys = aiOnly
        ? [...twoInOneMap.keys()]
        : [...twoInOneMap.keys()].filter((twoInOneKey) => !usedTwoInOneKeys.has(twoInOneKey));

    for (const mobileKey of unresolvedMobileKeys) {
        const mobileComponents = mobileMap.get(mobileKey);
        if (!mobileComponents || mobileComponents.length === 0) {
            continue;
        }
        const representativeMobile = pickRepresentativeWithParent(mobileComponents);
        if (!representativeMobile) {
            continue;
        }

        let matchedTwoInOneKey: string | undefined;
        for (const twoInOneKey of unresolvedTwoInOneKeys) {
            if (usedTwoInOneKeys.has(twoInOneKey)) {
                continue;
            }
            const twoInOneComponents = twoInOneMap.get(twoInOneKey);
            if (!twoInOneComponents || twoInOneComponents.length === 0) {
                continue;
            }
            const representativeTwoInOne = pickRepresentativeWithParent(twoInOneComponents);
            if (!representativeTwoInOne) {
                continue;
            }
            if (!isSameType(representativeMobile.component, representativeTwoInOne.component)) {
                continue;
            }

            const isSame = await aiMatcher.isSameComponent(
                representativeMobile.component,
                representativeTwoInOne.component,
                {
                    mode: 'parent-and-identity',
                    mobileKey,
                    twoInOneKey,
                }
            );
            if (!isSame) {
                continue;
            }

            matchedTwoInOneKey = twoInOneKey;
            break;
        }

        if (!matchedTwoInOneKey) {
            continue;
        }

        usedTwoInOneKeys.add(matchedTwoInOneKey);
        matches.push({
            mobileKey,
            twoInOneKey: matchedTwoInOneKey,
            matchedName: `${mobileKey}~${matchedTwoInOneKey}`,
            mobileComponents: mobileComponents,
            twoInOneComponents: twoInOneMap.get(matchedTwoInOneKey)!,
            aiMatched: true,
        });
    }

    return matches;
}

function buildTypeAndIdentityMatchKey(component: Component): string | undefined {
    const type = component.type?.trim();
    if (!type) {
        return undefined;
    }
    const keyOrId = getIdentityLabel(component);
    if (!keyOrId) {
        return undefined;
    }
    return `${type}::${keyOrId}`;
}

function buildParentIdentityMatchKey(component: Component): string | undefined {
    const componentIdentity = getIdentityLabel(component);
    const parentIdentity = component.parent ? getIdentityLabel(component.parent) : 'ROOT';
    if (!componentIdentity || !parentIdentity) {
        return undefined;
    }
    return `${parentIdentity}>>${componentIdentity}`;
}

function getIdentityLabel(component: Component): string | undefined {
    const identity = (component.key ?? component.id ?? '').trim();
    if (!identity) {
        return undefined;
    }
    return identity;
}

function pickRepresentativeComponent(components: Component[]): Component | undefined {
    return components.find((component) => !!component.type?.trim()) ?? components[0];
}

function pickRepresentativeWithParent(components: ComponentWithParent[]): ComponentWithParent | undefined {
    return components.find((item) => !!item.component.type?.trim()) ?? components[0];
}

function isSameType(left: Component, right: Component): boolean {
    const leftType = left.type?.trim();
    const rightType = right.type?.trim();
    return !!leftType && leftType === rightType;
}
