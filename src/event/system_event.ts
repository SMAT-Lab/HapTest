import { Expose } from 'class-transformer';
import { EventSimulator } from '../device/event_simulator';
import { DeviceState } from '../model/device_state';
import { Event } from './event';
import { CryptoUtils } from '../utils/crypto_utils';

export abstract class SystemEvent extends Event {}

export class AbilityEvent extends SystemEvent {
    @Expose()
    protected bundleName: string;
    @Expose()
    protected abilityName: string;

    constructor(bundleName: string, abilityName: string) {
        super('AbilityEvent');
        this.bundleName = bundleName;
        this.abilityName = abilityName;
    }

    send(simulator: EventSimulator): void {
        simulator.startAblity(this.bundleName, this.abilityName);
    }

    eventStateSig(state: DeviceState): string {
        return CryptoUtils.sha256(this.toString());
    }
}

export class StopHapEvent extends SystemEvent {
    @Expose()
    protected bundleName: string;

    constructor(bundleName: string) {
        super('StopHapEvent');
        this.bundleName = bundleName;
    }

    send(simulator: EventSimulator): void {
        simulator.forceStop(this.bundleName);
    }

    eventStateSig(state: DeviceState): string {
        return CryptoUtils.sha256(this.toString());
    }
}

export class ExitEvent extends SystemEvent {
    constructor() {
        super('ExitEvent');
    }

    send(simulator: EventSimulator): void {}
}

