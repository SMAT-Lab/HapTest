import { Component } from '../model/component';
import { Point } from '../model/point';
import { Event } from './event';
import { Direct, EventSimulator } from '../device/event_simulator';
import { Expose } from 'class-transformer';

export abstract class UIEvent extends Event {
    @Expose()
    protected component: Component | undefined;
    @Expose()
    protected point: Point;

    constructor(type: string, componentOrPoint: Component | Point) {
        super(type);
        if (componentOrPoint instanceof Component) {
            this.component = componentOrPoint;
            this.point = componentOrPoint.getCenterPoint();
        } else {
            this.point = componentOrPoint;
        }
    }

    getComponet(): Component | undefined {
        return this.component;
    }

    getRank(): number {
        if (this.component) {
            return this.component.rank;
        }

        return this.rank;
    }
}

export class TouchEvent extends UIEvent {
    constructor(componentOrPoint: Component | Point) {
        super('TouchEvent', componentOrPoint);
    }

    send(simulator: EventSimulator): void {
        simulator.click(this.point);
    }
}

export class LongTouchEvent extends UIEvent {
    constructor(componentOrPoint: Component | Point) {
        super('LongTouchEvent', componentOrPoint);
    }

    send(simulator: EventSimulator): void {
        simulator.longClick(this.point);
    }
}

export class ScrollEvent extends UIEvent {
    @Expose()
    protected velocity: number;
    @Expose()
    protected direct: Direct;

    constructor(componentOrPoint: Component | Point, direct: Direct, velocity: number = 600) {
        super('ScrollEvent', componentOrPoint);
        this.velocity = velocity;
        this.direct = direct;
    }

    send(simulator: EventSimulator): void {
        let from: Point = { x: this.point.x, y: this.point.y };
        let to: Point = { x: this.point.x, y: this.point.y };

        let height = this.component ? this.component.getHeight() : simulator.getHeight();
        let width = this.component ? this.component.getWidth() : simulator.getWidth();

        if (this.direct == Direct.UP) {
            from.y -= (height * 2) / 5;
            to.y += (height * 2) / 5;
        } else if (this.direct == Direct.DOWN) {
            from.y += (height * 2) / 5;
            to.y -= (height * 2) / 5;
        } else if (this.direct == Direct.LEFT) {
            from.x -= (width * 2) / 5;
            to.x += (width * 2) / 5;
        } else if (this.direct == Direct.RIGHT) {
            from.x += (width * 2) / 5;
            to.x -= (width * 2) / 5;
        }

        simulator.drag(from, to, this.velocity);
    }
}

export class InputTextEvent extends UIEvent {
    @Expose()
    protected text: string;

    constructor(componentOrPoint: Component | Point, text: string) {
        super('InputTextEvent', componentOrPoint);
        this.text = text;
    }

    send(simulator: EventSimulator): void {
        simulator.inputText(this.point, this.text);
    }
}

export class SwipeEvent extends UIEvent {
    @Expose()
    protected toPoint: Point;
    @Expose()
    protected toComponent: Component;
    @Expose()
    protected velocity: number;

    constructor(from: Point | Component, to: Point | Component, velocity: number = 600) {
        super('SwipeEvent', from);
        if (to instanceof Component) {
            this.toComponent = to;
            this.toPoint = to.getCenterPoint();
        } else {
            this.toPoint = to;
        }
        this.velocity = velocity;
    }

    send(simulator: EventSimulator): void {
        simulator.swipe(this.point, this.toPoint, this.velocity);
    }
}
