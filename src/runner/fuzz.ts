import { Device } from '../device/device';
import { HapBuilder } from '../model/builder/hap_builder';
import { Hap } from '../model/hap';
import { FuzzOptions } from './fuzz_options';
import { InputManager } from './input_manager';

/**
 * Fuzz test entrance
 */
export class Fuzz {
    options: FuzzOptions;
    device: Device;
    hap: Hap;
    inputManager: InputManager;

    constructor(options: FuzzOptions) {
        this.options = options;
        this.device = new Device(this.options.connectkey, this.options.output);
        this.hap = HapBuilder.buildHap(this.device, this.options.hap);
        this.inputManager = new InputManager(this.device, this.hap, this.options);
    }

    start() {
        // install hap
        this.device.installHap(this.hap);
        this.inputManager.start();
    }
}
