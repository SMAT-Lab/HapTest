import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HierarchyTree } from '../../src/ui/hierarchy_builder';
import type { LOG_LEVEL } from '../../src/utils/logger';

type RouteHandler = (req: any, res: any) => any;

interface ExpressMockState {
    getHandlers: Map<string, RouteHandler>;
    postHandlers: Map<string, RouteHandler>;
    jsonArgs: unknown[];
    staticArgs: string[];
    listenPort?: number;
    errorListener?: (err: unknown) => void;
}

const expressState: ExpressMockState = {
    getHandlers: new Map(),
    postHandlers: new Map(),
    jsonArgs: [],
    staticArgs: [],
    listenPort: undefined,
    errorListener: undefined,
};

const resetExpressState = () => {
    expressState.getHandlers.clear();
    expressState.postHandlers.clear();
    expressState.jsonArgs = [];
    expressState.staticArgs = [];
    expressState.listenPort = undefined;
    expressState.errorListener = undefined;
};

vi.mock('express', () => {
    const jsonMock = vi.fn((options?: unknown) => {
        expressState.jsonArgs.push(options);
        return () => undefined;
    });

    const staticMock = vi.fn((dir: string) => {
        expressState.staticArgs.push(dir);
        return `static:${dir}`;
    });

    const expressMock = vi.fn(() => {
        const app = {
            use: vi.fn(() => app),
            get: vi.fn((route: string, handler: RouteHandler) => {
                expressState.getHandlers.set(route, handler);
                return app;
            }),
            post: vi.fn((route: string, handler: RouteHandler) => {
                expressState.postHandlers.set(route, handler);
                return app;
            }),
            listen: vi.fn((port: number, callback?: () => void) => {
                expressState.listenPort = port;
                callback?.();
                return {
                    on: vi.fn((event: string, listener: (err: unknown) => void) => {
                        if (event === 'error') {
                            expressState.errorListener = listener;
                        }
                    }),
                };
            }),
        };
        return app;
    });

    (expressMock as unknown as { json: typeof jsonMock }).json = jsonMock;
    (expressMock as unknown as { static: typeof staticMock }).static = staticMock;

    return { default: expressMock };
});

interface MockSnapshot {
    screenCapPath: string;
    screenWidth: number;
    screenHeight: number;
}

class MockPage {
    constructor(
        private readonly snapshot: MockSnapshot,
        private readonly root: any,
        private readonly abilityName: string,
        private readonly bundleName: string,
        private readonly pagePath: string
    ) {}

    getSnapshot(): MockSnapshot {
        return this.snapshot;
    }

    getRoot(): any {
        return this.root;
    }

    getAbilityName(): string {
        return this.abilityName;
    }

    getBundleName(): string {
        return this.bundleName;
    }

    getPagePath(): string {
        return this.pagePath;
    }
}

interface PageFactoryArgs {
    bundleName: string;
}

let currentPageFactory: ((args: PageFactoryArgs) => MockPage) | null = null;
const requestedBundleNames: string[] = [];
const connectedHaps: any[] = [];

class MockDeviceImpl {
    constructor(public readonly options: unknown) {}

    async connect(hap: any): Promise<void> {
        connectedHaps.push(hap);
    }

    async getCurrentPage(hap: any): Promise<MockPage> {
        requestedBundleNames.push(hap.bundleName);
        if (!currentPageFactory) {
            throw new Error('Page factory is not configured.');
        }
        const page = currentPageFactory({ bundleName: hap.bundleName });
        if (!hap.bundleName) {
            hap.bundleName = page.getBundleName();
        }
        return page;
    }

    getUdid(): string {
        return 'mock-udid';
    }
}

const deviceConstructor = vi.fn((options: unknown) => new MockDeviceImpl(options));

vi.mock('../../src/device/device', () => ({
    Device: deviceConstructor,
}));

let mockHierarchyTree: HierarchyTree = {
    root: { _id: 'root-node', children: [] } as any,
    map: new Map(),
};

const buildHierarchyMock = vi.fn(() => mockHierarchyTree);
const generateXPathLiteMock = vi.fn(() => '//MockNode[2]');

vi.mock('../../src/ui/hierarchy_builder', () => ({
    buildHierarchy: buildHierarchyMock,
    generateXPathLite: generateXPathLiteMock,
}));

const successResult = (data: unknown) => ({ success: true, data, message: null });
const failureResult = (message: string) => ({ success: false, data: null, message });

const createMockResponse = () => {
    const res: any = {
        statusCode: 200,
        json: vi.fn((payload: unknown) => {
            res.payload = payload;
            return res;
        }),
        status: vi.fn((code: number) => {
            res.statusCode = code;
            return res;
        }),
        send: vi.fn((payload: unknown) => {
            res.payload = payload;
            return res;
        }),
        sendFile: vi.fn((filePath: string) => {
            res.sentFile = filePath;
            return res;
        }),
    };
    return res;
};

let startUIViewerServer: typeof import('../../src/ui/ui_viewer_server').startUIViewerServer;
let hdcModule: typeof import('../../src/device/hdc');
let tempOutputDir: string;
let pageSequence = 0;

const resetMocks = async () => {
    resetExpressState();
    requestedBundleNames.length = 0;
    connectedHaps.length = 0;
    deviceConstructor.mockClear();
    buildHierarchyMock.mockClear();
    generateXPathLiteMock.mockClear();
    currentPageFactory = null;
    pageSequence = 0;
    vi.clearAllMocks();
    vi.resetModules();
    startUIViewerServer = (await import('../../src/ui/ui_viewer_server')).startUIViewerServer;
    hdcModule = await import('../../src/device/hdc');
};

const createMockPage = (dir: string, overrides: Partial<{ abilityName: string; bundleName: string; pagePath: string }> = {}) => {
    pageSequence += 1;
    const screenPath = path.join(dir, `screen-${pageSequence}.png`);
    const fileContent = `image-content-${pageSequence}`;
    fs.writeFileSync(screenPath, Buffer.from(fileContent));
    const snapshot: MockSnapshot = {
        screenCapPath: screenPath,
        screenWidth: 1280,
        screenHeight: 720,
    };
    return new MockPage(
        snapshot,
        { _id: 'root-node', children: [] } as any,
        overrides.abilityName || 'MainAbility',
        overrides.bundleName || 'com.example.app',
        overrides.pagePath || 'pages/Main'
    );
};

const getRouteHandler = (method: 'get' | 'post', route: string): RouteHandler => {
    const handler = method === 'get' ? expressState.getHandlers.get(route) : expressState.postHandlers.get(route);
    if (!handler) {
        throw new Error(`Route handler for [${method.toUpperCase()} ${route}] not registered.`);
    }
    return handler;
};

beforeEach(async () => {
    tempOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uiviewer-test-'));
    mockHierarchyTree = {
        root: { _id: 'root', componentPath: 'Node[1]', children: [] } as any,
        map: new Map([
            [
                'root',
                {
                    _id: 'root',
                    componentPath: 'Node[1]',
                    children: [],
                } as any,
            ],
        ]),
    };
    await resetMocks();
});

afterEach(() => {
    if (tempOutputDir && fs.existsSync(tempOutputDir)) {
        fs.rmSync(tempOutputDir, { recursive: true, force: true });
    }
});

describe('startUIViewerServer', () => {
    it('registers routes and serves happy-path UI viewer workflow', async () => {
        const options = {
            bundleName: 'com.example.app',
            connectKey: 'device-123',
            outputDir: tempOutputDir,
            port: 7789,
            logLevel: 'INFO' as LOG_LEVEL,
            version: '1.2.3',
        };

        currentPageFactory = ({ bundleName }) => createMockPage(tempOutputDir, { bundleName });
        const listTargetsSpy = vi
            .spyOn(hdcModule.Hdc, 'listTargets')
            .mockReturnValue([
                { serial: options.connectKey, transport: 'usb', state: 'device', host: 'localhost', type: 'phone' },
            ]);

        await startUIViewerServer(options);

        expect(expressState.listenPort).toBe(options.port);
        expect(deviceConstructor).not.toHaveBeenCalled();
        expect(expressState.jsonArgs[0]).toEqual({ limit: '5mb' });

        const healthRes = createMockResponse();
        getRouteHandler('get', '/api/health')({}, healthRes);
        expect(healthRes.json).toHaveBeenCalledWith(successResult('ok'));

        const versionRes = createMockResponse();
        getRouteHandler('get', '/api/version')({}, versionRes);
        expect(versionRes.json).toHaveBeenCalledWith(successResult(options.version));

        const serialsRes = createMockResponse();
        await getRouteHandler('get', '/api/harmony/serials')({}, serialsRes);
        const serialsPayload = serialsRes.json.mock.calls[0][0];
        expect(serialsPayload.success).toBe(true);
        expect(Array.isArray(serialsPayload.data)).toBe(true);
        expect(serialsPayload.data).toContain(options.connectKey);

        const connectRes = createMockResponse();
        await getRouteHandler('post', '/api/harmony/connect')({ body: {} }, connectRes);
        expect(deviceConstructor).toHaveBeenCalledTimes(1);
        expect(connectedHaps).toHaveLength(1);
        expect(connectRes.json).toHaveBeenCalledWith(
            successResult({ alias: 'device-123', connectKey: 'device-123' })
        );

        const screenshotRes = createMockResponse();
        await getRouteHandler('get', '/api/harmony/screenshot')({}, screenshotRes);
        const expectedBase64 = Buffer.from('image-content-1').toString('base64');
        expect(screenshotRes.json).toHaveBeenCalledWith(successResult(expectedBase64));

        const screenshotFilePath = path.join(tempOutputDir, 'screen-1.png');
        expect(fs.existsSync(screenshotFilePath)).toBe(false);

        expect(requestedBundleNames).toEqual(['com.example.app']);

        const hierarchyRes = createMockResponse();
        await getRouteHandler('get', '/api/harmony/hierarchy')({}, hierarchyRes);
        expect(hierarchyRes.json).toHaveBeenCalledWith(
            successResult({
                jsonHierarchy: mockHierarchyTree.root,
                activityName: 'MainAbility',
                packageName: 'com.example.app',
                pagePath: 'pages/Main',
                windowSize: [1280, 720],
                scale: 1,
                updatedAt: expect.any(String),
            })
        );
        expect(buildHierarchyMock).toHaveBeenCalled();

        const xpathRes = createMockResponse();
        await getRouteHandler('post', '/api/harmony/hierarchy/xpathLite')(
            { body: { node_id: 'root' } },
            xpathRes
        );
        expect(generateXPathLiteMock).toHaveBeenCalledWith('root', mockHierarchyTree);
        expect(xpathRes.json).toHaveBeenCalledWith(successResult('//MockNode[2]'));

        listTargetsSpy.mockRestore();

        const missingNodeRes = createMockResponse();
        await getRouteHandler('post', '/api/harmony/hierarchy/xpathLite')({ body: {} }, missingNodeRes);
        expect(missingNodeRes.status).toHaveBeenCalledWith(400);
        expect(missingNodeRes.json).toHaveBeenCalledWith(failureResult('node_id is required.'));

        const indexRes = createMockResponse();
        getRouteHandler('get', '/')( {}, indexRes );
        expect(indexRes.sendFile).toHaveBeenCalled();

        const fallbackRes = createMockResponse();
        getRouteHandler('get', '/ui-viewer')( {}, fallbackRes );
        expect(fallbackRes.sendFile).toHaveBeenCalled();
    });
});
