import { Component } from '../model/component';
import { InputTextEvent, LongTouchEvent, ScrollEvent, TouchEvent, UIEvent } from '../event/ui_event';
import { Direct } from '../device/event_simulator';
import { RandomUtils } from './random_utils';
import { BACK_KEY_EVENT } from '../event/key_event';
import { Event } from '../event/event';

export class PromptBuilder {
    static createActionPromptFromEvents(events: UIEvent[]): string {
        let actionPrompt = '';
        for (const event of events) {
            const eventType = event.getEventType();
            const componentId = event.getComponentId();
            actionPrompt += `- a ${componentId} view that ${eventType} `
        }
        return actionPrompt;
    }

    static createActionPromptWithEvents(components: Component[]): [actionPrompt: string, events: Event[], actionList: string[]] {
        let events: Event[] = [];
        let actionList: string[] = [];
        let actionPrompt = "The current state has the following UI views and corresponding actions, with action id in parentheses:\n ";
        for (const component of components) {
            if (component.hasUIEvent()) {
                const singlePrompt = PromptBuilder.createSingleActionPrompt(component, events);
                if( singlePrompt.includes("scroll")){
                    actionList.push(singlePrompt);
                    actionList.push(singlePrompt);
                    actionList.push(singlePrompt);
                }
                actionList.push(singlePrompt);
            }
        }
        events.push(BACK_KEY_EVENT);
        actionList.push(`- a key to go back (${events.length})`);
        actionPrompt += actionList.join(";\n");
        return [actionPrompt, events, actionList];

    }

    static createSingleActionPrompt(component: Component, events: Event[]): string {
        let viewStatus = "";
        let actionList: string[] = [];

        const viewText = component.text;
        const componentId = component.hint;

        if (!component.enabled) {
            return "";
        }

        if (component.inputable) {
            viewStatus += "editable";
            events.push(new InputTextEvent(component, RandomUtils.genRandomString(10)));
            actionList.push(`edit (${events.length})`);
        }

        if (component.checked || component.selected) {
            viewStatus += "checked";
        }

        let viewDesc = `- a ${viewStatus} view `;
        if (componentId) {
            let processedText = componentId.replace(/\n/g, '  ');
            processedText = processedText.length > 20 ? `${processedText.substring(0, 20)}...` : processedText;
            viewDesc += `which described as ${processedText} `;

        }

        if (viewText) {
            let processedText = viewText.replace(/\n/g, '  ');
            processedText = processedText.length > 20 ? `${processedText.substring(0, 20)}...` : processedText;
            viewDesc += `with text ${processedText} `;
        }


        if (component.checkable || component.clickable) {
            events.push(new TouchEvent(component));
            actionList.push(`click (${events.length})`);
        }


        if (component.longClickable) {
            events.push(new LongTouchEvent(component));
            actionList.push(`long click (${events.length})`);
        }

        if (component.scrollable) {
            events.push(new ScrollEvent(component, Direct.DOWN));
            actionList.push(`scroll down (${events.length})`);
            events.push(new ScrollEvent(component, Direct.UP));
            actionList.push(`scroll up (${events.length})`);
            events.push(new ScrollEvent(component, Direct.LEFT));
            actionList.push(`scroll left (${events.length})`);
            events.push(new ScrollEvent(component, Direct.RIGHT));        
            actionList.push(`scroll right (${events.length})`);
        }

        let actionPrompt = viewDesc + "that can ";
        actionPrompt += actionList.join(',');

        return actionPrompt;

    }
}