import { Device } from '../device/device';
import { Hap } from '../model/hap';
import { FuzzOptions } from '../runner/fuzz_options';
import { InputPolicy } from './input_policy';
import { ManualPolicy } from './manual_policy';
import { UtgNaiveSearchPolicy } from './ugt_naive_search_policy';

export const POLICY_MANUAL = 'manual';
export const POLICY_NAIVE_DFS = 'naive_dfs';
export const POLICY_NAIVE_BFS = 'naive_bfs';

export class PolicyBuilder {
    static buildPolicyByName(device: Device, hap: Hap, options: FuzzOptions): InputPolicy {
        if (options.policyName == POLICY_MANUAL) {
            return new ManualPolicy(device, hap);
        }

        return new UtgNaiveSearchPolicy(device, hap);
    }
}
