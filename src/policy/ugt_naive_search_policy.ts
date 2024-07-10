import { Device } from '../device/device';
import { AbilityEvent, ExitEvent, StopHapEvent } from '../event/system_event';
import { Event } from '../event/event';
import { ComponentType } from '../model/component';
import { DeviceState } from '../model/device_state';
import { Hap } from '../model/hap';
import { Page } from '../model/page';
import { RandomUtils } from '../utils/random_utils';
import { UTGInputPolicy } from './utg_input_policy';
import Logger from '../utils/logger';
import { PolicyFlag } from './input_policy';
import { BACK_KEY_EVENT } from '../event/key_event';
import { EventBuilder } from '../event/event_builder';
import { Rank } from '../model/rank';
const logger = Logger.getLogger();

export const MAX_NUM_RESTARTS = 5;
export class UtgNaiveSearchPolicy extends UTGInputPolicy {
    private retryCount: number;

    constructor(device: Device, hap: Hap) {
        super(device, hap, true);
        this.retryCount = 0;
    }

    generateEventBasedOnUtg(): Event {
        if (this.flag == PolicyFlag.FLAG_INIT) {
            if (this.device.isForeground(this.hap)) {
                this.flag = PolicyFlag.FLAG_STOP_APP;
                return new StopHapEvent(this.hap.bundleName);
            } else {
                this.flag = PolicyFlag.FLAG_START_APP;
                this.retryCount++;
                return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
            }
        }

        if (this.flag == PolicyFlag.FLAG_START_APP || this.flag == PolicyFlag.FLAG_STOP_APP) {
            if (!this.device.isForeground(this.hap)) {
                // check start app count
                if (this.retryCount > MAX_NUM_RESTARTS) {
                    logger.error(`The number of HAP launch attempts exceeds ${MAX_NUM_RESTARTS}`);
                    throw new Error('The HAP cannot be started.');
                }
                this.retryCount++;
                return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
            } else {
                this.retryCount = 0;
                this.flag = PolicyFlag.FLAG_STARTED;
            }
        }

        if (!this.device.isForeground(this.hap)) {
            return BACK_KEY_EVENT;
        }

        let event = this.selectEvent(this.currentState);
        if (event == undefined) {
            if (this.retryCount > MAX_NUM_RESTARTS) {
                this.stop();
                return new ExitEvent();
            }
            this.retryCount++;
            return EventBuilder.createRandomTouchEvent(this.device);
        }
        this.retryCount = 0;

        return event;
    }

    private selectEvent(state: DeviceState): Event | undefined {
        // update rank
        this.updatePreferableComponentRank(state);

        // unexplored events
        let events = state.getPossibleUIEvents().filter((event) => {
            return !this.utg.isEventExplored(event, state);
        });

        // sort by rank
        events.sort((a, b) => {
            return a.getRank() - b.getRank();
        });

        return this.arraySelect(events);
    }

    private updatePreferableComponentRank(state: DeviceState): void {
        for (const component of state.page.selectComponentsByType([ComponentType.ModalPage, ComponentType.Dialog])) {
            Page.collectComponent(component, (item) => {
                if (item.hasUIEvent()) {
                    item.rank = Rank.HIGH;
                }
                return item.hasUIEvent();
            });
        }
    }

    private arraySelect<T>(components: T[]): T | undefined {
        if (components.length == 0) {
            return undefined;
        }

        if (this.randomInput) {
            RandomUtils.shuffle(components);
        }
        return components[0];
    }
}
