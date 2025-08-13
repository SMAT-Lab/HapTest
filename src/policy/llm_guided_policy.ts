import { Device } from "../device/device";
import { Event } from "../event/event";
import { EventBuilder } from "../event/event_builder";
import { BACK_KEY_EVENT } from "../event/key_event";
import { ExitEvent } from "../event/system_event";
import { InputTextEvent } from "../event/ui_event";
import { WaitEvent } from "../event/wait_event";
import { Component } from "../model/component";
import { Hap } from "../model/hap";
import { PTG } from "../model/ptg";
import { PromptBuilder } from "../utils/promptbuilder";
import { PolicyName } from "./policy";
import { MAX_NUM_RESTARTS, PTGPolicy } from "./ptg_policy";
import OpenAI from 'openai';

type LLMResponse = string;

export class LLMGuidedPolicy extends PTGPolicy {
    private pageComponentMap: Map<string, Component[]>;
    private actionHistory: string[];
    private taskPrompt: String;
    private actionPrompt: String;
    private text: string;
    private actionList:string[];

    // GPT configuration
    private static readonly GPT_CONFIG = {
        baseURL: 'https://api.chatanywhere.tech/v1',
        apiKey: 'sk-t6Dn1cwNdxVCkNE8jSPYqna47G0SY0yuDC5ajQeP9OkNo97f'
    };

    private openai = new OpenAI(LLMGuidedPolicy.GPT_CONFIG);

    constructor(device: Device, hap: Hap, name: PolicyName, ptg: PTG) {
        super(device, hap, name, true);
        this.pageComponentMap = new Map();
        this.actionHistory = [];
        this.actionPrompt = "";
        this.actionList =[];
        this.text = "";
        this.ptg = ptg;

        this.taskPrompt = new String("You are an expert in App GUI testing. Please guide the testing tool to enhance the coverage of functional scenarios in testing the App based on your extensive App testing experience. "); // initial task prompt
    }

    // Add a buffer to the class to store asynchronously fetched events
    private pendingEvent: Event | null = null;
    private eventFetching: boolean = false;

    generateEventBasedOnPtg(): Event {
        this.updateState();

        // If an event has already been fetched asynchronously, return it directly
        if (this.pendingEvent) {
            const event = this.pendingEvent;
            this.pendingEvent = null;
            return event;
        }
     
        if(!this.eventFetching){
            this.logger.info("Start asynchronous call to selectEventFromLLM");
            // Start asynchronous logic (only once)
            this.eventFetching = true;
             // Start asynchronous logic to fetch events and cache them in pendingEvent
            this.selectEventFromLLM().then(event => {
                if (event === undefined) {
                    if (this.retryCount > MAX_NUM_RESTARTS) {
                        this.stop();
                        this.pendingEvent = new ExitEvent();
                    } else {
                        this.retryCount++;
                        this.pendingEvent = EventBuilder.createRandomTouchEvent(this.device);
                    }
                } else {
                    this.retryCount = 0;
                    this.pendingEvent = event;
                    this.logger.info("selectEventFromLLM successfully returned");
                }
            }).catch(err => {
                this.logger.error(`selectEventFromLLM failed: ${err}`);
                this.pendingEvent = EventBuilder.createRandomTouchEvent(this.device);
            }).finally(() => {
                this.logger.info("selectEventFromLLM finally");
                this.eventFetching = false;
            });
        }   

        return new WaitEvent(); 
    }


    private updateState(): void {
        if (!this.currentPage!.isForeground()) {
            return;
        }

        let pageSig = this.currentPage!.getContentSig();
        if (!this.pageComponentMap.has(pageSig)) {
            let components: Component[] = [];
            for (const component of this.currentPage!.getComponents()) {
                if (component.hasUIEvent()) {
                    components.push(component);
                }
            }
            this.pageComponentMap.set(pageSig, components);
        }
    }


    private async selectEventFromLLM(): Promise<Event | undefined> {
        let pageSig = this.currentPage!.getContentSig();
        let components = this.pageComponentMap.get(pageSig);
        if (!components) {
            return undefined;
        }

        let events: Event[] = [];
        [this.actionPrompt, events, this.actionList] = this.getPossibleEventsWithActionPrompt(components);

        // from current page translate to unexpored page Event
        for (const page of this.ptg.getReachablePages(this.currentPage!)) {
            if (this.ptg.isPageExplored(page) || page.getBundleName() !== this.hap.bundleName) {
                continue;
            }

            let steps = this.ptg.getNavigationSteps(this.currentPage!, page);
            if (steps && steps.length > 0) {
                events.push(steps[0][1]);
            }
        }

        if (events.length > 0) {
            const event = await this.getEventFromLLM(events);
            return event;
        }

        return undefined;
    }

    private getPossibleEventsWithActionPrompt(components: Component[]): [string, Event[], string[]] {
        return PromptBuilder.createActionPromptWithEvents(components);
    }

    private generatePrompt(): string {
        // const activity = this.currentState!.foreground_activity;
        const abilityName = this.currentPage!.getAbilityName();
        const taskPrompt = `${this.taskPrompt} the App is stuck on the ${abilityName} page, unable to explore more features. You task is to select an action based on the current GUI infomation to perform next and help the app escape the UI tarpit. `;

        const exploredAbilityStr = `I have already explored the following abilities:\n${this.ptg.getExploredAbilities().join('\n')}`;

        const historyPrompt = `I have already tried the following steps with action id in parentheses which should not be selected anymore: \n ${this.actionHistory.join(';\n')}`;

        const questionPrompt = 'Which action to choose? Just return action ID based on the given action id.'

        const fullPrompt = `${taskPrompt}\n${exploredAbilityStr}\n${historyPrompt}\n${this.actionPrompt}\n${questionPrompt}`;

        this.logger.info(fullPrompt);

        return fullPrompt;
    }

    private async queryLLM(prompt: string): Promise<LLMResponse> {
        const completion = await this.openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
        });
        return completion.choices[0].message.content!.trim();
    }

    private parseActionId(response: string): number | null {
        const match = response.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    }

    private async getEventFromLLM(events: Event[]): Promise<Event | undefined> {
        try {
            let prompt = this.generatePrompt();
            const response = await this.queryLLM(prompt);
            this.logger.info(`Response: ${response}`);

            const actionId = this.parseActionId(response);
            this.logger.info(`actionId: ${actionId}`);
            if (actionId === null || actionId === -1 || actionId > events.length) {
                return undefined;
            }

            const selectEvent = events[actionId-1];
            if (selectEvent instanceof InputTextEvent && selectEvent.getComponentId() !== undefined) {
                const componentId = selectEvent.getComponentId();
                if (componentId !== undefined) {
                    const textPrompt = `What text to enter in ${componentId}? Respond ONLY with text.`;
                    const textResponse = await this.queryLLM(textPrompt);
                    this.logger.info(`Response: ${textResponse}`);
                    this.text = textResponse.replace('"', '');
                    selectEvent.setText(this.text.length > 30 ? `${this.text.substring(0, 30)}...` : this.text);
                }
            }

            const action = this.actionList[actionId-1];
            this.logger.info(`the choice action is: ${action}`)
            this.actionHistory.push(action);
            return selectEvent;
        } catch (error) {
            this.logger.error(`getEventFromLLM error: ${error}`);
            return undefined;
        } 
    }

    clearActionHistory():void{
        this.actionHistory = [];
    }

    getBackEvent(): Event {
        this.clearActionHistory();
        this.logger.info("getBackEvent called, clear action history");
        return BACK_KEY_EVENT;
    }

}