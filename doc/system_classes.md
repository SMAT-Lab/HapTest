```Mermaid
classDiagram
    class FuzzOptions {
        hap: string
        eventCount: number
        policyName: string
        randomInput: boolean
        output: string
    }
    <<interface>> FuzzOptions

    class Fuzz {
        -options: FuzzOptions
        -device: Device
        -hap: Hap
        -inputManager: InputManager

        +start()
    }

    class Hap {
        +bundleName
        +mainAbility
    }

    class EventSimulator {

    }
    <<interface>> EventSimulator

    class Device {
        hdc: Hdc
    }

    class InputManager {
        -policy: InputPolicy
        +start()
        +stop()
    }

    class InputPolicy {
        enabled: boolean
        +stop()
        +generateEvent(deviceState: DeviceState): Event*
    }

    class Event {
        send(device: EventSimulator)*
    }

    Device  --|>  EventSimulator
    Hap --o Fuzz: hap
    FuzzOptions --o Fuzz: options
    Device --o Fuzz: device
    InputManager --o Fuzz: inputManager
    InputPolicy --o InputManager: policy

    Event --o InputManager: addEvent
    EventSimulator --o Event: send
```