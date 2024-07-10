import { program } from 'commander';
import { Fuzz } from '../runner/fuzz';
import Logger from '../utils/logger';
import { FuzzOptions } from '../runner/fuzz_options';
const logger = Logger.getLogger();

(function (): void {
    program
        .name('arktest')
        .version('1.0.0')
        .option('-i --hap <file>', 'hap file')
        .option('-o --output <dir>', 'output dir', 'out')
        .option('--policy <policyName>', 'policy name', 'manu')
        .option('-t --target [connectkey]', 'hdc connectkey', undefined)
        .parse();

    let options = program.opts();
    logger.info(`arktest start by args ${JSON.stringify(options)}.`);

    let fuzzOption: FuzzOptions = {
        connectkey: options.target,
        hap: options.hap,
        policyName: options.policy,
        output: options.output,
    };

    let fuzz = new Fuzz(fuzzOption);
    fuzz.start();
})();
