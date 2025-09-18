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

import { Device } from '../device/device';
import { Hap } from '../model/hap';
import { FuzzOptions } from '../runner/fuzz_options';
import { Policy, PolicyName } from './policy';
import { ManualPolicy } from './manual_policy';
import { ReplayPolicy } from './replay_policy';
import { PtgGreedySearchPolicy } from './ptg_greedy_search_policy';
import { PtgNaiveSearchPolicy } from './ptg_naive_search_policy';
import { PtgRandomSearchPolicy } from './ptg_random_search_policy';
import { PerfPolicy } from './perf_policy';
import { LLMGuidedPolicy } from './llm_guided_policy';
import { PTG } from '../model/ptg';
import { StaticGuidedPolicy } from './static_guided_policy';

export class PolicyBuilder {
    static buildLLMPolicy(device: Device, hap: Hap, options: FuzzOptions, ptg: PTG): LLMGuidedPolicy {
        return new LLMGuidedPolicy(device, hap, PolicyName.LLM_GUIDED, ptg);
    }
    static buildPolicyByName(device: Device, hap: Hap, options: FuzzOptions): Policy {
        if (options.policyName === PolicyName.MANUAL) {
            return new ManualPolicy(device, hap, PolicyName.MANUAL);
        } else if (options.policyName === PolicyName.REPLAY) {
            return new ReplayPolicy(device, hap, options.policyName, options.reportRoot!);
        } else if (options.policyName === PolicyName.BFS_GREEDY) {
            return new PtgGreedySearchPolicy(device, hap, PolicyName.BFS_GREEDY);
        } else if (options.policyName === PolicyName.DFS_GREEDY) {
            return new PtgGreedySearchPolicy(device, hap, PolicyName.DFS_GREEDY);
        } else if (options.policyName === PolicyName.RANDOM) {
            return new PtgRandomSearchPolicy(device, hap, PolicyName.RANDOM);
        } else if (options.policyName === PolicyName.PERF_START_HAP) {
            return new PerfPolicy(device, hap, PolicyName.PERF_START_HAP);
        }  else if (options.policyName === PolicyName.STATIC_GUIDED) {
            // 静态引导策略实际上是基于PTG的，因此这里复用PTG的类
            return new StaticGuidedPolicy(device, hap, PolicyName.STATIC_GUIDED, options.staticConfig!);
        }
        else {
            return new PtgNaiveSearchPolicy(device, hap, PolicyName.NAIVE);
        }
    }
}
