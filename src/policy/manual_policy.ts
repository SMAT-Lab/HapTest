import { Device } from '../device/device';
import { AbilityEvent } from '../event/system_event';
import { Event } from '../event/event';
import { ManualEvent } from '../event/manual_event';
import { Hap } from '../model/hap';
import { InputPolicy } from './input_policy';
import { DeviceState } from '../model/device_state';

export class ManualPolicy extends InputPolicy {
    private firstEvent: boolean;

    constructor(device: Device, hap: Hap) {
        super(device, hap);
        this.firstEvent = true;
    }

    generateEvent(deviceState: DeviceState): Event {
        if (this.firstEvent) {
            this.firstEvent = false;
            return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
        }

        return new ManualEvent();
    }
}
