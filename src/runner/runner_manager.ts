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
import { Event } from '../event/event';
import { Hap } from '../model/hap';
import { Page } from '../model/page';
import { Policy } from '../policy/policy';
import { PolicyBuilder } from '../policy/policy_builder';
import { EventAction } from './event_action';
import { FuzzOptions } from './fuzz_options';
import { UITarpitDetector} from '../utils/ui_tarpit_detector'
import { PTGPolicy } from '../policy/ptg_policy';
import { WaitEvent } from '../event/wait_event';
import { LLMGuidedPolicy } from '../policy/llm_guided_policy';

const EVENT_INTERVAL = 1000;
const MAX_TRY_COUNT = 10; 
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RunnerManager {
    protected device: Device;
    protected hap: Hap;
    protected options: FuzzOptions;
    protected policy: Policy;
    protected enabled: boolean;
    protected llmPolicy: LLMGuidedPolicy | undefined;
    protected detector: UITarpitDetector | undefined;

    constructor(device: Device, hap: Hap, options: FuzzOptions) {
        this.device = device;
        this.hap = hap;
        this.options = options;
        this.enabled = true;
        this.policy = PolicyBuilder.buildPolicyByName(device, hap, options);
    
        // 新增逻辑：如果 --llm 选项为 true，则创建 LLM 策略
        // 并开启UI陷阱检测
        const llmEnabled = this.options.llm;

        if (!llmEnabled) {
            return; // LLM 选项没开，直接返回
        }
    
        // LLM 选项开启，确保策略基于 PTGPolicy
        if (!(this.policy instanceof PTGPolicy)) {
            throw new Error("Current policy is not based on PTGPolicy");
        }
    
        const ptg = (this.policy as PTGPolicy).getPTG();
    
        this.llmPolicy = PolicyBuilder.buildLLMPolicy(device, hap, options, ptg);
        this.detector = new UITarpitDetector(this.options.simK);
    }

    async start() {
        if ( this.options.llm){
           await this.startWithLLM();
            return;
        }

        let page = await this.device.getCurrentPage(this.hap);
        while (this.enabled && this.policy.enabled) {     
            let event = await this.policy.generateEvent(page);
            if (event instanceof WaitEvent) {
                await new Promise(r => setTimeout(r, 1500)); // 等待异步完成
                continue;
            }
            page = await this.addEvent(page, event);
        }
    }

    async startWithLLM() {
        let page = await this.device.getCurrentPage(this.hap);
        let lastPage = page;
        let event : Event;    
        let isTarpit = false;
        while (this.enabled && this.policy.enabled) {

            isTarpit = await this.detector!.detectedUITarpit(lastPage.getSnapshot()?.screenCapPath, page.getSnapshot()?.screenCapPath)
            
            if(isTarpit && this.detector!.getSimCount() < MAX_TRY_COUNT){
                event = await this.llmPolicy!.generateEvent(page);
            }else if(isTarpit && this.detector!.getSimCount() >= MAX_TRY_COUNT){
                event = await this.llmPolicy!.getBackEvent();
                this.detector!.resetSimCount();

            }
            else{
                event = await this.policy.generateEvent(page);
                this.llmPolicy!.clearActionHistory();
            }  

            if (event instanceof WaitEvent) {
                await new Promise(r => setTimeout(r, 1500)); // 等待异步完成
                continue;
            }
            lastPage = page;
            page = await this.addEvent(page, event);
        }
    }

    stop() {
        this.enabled = false;
    }

    protected async addEvent(page: Page, event: Event): Promise<Page> {
        let eventExcute = new EventAction(this.device, this.hap, page, event);
        await eventExcute.start();
        // sleep interval
        await sleep(EVENT_INTERVAL);
        await eventExcute.stop();

        return eventExcute.transition.to;
    }
}
