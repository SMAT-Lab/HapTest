```Mermaid
classDiagram
    class Event {
        send(device: EventSimulator)*
    }

    class Policy {
        enabled: boolean
        +stop()
        +generateEvent(deviceState: DeviceState): Event*
    }

    class RunnerManager {
        -policy: Policy
        +start()
        +stop()
    }

    class ManualPolicy {

    }

    Policy --o RunnerManager: policy
    Event --o Policy: generateEvent()

    ManualPolicy --|> Policy
    PTGPolicy --|> Policy
    PtgNaiveSearchPolicy --|> PTGPolicy
    PtgGreedySearchPolicy --|> PTGPolicy

```