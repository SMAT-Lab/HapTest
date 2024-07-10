import { Device } from '../device/device';
import { Event } from '../event/event';
import { DeviceState } from '../model/device_state';
import { Hap } from '../model/hap';
import { InputPolicy } from './input_policy';
import { UTG } from './utg';

export abstract class UTGInputPolicy extends InputPolicy {
    protected randomInput: boolean;
    protected lastEvent: Event;
    protected lastState: DeviceState;
    protected currentState: DeviceState;
    protected utg: UTG;

    constructor(device: Device, hap: Hap, randomInput: boolean) {
        super(device, hap);
        this.randomInput = randomInput;
        this.utg = new UTG(device, hap, randomInput);
    }

    generateEvent(deviceState: DeviceState): Event {
        this.currentState = deviceState;
        this.updateUtg();

        // todo: script event
        let event = this.generateEventBasedOnUtg();
        this.lastState = this.currentState;
        this.lastEvent = event;
        return event;
    }

    private updateUtg() {
        if (this.lastEvent && this.lastState && this.currentState) {
            this.utg.addTransition(this.lastEvent, this.lastState, this.currentState);
        }
    }

    abstract generateEventBasedOnUtg(): Event;
}
