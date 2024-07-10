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
