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
import { CompareDetector } from '../compare/types';
import { compareDynamicLogs } from '../utils/dynamic_compare';

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

function formatTimestamp(date: Date): string {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const ss = date.getSeconds().toString().padStart(2, '0');
    return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

function resolveCompareReportPath(
    outputOption: string | undefined,
    dataRoot: string,
    appFolder: string,
    detector: CompareDetector
): string {
    const defaultName = `${detector}_${formatTimestamp(new Date())}`;
    const defaultDir = path.join(dataRoot, 'compare', appFolder);
    if (!outputOption) {
        return path.join(defaultDir, defaultName);
    }

    const resolvedOutput = path.resolve(outputOption);
    const looksLikeDirectory =
        outputOption.endsWith('/') ||
        outputOption.endsWith('\\') ||
        (path.extname(outputOption) === '' && !outputOption.endsWith('.json'));

    return looksLikeDirectory ? path.join(resolvedOutput, defaultName) : resolvedOutput;
}

async function runFuzzCommand(options: any): Promise<void> {
    const outputDir = path.resolve(options.output ?? 'out');
    const logLevel = resolveLogLevel(options);

    HapTestLogger.configure(path.join(outputDir, 'haptest.log'), logLevel);
    logger.info(`haptest start by args ${JSON.stringify(options)}.`);

    const hapList: string[] = Array.isArray(options.hap) ? options.hap : options.hap != null ? [options.hap] : [];
    if (hapList.length === 0) {
        logger.error('At least one -i/--hap is required.');
        process.exit(1);
    }

    for (const hap of hapList) {
        const fuzzOption: FuzzOptions = {
            connectkey: options.target,
            hap,
            policyName: options.policy,
            output: outputDir,
            startFromCurrentPage: options.fromCurrentPage,
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
    }
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

async function runCompareCommand(options: any): Promise<void> {
    const outputOption = options.output;
    const dataRoot = path.resolve(options.dataRoot ?? 'out');
    const detector = (options.detector ?? 'all') as CompareDetector;
    const reportPath = resolveCompareReportPath(outputOption, dataRoot, options.app, detector);
    const reportDir = path.dirname(reportPath);
    const logLevel = resolveLogLevel(options);
    fs.mkdirSync(reportDir, { recursive: true });
    HapTestLogger.configure(path.join(reportDir, 'haptest.log'), logLevel);

    if (!['all', 'full-width', 'ratio', 'scene', 'diff'].includes(detector)) {
        throw new Error(`Invalid detector: ${options.detector}. Use one of: all, full-width, ratio, scene, diff.`);
    }

    await compareDynamicLogs({
        outputRoot: dataRoot,
        appFolder: options.app,
        mobileDir: options.mobile,
        twoInOneDir: options.twoInOne,
        reportPath,
        fullWidthTolerance: Number(options.tolerance),
        aspectRatioTolerance: Number(options.ratioTolerance),
        sceneSimilarityThreshold: Number(options.sceneSimilarityThreshold),
        detector,
        aiComponentMatch: options.aiComponentMatch,
        aiComponentModel: options.aiComponentModel,
        aiComponentThreshold: Number(options.aiComponentThreshold),
        aiComponentMaxCalls: Number(options.aiComponentMaxCalls),
        aiComponentConfigPath: options.aiComponentConfig,
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
        .command('compare')
        .description('Compare mobile and 2in1 dynamic logs for the same app')
        .requiredOption('-a, --app <dir>', 'app log folder name under each device directory')
        .option('-o, --output <path>', 'report output file or directory path')
        .option('--dataRoot <dir>', 'dynamic logs root directory containing mobile/2in1', 'out')
        .option('--mobile <dir>', 'mobile device folder name', 'mobile')
        .option('--twoInOne <dir>', '2in1 device folder name', '2in1')
        .option('--tolerance <number>', 'full width tolerance in px', '1')
        .option('--ratioTolerance <number>', 'aspect ratio tolerance', '0.01')
        .option('--sceneSimilarityThreshold <number>', 'business scene similarity threshold', '0.35')
        .option('--detector <name>', 'detector to run: all | full-width | ratio | scene | diff', 'all')
        .option('--aiComponentMatch', 'enable AI fallback to judge whether two components are the same', false)
        .option('--aiComponentModel <name>', 'AI model used for component matching', 'openrouter/free')
        .option('--aiComponentThreshold <number>', 'minimum AI confidence to accept a matched component pair', '0.6')
        .option('--aiComponentMaxCalls <number>', 'maximum number of AI matching calls in one compare task', '200')
        .option('--aiComponentConfig <path>', 'config file path containing GPT_CONFIG', 'config.json')
        .option('--debug', 'debug log level', false)
        .action(async (cmdOptions) => {
            try {
                await runCompareCommand(cmdOptions);
            } catch (err) {
                logger.error('haptest compare command failed.', err);
                process.exit(1);
            }
        });

    program
        .description('HapTest fuzz runner')
        .option('-i, --hap <items...>', 'HAP bundle name or HAP file path or HAP project source root (can specify multiple)')
        .option('-o --output <dir>', 'output dir', 'out')
        .option('--policy <policyName>', 'policy name', 'manu')
        .option('-t --target [connectkey]', 'hdc connectkey', undefined)
        .option('-c --coverage', 'enable coverage', false)
        .option('--report [report root]', 'report root')
        .option('--from-current-page', 'start haptest from the simulator current foreground page', false)
        .option('--debug', 'debug log level', false)
        .option('--exclude [excludes...]', 'exclude bundle name')
        .option('--llm', 'start llm policy', false)
        .option('--simK <number>', '', '8')
        .option('--staticConfig <file>', 'Path to static configuration file')
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
