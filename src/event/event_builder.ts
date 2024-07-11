import { Device } from "../device/device";
import { Direct } from "../device/event_simulator";
import { Component } from "../model/component";
import { RandomUtils } from "../utils/random_utils";
import { InputTextEvent, LongTouchEvent, ScrollEvent, TouchEvent, UIEvent } from "./ui_event";

const TEXT_INPUTABLE_TYPE: Set<string> = new Set(['TextInput', 'TextArea', 'SearchField']);

export class EventBuilder {
    static createPossibleUIEvents(component: Component): UIEvent[] {
        let events: UIEvent[] = [];
        if (!component.enabled) {
            return events;
        }

        if (component.checkable || component.clickable) {
            events.push(new TouchEvent(component));
        } 
        
        if (component.longClickable) {
            events.push(new LongTouchEvent(component));
        } 
        
        if (component.scrollable) {
            events.push(new ScrollEvent(component, Direct.DOWN));
            events.push(new ScrollEvent(component, Direct.UP));
            events.push(new ScrollEvent(component, Direct.LEFT));
            events.push(new ScrollEvent(component, Direct.RIGHT));
        }

        if (TEXT_INPUTABLE_TYPE.has(component.type)) {
            events.push(new InputTextEvent(component, InputTextEvent.getRandomText()));
        }

        return events;
    }

    static createRandomTouchEvent(device: Device): TouchEvent {
        return new TouchEvent({x: RandomUtils.genRandomNum(0, device.getWidth()), y: RandomUtils.genRandomNum(0, device.getHeight())});
    }
}