import { Event } from './event';
import { KeyCode } from '../model/key_code';
import { EventSimulator } from '../device/event_simulator';
import { Expose } from 'class-transformer';

export class KeyEvent extends Event {
    @Expose()
    protected keyCode: KeyCode;

    constructor(keyCode: KeyCode) {
        super('KeyEvent');
        this.keyCode = keyCode;
    }

    send(simulator: EventSimulator): void {
        simulator.inputKey(this.keyCode, undefined, undefined);
    }
}

export class CombinedKeyEvent extends KeyEvent {
    @Expose()
    protected keyCode1: KeyCode;
    @Expose()
    protected keyCode2: KeyCode | undefined;

    constructor(code0: KeyCode, code1: KeyCode, code2: KeyCode | undefined = undefined) {
        super(code0);
        this.type = 'CombinedKeyEvent';
        this.keyCode1 = code1;
        this.keyCode2 = code2;
    }

    send(simulator: EventSimulator): void {
        if (this.keyCode2 == undefined) {
            simulator.inputKey(this.keyCode, this.keyCode1, undefined);
        } else {
            simulator.inputKey(this.keyCode, this.keyCode1, this.keyCode2);
        }
    }
}

export const BACK_KEY_EVENT = new KeyEvent(KeyCode.KEYCODE_BACK);
export const HOME_KEY_EVENT = new KeyEvent(KeyCode.KEYCODE_HOME);
