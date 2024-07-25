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
import { execSync } from 'child_process';
import { install, HapProject } from 'bjc';
import { which } from '../utils/which';
import Logger from '../utils/logger';
import { FileNotFoundError } from '../error/error';
import { FuzzOptions } from './fuzz_options';

import { Device } from '../device/device';
import { findFiles } from '../utils/file_utils';
import { HapBuilder } from '../model/builder/hap_builder';
import { Hap } from '../model/hap';
const logger = Logger.getLogger();

export class EnvChecker {
    private cmdlineHome: string;
    private options: FuzzOptions;

    constructor(options: FuzzOptions) {
        this.options = options;
    }

    check(): void {
        if (!this.checkHdc()) {
            process.exit();
        }
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

        if (this.options.sourceRoot) {
            if (!this.checkProject() || !this.checkHvigorw()) {
                process.exit();
            }
        }
    }

    buildHap(device: Device): Hap {
        // using hvigorw to build HAP
        if (this.options.sourceRoot) {
            execSync(`hvigorw -p buildMode=debug -p coverage-mode=bjc clean assembleHap`, {
                stdio: 'inherit',
                cwd: this.options.sourceRoot,
            });

            let deviceType = device.getDeviceType();
            let project = new HapProject(this.options.sourceRoot);
            let module = project.getModule(deviceType);
            let hapFiles = findFiles(path.join(module.path, 'build'), ['.hap']);
            hapFiles.sort();
            if (hapFiles.length > 0) {
                this.options.hapFile = hapFiles[0];
            }
        }

        if (this.options.hapFile) {
            return HapBuilder.buildFromHapFile(this.options.hapFile);
        }

        if (this.options.bundleName) {
            return HapBuilder.buildFromBundleName(device, this.options.bundleName);
        }

        logger.error(`Not found HAP ${this.options.hap}`);
        process.exit();
    }

    private checkHdc(): boolean {
        try {
            which('hdc');
            return true;
        } catch (error) {
            if (error instanceof FileNotFoundError) {
                logger.error(`${error.message}`);
                logger.error('Please add hdc to PATH environment variable.');
            }
            return false;
        }
    }

    private checkHvigorw(): boolean {
        try {
            let hvigorFile = which('hvigorw');
            this.cmdlineHome = path.normalize(path.join(path.dirname(hvigorFile), '..'));
            let sdk = path.join(this.cmdlineHome, 'sdk');
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
        } catch (error) {
            if (error instanceof FileNotFoundError) {
                logger.error(`${error.message}`);
                logger.error('Please add hvigorw to PATH environment variable.');
            }
            return false;
        }
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
