```Mermaid
classDiagram
    class Event {
        send(device: EventSimulator)*
    }

    class InputPolicy {
        enabled: boolean
        +stop()
        +generateEvent(deviceState: DeviceState): Event*
    }

    class InputManager {
        +addEvent(event: Event): void;
        +getEventCount(): number
        +enabled(): boolean
        +start()
        +stop()
    }
    <<interface>> InputManager

    class ManualPolicy {

    }

    InputManager --o InputPolicy: start()
    Event --o InputPolicy: generateEvent()

    ManualPolicy --|> InputPolicy
    UTGInputPolicy --|> InputPolicy
    UtgNaiveSearchPolicy --|> UTGInputPolicy

```