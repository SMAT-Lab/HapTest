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
        -policy: InputPolicy
        +start()
        +stop()
    }

    class ManualPolicy {

    }

    InputPolicy --o InputManager: policy
    Event --o InputPolicy: generateEvent()

    ManualPolicy --|> InputPolicy
    UTGInputPolicy --|> InputPolicy
    UtgNaiveSearchPolicy --|> UTGInputPolicy
    UtgGreedySearchPolicy --|> UTGInputPolicy

```