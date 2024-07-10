import { Expose } from 'class-transformer';
import { EventSimulator } from '../device/event_simulator';
import { DeviceState } from '../model/device_state';
import { Event } from './event';
import { CryptoUtils } from '../utils/crypto_utils';

export class ManualEvent extends Event {
    @Expose()
    protected time: number;

    constructor() {
        super('ManualEvent');
        this.time = new Date().getTime();
    }

    send(simulator: EventSimulator): void {}

    eventStateSig(state: DeviceState): string {
        return CryptoUtils.sha256(this.toString());
    }
}
