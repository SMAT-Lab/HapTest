import Logger from '../utils/logger';
import { UTGInputPolicy } from './utg_input_policy';
import { Device } from '../device/device';
import { Hap } from '../model/hap';
import { Event } from '../event/event';
import { AbilityEvent, ExitEvent, StopHapEvent } from '../event/system_event';

const logger = Logger.getLogger();
export class UtgGreedySearchPolicy extends UTGInputPolicy{

    constructor(device: Device, hap: Hap) {
        super(device, hap, true);

    }
   
    generateEventBasedOnUtg(): Event {
        return new ExitEvent();
    }
}