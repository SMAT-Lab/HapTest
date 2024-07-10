import { Expose } from 'class-transformer';
import { EventSimulator } from '../device/event_simulator';
import { DeviceState } from '../model/device_state';
import { SerializeUtils } from '../utils/serialize_utils';
import { CryptoUtils } from '../utils/crypto_utils';

export abstract class Event {
    @Expose()
    protected type: string;
    protected rank: number;

    constructor(type: string) {
        this.type = type;
        this.rank = 0;
    }

    toString(): string {
        return SerializeUtils.serialize(this);
    }

    eventStateSig(state: DeviceState): string {
        return CryptoUtils.sha256(SerializeUtils.serialize({ event: this, state: state.getPageContent() }));
    }

    getRank(): number {
        return this.rank;
    }

    abstract send(simulator: EventSimulator): void;
}
