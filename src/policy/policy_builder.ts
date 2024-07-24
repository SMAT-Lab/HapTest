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
import { InputPolicy, PolicyName } from './input_policy';
import { ManualPolicy } from './manual_policy';
import { UtgGreedySearchPolicy } from './utg_greedy_search_policy';
import { UtgNaiveSearchPolicy } from './utg_naive_search_policy';

export class PolicyBuilder {
    static buildPolicyByName(device: Device, hap: Hap, options: FuzzOptions): InputPolicy {
        if (options.policyName == PolicyName.MANUAL) {
            return new ManualPolicy(device, hap, PolicyName.MANUAL);
        } else if (options.policyName == PolicyName.BFS_GREEDY) {
            return new UtgGreedySearchPolicy(device, hap, PolicyName.BFS_GREEDY);
        } else if (options.policyName == PolicyName.DFS_GREEDY) {
            return new UtgGreedySearchPolicy(device, hap, PolicyName.DFS_GREEDY);
        } else if (options.policyName == PolicyName.BFS_NAIVE) {
            return new UtgNaiveSearchPolicy(device, hap, PolicyName.BFS_NAIVE);
        } else {
            return new UtgNaiveSearchPolicy(device, hap, PolicyName.DFS_NAIVE);
        }
    }
}
