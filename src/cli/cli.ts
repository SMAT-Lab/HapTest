/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { program } from 'commander';
import { Fuzz } from '../runner/fuzz';
import path from 'path';
import fs from 'fs';
import { HapTestLogger, LOG_LEVEL } from '../utils/logger';
import { FuzzOptions } from '../runner/fuzz_options';
import { EnvChecker } from './env_checker';
import { getLogger } from 'log4js';
const logger = getLogger();

(async function (): Promise<void> {
    let packageCfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), { encoding: 'utf-8' }));
    program
        .name(packageCfg.name)
        .version(packageCfg.version)
        .option('-i --hap <file/bundleName/sourceRoot/ALL>', 'HAP bundle name or HAP file path or HAP project source root')
        .option('-o --output <dir>', 'output dir', 'out')
        .option('--policy <policyName>', 'policy name', 'manu')
        .option('-t --target [connectkey]', 'hdc connectkey', undefined)
        .option('-c --coverage', 'enable coverage', false)
        .option('--report [report root]', 'report root')
        .option('--debug', 'debug log level', false)
        .option('--exclude [excludes...]', 'exclude bundle name')
        .option('--llm', 'start llm policy', false)
        .option('--simK <number>', '', '8')
        .parse();
    let options = program.opts();
    let logLevel = LOG_LEVEL.INFO;
    if (options.debug) {
        logLevel = LOG_LEVEL.DEBUG;
    }
    HapTestLogger.configure('haptest.log', logLevel);
    logger.info(`haptest start by args ${JSON.stringify(options)}.`);

    let fuzzOption: FuzzOptions = {
        connectkey: options.target,
        hap: options.hap,
        policyName: options.policy,
        output: options.output,
        coverage: options.coverage,
        reportRoot: options.report,
        excludes: options.exclude,
        llm: options.llm,
        simK: options.simK
    };
    let envChecker = new EnvChecker(fuzzOption);
    envChecker.check();

    let fuzz = new Fuzz(fuzzOption);
    await fuzz.start();
    logger.info('stop fuzz.');
    process.exit();
})();
