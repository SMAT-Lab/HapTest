import { SerializeUtils } from '../utils/serialize_utils';
import { Component } from './component';

export class ViewTree {
    private root: Component;
    private components: Component[];

    constructor(root: Component) {
        this.root = root;
        this.components = [];
    }

    getRoot(): Component {
        return this.root;
    }

    getComponents(): Component[] {
        if (this.components.length == 0) {
            this.walk(this.root);
        }

        return this.components;
    }

    toJson(): Record<string, any> {
        return SerializeUtils.instanceToPlain(this.getRoot(), { groups: ['Content'] });
    }

    getContent(): string {
        return SerializeUtils.serialize(this.getRoot(), { groups: ['Content'] });
    }

    getStructual(): string {
        let structures: Object[] = [];
        this.getComponents().forEach((value) => {
            structures.push(value.structure());
        });

        return JSON.stringify(structures);
    }

    private walk(component: Component): void {
        this.components.push(component);
        for (let child of component.children) {
            this.walk(child);
        }
    }
}
