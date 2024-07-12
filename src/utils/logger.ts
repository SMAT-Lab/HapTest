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

import type { Logger } from 'log4js';
import { configure, getLogger } from 'log4js';

export enum LOG_LEVEL {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    TRACE = 'TRACE',
}

export default class ArkTestLogger {
    static hasConfigured: boolean = false;
    public static configure(logFilePath: string = 'arktest.log', level: LOG_LEVEL = LOG_LEVEL.DEBUG): void {
        configure({
            appenders: {
                file: {
                    type: 'fileSync',
                    filename: `${logFilePath}`,
                    maxLogSize: 5 * 1024 * 1024,
                    backups: 5,
                    compress: true,
                    encoding: 'utf-8',
                    layout: {
                        type: 'pattern',
                        pattern: '[%d] [%p] [%z] [bjc] - %m',
                    },
                },
                console: {
                    type: 'console',
                    layout: {
                        type: 'pattern',
                        pattern: '[%d] [%p] [%z] [bjc] - %m',
                    },
                },
            },
            categories: {
                default: {
                    appenders: ['console', 'file'],
                    level,
                    enableCallStack: false,
                },
            },
        });
    }

    public static getLogger(): Logger {
        if (!this.hasConfigured) {
            this.configure();
            this.hasConfigured = true;
        }
        return getLogger();
    }

    public static setLogLevel(level: LOG_LEVEL): void {
        getLogger().level = level;
    }
}
