import { Expose } from 'class-transformer';
import { Point } from './point';

export enum ComponentType {
    ModalPage = 'ModalPage',
    Dialog = 'Dialog',
}

export class Component {
    @Expose()
    accessibilityId: string;
    @Expose()
    bounds: Point[];
    @Expose()
    checkable: boolean;
    @Expose()
    checked: boolean;
    @Expose()
    clickable: boolean;
    @Expose()
    description: string;
    @Expose()
    enabled: boolean;
    @Expose()
    focused: boolean;
    @Expose()
    hashcode: string;
    @Expose()
    hint: string;
    @Expose()
    hostWindowId: string;
    @Expose()
    id: string;
    @Expose()
    key: string;
    @Expose()
    longClickable: boolean;
    @Expose()
    origBounds: Point[];
    @Expose()
    scrollable: boolean;
    @Expose()
    selected: boolean;
    @Expose()
    text: string;
    @Expose()
    type: string;
    @Expose()
    visible: boolean;

    rank: number;

    parent: Component | null;
    @Expose({ groups: ['Content'] })
    children: Component[];

    constructor() {
        this.children = [];
        this.rank = 0;
    }

    addChild(child: Component) {
        this.children.push(child);
    }

    getCenterPoint(): Point {
        const centerX = (this.bounds[0].x + this.bounds[1].x) / 2;
        const centerY = (this.bounds[0].y + this.bounds[1].y) / 2;
        return { x: centerX, y: centerY };
    }

    getWidth(): number {
        return Math.abs(this.bounds[0].x - this.bounds[1].x);
    }

    getHeight(): number {
        return Math.abs(this.bounds[0].y - this.bounds[1].y);
    }

    structure(): Object {
        return { accessibilityId: this.accessibilityId, type: this.type };
    }

    hasUIEvent(): boolean {
        return this.enabled && (this.checkable || this.clickable || this.longClickable || this.scrollable);
    }
}
