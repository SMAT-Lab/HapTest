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

import { Logger, getLogger } from 'log4js';
import { Device } from '../device/device';
import { Event } from '../event/event';
import { Hap } from '../model/hap';
import { Page } from '../model/page';

export enum PolicyFlag {
    FLAG_INIT = 0,
    FLAG_START_APP = 1,
    FLAG_STOP_APP = 1 << 2,
    FLAG_STARTED = 1 << 3,
}

export enum PolicyName {
    MANUAL = 'manual',
    NAIVE = 'naive',
    REPLAY = 'replay',
    DFS_GREEDY = 'greedy_dfs',
    BFS_GREEDY = 'greedy_bfs',
    RANDOM = 'random',
    PERF_START_HAP = 'perf_start_hap'
}

export abstract class Policy {
    protected device: Device;
    protected hap: Hap;
    protected _enabled: boolean;
    protected flag: number;
    protected name: PolicyName;
    protected logger: Logger = getLogger();

    constructor(device: Device, hap: Hap, name: PolicyName) {
        this.device = device;
        this.hap = hap;
        this._enabled = true;
        this.name = name;
        this.flag = PolicyFlag.FLAG_INIT;
    }

    get enabled(): boolean {
        return this._enabled;
    }

    stop() {
        this._enabled = false;
    }

    abstract generateEvent(page: Page): Promise<Event>;
}
