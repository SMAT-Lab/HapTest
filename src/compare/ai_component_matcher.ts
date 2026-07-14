import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { Component } from '../model/component';
import { HapTestLogger } from '../utils/logger';
import { AiComponentMatchContext, AiComponentMatcher } from './component_matcher';

interface GptConfig {
    baseURL?: string;
    apiKey?: string;
    siteURL?: string;
    appName?: string;
}

interface AiCompareResponse {
    same?: boolean;
    confidence?: number;
    reason?: string;
}

export interface OpenAiComponentMatcherOptions {
    configPath?: string;
    model?: string;
    threshold?: number;
    maxCalls?: number;
}

const DEFAULT_MODEL = 'openrouter/free';
const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_MAX_CALLS = 200;
const DEFAULT_TIMEOUT_MS = 45000;
const RETRY_ATTEMPTS = 3;
const STRUCTURE_PARENT_DEPTH = 4;
const STRUCTURE_CHILD_PREVIEW = 6;
const STRUCTURE_DESCENDANT_DEPTH = 2;
const STRUCTURE_DESCENDANT_SAMPLE_LIMIT = 24;
const STRUCTURE_SIBLING_WINDOW = 2;

const OPENROUTER_FREE_MODEL_FALLBACKS = [
    'openrouter/free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
];

const logger = HapTestLogger.getLogger();

export class OpenAiComponentMatcher implements AiComponentMatcher {
    private readonly openai: OpenAI;
    private readonly model: string;
    private readonly baseURL?: string;
    private readonly threshold: number;
    private readonly maxCalls: number;
    private readonly cache: Map<string, boolean> = new Map();
    private calls = 0;

    constructor(openai: OpenAI, model: string, threshold: number, maxCalls: number, baseURL?: string) {
        this.openai = openai;
        this.model = model;
        this.threshold = threshold;
        this.maxCalls = maxCalls;
        this.baseURL = baseURL;
    }

    static createFromConfig(options: OpenAiComponentMatcherOptions = {}): OpenAiComponentMatcher | undefined {
        const configPath = path.resolve(options.configPath ?? path.join(__dirname, '../../config.json'));
        let gptConfig: GptConfig | undefined;
        try {
            const raw = fs.readFileSync(configPath, { encoding: 'utf-8' });
            const json = JSON.parse(raw) as { GPT_CONFIG?: GptConfig };
            gptConfig = json.GPT_CONFIG;
        } catch (error) {
            logger.warn(`[ai-match] Skip AI component match because config is unreadable: ${String(error)}`);
            return undefined;
        }

        const apiKey = gptConfig?.apiKey?.trim();
        if (!apiKey) {
            logger.warn('[ai-match] Skip AI component match because GPT_CONFIG.apiKey is empty.');
            return undefined;
        }

        const baseURL = gptConfig?.baseURL?.trim() || undefined;
        const openRouterHeaders = buildOpenRouterHeaders(baseURL, gptConfig);

        const openai = new OpenAI({
            apiKey,
            baseURL,
            timeout: DEFAULT_TIMEOUT_MS,
            maxRetries: 0,
            defaultHeaders: openRouterHeaders,
        });

        const model = options.model?.trim() || DEFAULT_MODEL;
        const threshold = Number.isFinite(options.threshold) ? options.threshold! : DEFAULT_THRESHOLD;
        const maxCalls = Number.isFinite(options.maxCalls) ? options.maxCalls! : DEFAULT_MAX_CALLS;
        logger.info(`[ai-match] Enabled AI component matcher (model=${model}, threshold=${threshold}, maxCalls=${maxCalls})`);
        return new OpenAiComponentMatcher(openai, model, threshold, maxCalls, baseURL);
    }

    async isSameComponent(
        mobileComponent: Component,
        twoInOneComponent: Component,
        context: AiComponentMatchContext
    ): Promise<boolean> {
        const cacheKey = this.buildCacheKey(mobileComponent, twoInOneComponent, context);
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        if (this.calls >= this.maxCalls) {
            this.cache.set(cacheKey, false);
            return false;
        }

        this.calls += 1;

        const modelCandidates = this.resolveModelCandidates();

        for (const model of modelCandidates) {
            let lastError: unknown;
            for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
                try {
                    const response = await this.openai.chat.completions.create({
                        model,
                        temperature: 0,
                        messages: [
                            {
                                role: 'system',
                                content:
                                    'You are a strict GUI component matcher. Decide if two components represent the same business UI element across devices. Structural context (ancestor chain, sibling neighborhood, child/descendant patterns) is high-priority evidence when identity fields are missing. Respond with compact JSON only: {"same": boolean, "confidence": number, "reason": string}.',
                            },
                            {
                                role: 'user',
                                content: this.buildPrompt(mobileComponent, twoInOneComponent, context),
                            },
                        ],
                    });

                    const content = response.choices[0]?.message?.content?.trim() ?? '';
                    const parsed = this.parseResponse(content);
                    const sameByFlag = parsed.same === true;
                    const confidence = Number.isFinite(parsed.confidence) ? parsed.confidence! : 0.5;
                    const decision = sameByFlag && confidence >= this.threshold;
                    this.cache.set(cacheKey, decision);
                    return decision;
                } catch (error) {
                    lastError = error;
                    const shouldRetry = isConnectionLikeError(error) && attempt < RETRY_ATTEMPTS;
                    const modelInfo = model === this.model ? model : `${this.model}->${model}`;
                    logger.warn(
                        `[ai-match] LLM call failed (model=${modelInfo}, attempt=${attempt}/${RETRY_ATTEMPTS}): ${String(error)}`
                    );
                    if (!shouldRetry) {
                        break;
                    }
                    await sleep(attempt * 500);
                }
            }

            if (!isConnectionLikeError(lastError)) {
                break;
            }
        }

        this.cache.set(cacheKey, false);
        return false;
    }

    private resolveModelCandidates(): string[] {
        if (!isOpenRouterBaseURL(this.baseURL)) {
            return [this.model];
        }

        if (this.model !== 'openrouter/free') {
            return [this.model];
        }

        return OPENROUTER_FREE_MODEL_FALLBACKS;
    }

    private buildPrompt(mobileComponent: Component, twoInOneComponent: Component, context: AiComponentMatchContext): string {
        const payload = {
            mode: context.mode,
            mobileKey: context.mobileKey,
            twoInOneKey: context.twoInOneKey,
            mobile: this.summarizeComponent(mobileComponent),
            twoInOne: this.summarizeComponent(twoInOneComponent),
            rules: [
                'Type must be semantically compatible.',
                'Prefer key/id/name/text/hint consistency.',
                'Treat parent-child nesting and nearby siblings as strong evidence, especially when text/id/key are empty.',
                'Use bounds only as weak evidence because resolution differs across devices.',
                'If uncertain, return same=false.',
            ],
        };
        return JSON.stringify(payload);
    }

    private summarizeComponent(component: Component): Record<string, unknown> {
        const bounds = component.bounds ?? component.origBounds;
        const left = bounds?.[0]?.x;
        const top = bounds?.[0]?.y;
        const right = bounds?.[1]?.x;
        const bottom = bounds?.[1]?.y;
        return {
            type: component.type?.trim() ?? '',
            id: component.id?.trim() ?? '',
            key: component.key?.trim() ?? '',
            name: component.name?.trim() ?? '',
            text: component.text?.trim() ?? '',
            hint: component.hint?.trim() ?? '',
            width: Number.isFinite(left) && Number.isFinite(right) ? Math.abs((right as number) - (left as number)) : null,
            height: Number.isFinite(top) && Number.isFinite(bottom) ? Math.abs((bottom as number) - (top as number)) : null,
            structure: this.summarizeStructure(component),
        };
    }

    private summarizeStructure(component: Component): Record<string, unknown> {
        const parentChain = this.collectParentChain(component, STRUCTURE_PARENT_DEPTH).map((item) =>
            this.summarizeNodeIdentity(item)
        );
        const siblingContext = this.collectSiblingContext(component);
        const childPreview = (component.children ?? [])
            .slice(0, STRUCTURE_CHILD_PREVIEW)
            .map((child) => ({
                ...this.summarizeNodeIdentity(child),
                childCount: child.children?.length ?? 0,
            }));
        const descendantTypeHistogram = this.collectDescendantTypeHistogram(
            component,
            STRUCTURE_DESCENDANT_DEPTH,
            STRUCTURE_DESCENDANT_SAMPLE_LIMIT
        );

        return {
            parentChain,
            siblingContext,
            childCount: component.children?.length ?? 0,
            childPreview,
            descendantTypeHistogram,
        };
    }

    private collectParentChain(component: Component, depth: number): Component[] {
        const chain: Component[] = [];
        let current = component.parent ?? null;
        let remaining = depth;
        while (current && remaining > 0) {
            chain.push(current);
            current = current.parent ?? null;
            remaining -= 1;
        }
        return chain;
    }

    private collectSiblingContext(component: Component): Record<string, unknown> {
        const siblings = component.parent?.children ?? [];
        const currentIndex = siblings.indexOf(component);
        if (currentIndex < 0) {
            return {
                index: null,
                total: siblings.length,
                nearby: [],
            };
        }

        const start = Math.max(0, currentIndex - STRUCTURE_SIBLING_WINDOW);
        const end = Math.min(siblings.length, currentIndex + STRUCTURE_SIBLING_WINDOW + 1);
        const nearby = siblings.slice(start, end).map((sibling, offsetIndex) => {
            const absoluteIndex = start + offsetIndex;
            return {
                ...this.summarizeNodeIdentity(sibling),
                relativeIndex: absoluteIndex - currentIndex,
            };
        });

        return {
            index: currentIndex,
            total: siblings.length,
            nearby,
        };
    }

    private collectDescendantTypeHistogram(component: Component, maxDepth: number, sampleLimit: number): Record<string, number> {
        if (maxDepth <= 0 || sampleLimit <= 0) {
            return {};
        }

        const histogram = new Map<string, number>();
        const queue: Array<{ node: Component; depth: number }> = [];
        for (const child of component.children ?? []) {
            queue.push({ node: child, depth: 1 });
        }

        let sampled = 0;
        while (queue.length > 0 && sampled < sampleLimit) {
            const item = queue.shift();
            if (!item) {
                break;
            }

            const type = item.node.type?.trim() || 'UNKNOWN';
            histogram.set(type, (histogram.get(type) ?? 0) + 1);
            sampled += 1;

            if (item.depth >= maxDepth) {
                continue;
            }
            for (const child of item.node.children ?? []) {
                queue.push({ node: child, depth: item.depth + 1 });
            }
        }

        return Object.fromEntries(
            [...histogram.entries()].sort((left, right) => {
                if (right[1] !== left[1]) {
                    return right[1] - left[1];
                }
                return left[0].localeCompare(right[0]);
            })
        );
    }

    private summarizeNodeIdentity(component: Component): Record<string, unknown> {
        return {
            type: component.type?.trim() ?? '',
            id: component.id?.trim() ?? '',
            key: component.key?.trim() ?? '',
            name: component.name?.trim() ?? '',
            text: component.text?.trim() ?? '',
            hint: component.hint?.trim() ?? '',
        };
    }

    private parseResponse(content: string): AiCompareResponse {
        if (!content) {
            return {};
        }

        const jsonLike = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
        try {
            const parsed = JSON.parse(jsonLike) as AiCompareResponse;
            return parsed;
        } catch {
            const lowered = content.toLowerCase();
            if (lowered.includes('true')) {
                return { same: true, confidence: 0.5, reason: 'fallback true parse' };
            }
            if (lowered.includes('false')) {
                return { same: false, confidence: 0.5, reason: 'fallback false parse' };
            }
            return {};
        }
    }

    private buildCacheKey(
        mobileComponent: Component,
        twoInOneComponent: Component,
        context: AiComponentMatchContext
    ): string {
        return [
            context.mode,
            context.mobileKey,
            context.twoInOneKey,
            this.componentFingerprint(mobileComponent),
            this.componentFingerprint(twoInOneComponent),
        ].join('||');
    }

    private componentFingerprint(component: Component): string {
        const structure = this.summarizeStructure(component);
        return [
            component.type?.trim() ?? '',
            component.key?.trim() ?? '',
            component.id?.trim() ?? '',
            component.name?.trim() ?? '',
            component.text?.trim() ?? '',
            component.hint?.trim() ?? '',
            JSON.stringify(structure),
        ].join('::');
    }
}

function buildOpenRouterHeaders(baseURL?: string, config?: GptConfig): Record<string, string> | undefined {
    if (!isOpenRouterBaseURL(baseURL)) {
        return undefined;
    }

    const siteURL = config?.siteURL?.trim() || 'https://github.com/SMAT-Lab/HapTest';
    const appName = config?.appName?.trim() || 'HapTest';
    return {
        'HTTP-Referer': siteURL,
        'X-Title': appName,
    };
}

function isOpenRouterBaseURL(baseURL?: string): boolean {
    return (baseURL ?? '').toLowerCase().includes('openrouter.ai');
}

function isConnectionLikeError(error: unknown): boolean {
    const content = String(error ?? '').toLowerCase();
    return (
        content.includes('connection error') ||
        content.includes('fetch failed') ||
        content.includes('network') ||
        content.includes('econnreset') ||
        content.includes('etimedout') ||
        content.includes('enotfound') ||
        content.includes('socket hang up')
    );
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
