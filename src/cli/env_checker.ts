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

import path from 'path';
import fs from 'fs';
import { install } from 'bjc';
import { which } from '../utils/which';
import { FileNotFoundError } from '../error/error';
import { FuzzOptions } from '../runner/fuzz_options';
import { getLogger } from 'log4js';

const logger = getLogger();
const REQUIRED_HOST_TOOLS: Map<string, (string | boolean)[]> = new Map([
    ['hdc', ['Please add hdc to your systems PATH.', true]],
    [
        'dot',
        [
            "Make sure the Graphviz executables are on your systems PATH, If you don't have it, you can download and install it from https://graphviz.org/download/.",
            false,
        ],
    ],
    ['java', ['Please add java to your systems PATH.', false]],
    ['hvigorw', ['Please add hvigorw to your systems PATH.', false]],
]);

export class EnvChecker {
    private options: FuzzOptions;

    constructor(options: FuzzOptions) {
        this.options = options;
    }

    check(): void {
        if (!fs.existsSync(this.options.hap)) {
            this.options.bundleName = this.options.hap;
        } else {
            let stat = fs.statSync(this.options.hap);
            if (stat.isFile()) {
                this.options.hapFile = this.options.hap;
            } else if (stat.isDirectory()) {
                this.options.sourceRoot = this.options.hap;
                this.options.coverage = true;
            } else {
                logger.error(`${this.options.hap} input is illegal.`);
                process.exit();
            }
        }

        if (!this.checkRequiredHostTools(this.options.sourceRoot !== undefined)) {
            process.exit();
        }

        if (this.options.sourceRoot) {
            if (!this.checkProject() || !this.installBjc()) {
                process.exit();
            }
        }
    }

    private checkRequiredHostTools(needCompile: boolean): boolean {
        let passed = true;
        for (const [key, [msg, option]] of REQUIRED_HOST_TOOLS) {
            try {
                which(key);
            } catch (error) {
                if (error instanceof FileNotFoundError) {
                    logger.error(msg);
                    if (option || needCompile) {
                        passed = false;
                    }
                }
            }
        }
        return passed;
    }

    private installBjc(): boolean {
        let hvigorFile = which('hvigorw');
        let cmdlineHome = path.normalize(path.join(path.dirname(hvigorFile), '..'));
        let sdk = path.join(cmdlineHome, 'sdk');
        if (process.env.DEVECO_SDK_HOME) {
            sdk = process.env.DEVECO_SDK_HOME;
        }
        if (!fs.existsSync(sdk)) {
            logger.error('Not found sdk, please check that the command-line-tools is installed correctly.');
            return false;
        }
        // install bjc to sdk
        if (!install(sdk)) {
            logger.error('bjc install fail.');
            return false;
        }
        return true;
    }

    private checkProject(): boolean {
        let buildProfile = path.join(this.options.sourceRoot!, 'build-profile.json5');
        if (!fs.existsSync(buildProfile)) {
            logger.error(`${buildProfile} is not exists.`);
            return false;
        }

        return true;
    }
}
