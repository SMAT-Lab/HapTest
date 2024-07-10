```Mermaid
classDiagram
    class Page {
        -viewTree: ViewTree;
        -abilityName: string;
        -bundleName: string;
        -pagePath: string;

        +selectComponents(): Component[]
    }

    class ViewTree {
        root: Component;
    }

    class Component {
        parent: Component | null;
        children: Component[];
        attributes()
    }

    ViewTree --* Page: viewTree
    Component --* ViewTree: root
    Component --* Component: children

```