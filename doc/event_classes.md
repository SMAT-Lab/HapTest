```Mermaid
classDiagram
  class Event {
    #type: string
    eventStateString(state: DeviceState): string
    toString(): string*
    send(device)*
  }

  class KeyEvent {
    #keyCode: KeyCode
  }

  class UIEvent {
    #component: Component
  }

  class TouchEvent {
    #point: Point
  }

  class SystemEvent {
  
  }

  class AbilityEvent {
    #bundleName: string
    #abilityName: string
  }

  class StopHapEvent {
    #bundleName: string
  }
  
  KeyEvent --|> Event
  UIEvent --|> Event
  SystemEvent --|> Event
  ManualEvent --|> Event

  StopHapEvent --|> SystemEvent
  AbilityEvent --|> SystemEvent
  
  TouchEvent --|> UIEvent
  LongTouchEvent --|> UIEvent
  ScrollEvent --|> UIEvent
  SwipeEvent --|> UIEvent
  InputTextEvent --|> UIEvent



```
