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

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import { getLogger } from 'log4js';
import { Fuzz } from '../runner/fuzz';
import { FuzzOptions } from '../runner/fuzz_options';
import { EnvChecker } from './env_checker';
import { HapTestLogger, LOG_LEVEL } from '../utils/logger';
import { startUIViewerServer } from '../ui/ui_viewer_server';

const logger = getLogger();

interface BaseOptions {
    debug?: boolean;
}

const parsePackageConfig = () => {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), { encoding: 'utf-8' }));
};

function resolveLogLevel(opts: BaseOptions): LOG_LEVEL {
    return opts.debug ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO;
}

async function runFuzzCommand(options: any): Promise<void> {
    const outputDir = path.resolve(options.output ?? 'out');
    const logLevel = resolveLogLevel(options);

    HapTestLogger.configure(path.join(outputDir, 'haptest.log'), logLevel);
    logger.info(`haptest start by args ${JSON.stringify(options)}.`);

    const fuzzOption: FuzzOptions = {
        connectkey: options.target,
        hap: options.hap,
        policyName: options.policy,
        output: outputDir,
        coverage: options.coverage,
        reportRoot: options.report,
        excludes: options.exclude,
        llm: options.llm,
        simK: options.simK,
        staticConfig: options.staticConfig,
    };

    const envChecker = new EnvChecker(fuzzOption);
    envChecker.check();

    const fuzz = new Fuzz(fuzzOption);
    await fuzz.start();
    logger.info('stop fuzz.');
    process.exit();
}

async function runUIViewerCommand(options: any, version: string): Promise<void> {
    const outputDir = path.resolve(options.output ?? 'out');
    fs.mkdirSync(outputDir, { recursive: true });

    const logLevel = resolveLogLevel(options);
    const port = Number(options.port);
    if (Number.isNaN(port) || port <= 0) {
        throw new Error(`Invalid port: ${options.port}`);
    }

    HapTestLogger.configure(path.join(outputDir, 'haptest.log'), logLevel);
    const targetLabel = options.target ?? 'auto';
    logger.info(`haptest ui-viewer start with target=${targetLabel}, port=${port}`);

    await startUIViewerServer({
        connectKey: options.target,
        outputDir,
        port,
        logLevel,
        version,
    });
}

(async function (): Promise<void> {
    const packageCfg = parsePackageConfig();

    program.name(packageCfg.name).version(packageCfg.version);

    program
        .command('ui-viewer')
        .description('Start the HapTest UI viewer web service')
        .option('-t, --target [connectkey]', 'hdc connectkey')
        .option('-p, --port <port>', 'http port', '7789')
        .option('-o, --output <dir>', 'output dir', 'out/ui-viewer')
        .option('--debug', 'debug log level', false)
        .action(async (cmdOptions) => {
            try {
                await runUIViewerCommand(cmdOptions, packageCfg.version);
            } catch (err) {
                logger.error('Failed to start ui-viewer command.', err);
                process.exit(1);
            }
        });

    program
        .description('HapTest fuzz runner')
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
        .option('--staticConfig <file>', '��̬�������������ļ�·��')
        .action(async (cmdOptions) => {
            try {
                await runFuzzCommand(cmdOptions);
            } catch (err) {
                logger.error('haptest fuzz command failed.', err);
                process.exit(1);
            }
        });

    await program.parseAsync(process.argv);
})();
