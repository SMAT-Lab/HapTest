
import { EventSimulator } from '../device/event_simulator';
import { Expose } from "class-transformer";
import {Event} from "./event";
export class WaitEvent extends Event {
  @Expose()
  readonly reason: string;

  constructor(reason: string = "Waiting for async result") {
    super("WaitEvent");
    this.reason = reason;
  }

  send(simulator: EventSimulator): void {
    // WaitEvent 不应实际发送，这里留空或抛错
    console.warn("WaitEvent should not be sent to simulator.");
  }

  override toString(): string {
    return `WaitEvent: ${this.reason}`;
  }
}
