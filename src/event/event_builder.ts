import { Device } from "../device/device";
import { Direct } from "../device/event_simulator";
import { Component } from "../model/component";
import { RandomUtils } from "../utils/random_utils";
import { LongTouchEvent, ScrollEvent, TouchEvent, UIEvent } from "./ui_event";

export class EventBuilder {
    static createPossibleUIEvents(component: Component): UIEvent[] {
        let events: UIEvent[] = [];
        if (!component.enabled) {
            return events;
        }

        if (component.checkable || component.clickable) {
            events.push(new TouchEvent(component));
        } else if (component.longClickable) {
            events.push(new LongTouchEvent(component));
        } else if (component.scrollable) {
            events.push(new ScrollEvent(component, Direct.DOWN));
            events.push(new ScrollEvent(component, Direct.UP));
            events.push(new ScrollEvent(component, Direct.LEFT));
            events.push(new ScrollEvent(component, Direct.RIGHT));
        }

        return events;
    }

    static createRandomTouchEvent(device: Device): TouchEvent {
        return new TouchEvent({x: RandomUtils.genRandomNum(0, device.getWidth()), y: RandomUtils.genRandomNum(0, device.getHeight())});
    }
}