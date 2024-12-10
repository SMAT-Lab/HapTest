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

export interface PerfStatData {
    name: string;
    instructions: number;
    cycles: number;
}

export interface PerfDetailData {
    pid: number;
    name: string;
    tid: number;
    threadName: string;
    file: string;
    symbol: string;
    instructions: number;
    instructionsTree: number;
    cycles: number;
    cyclesTree: number;
    moduleName: string;
}

interface Symbol {
    file: string;
    symbol: string;
}

interface Function {
    symbol: Symbol;
    counts: number[];
}

interface FileEvent {
    name: string;
    eventCount: number;
    functions: Function[];
}

interface CallStackEvent {
    symbol: Symbol | undefined;
    selfEvents: number;
    subEvents: number;
    callStack: CallStackEvent[];
}

interface Thread {
    tid: number;
    name: string;
    sampleCount: number;
    eventCount: number;
    calledOrder: CallStackEvent;
    callOrder: CallStackEvent;
    libs: FileEvent[];
}

interface Process {
    pid: number;
    name: string;
    eventCount: number;
    threads: Thread[];
}

interface SampleInfo {
    eventName: string;
    eventCount: number;
    processes: Process[];
}

const CYCLES_EVENT: Set<string> = new Set(['hw-cpu-cycles', 'cpu-cycles']);
const INSTRUCTION_EVENT: Set<string> = new Set(['hw-instructions', 'instructions']);

export class PerfReport {
    deviceCommandLine: string;
    deviceTime: string;
    deviceType: string;
    osVersion: string;
    processNameMap: Map<number, string>;
    threadNameMap: Map<number, string>;
    symbolMap: Map<number, Symbol>;
    symbolsFileList: string[];
    sampleInfos: SampleInfo[];

    constructor(perfJsonObj: any) {
        this.deviceCommandLine = perfJsonObj.deviceCommandLine;
        this.deviceTime = perfJsonObj.deviceTime;
        this.deviceType = perfJsonObj.deviceType;
        this.osVersion = perfJsonObj.osVersion;
        this.symbolsFileList = perfJsonObj.symbolsFileList;

        this.processNameMap = new Map();
        this.threadNameMap = new Map();
        this.symbolMap = new Map();
        this.sampleInfos = [];

        for (const [key, value] of Object.entries<string>(perfJsonObj.processNameMap)) {
            this.processNameMap.set(parseInt(key), value);
        }

        for (const [key, value] of Object.entries<string>(perfJsonObj.threadNameMap)) {
            this.threadNameMap.set(parseInt(key), value);
        }

        for (const [key, value] of Object.entries<Symbol>(perfJsonObj.SymbolMap || {})) {
            this.symbolMap.set(parseInt(key), {
                file: this.symbolsFileList[parseInt(value.file)],
                symbol: value.symbol,
            });
        }

        for (const sampleInfo of perfJsonObj.recordSampleInfo) {
            sampleInfo.eventName = sampleInfo.eventName || sampleInfo.eventConfigName;
            if (CYCLES_EVENT.has(sampleInfo.eventName) || INSTRUCTION_EVENT.has(sampleInfo.eventName)) {
                for (const process of sampleInfo.processes) {
                    this.transforProcess(process);
                    this.sampleInfos.push(sampleInfo);
                }
            }
        }
    }

    private transforProcess(process: any): void {
        process.name = this.processNameMap.get(process.pid)!;
        for (const thread of process.threads) {
            this.transforThread(thread);
        }
    }

    private transforThread(thread: any): void {
        let threadInf = thread as Thread;
        threadInf.name = this.threadNameMap.get(thread.tid)!;
        threadInf.callOrder = this.transforCallStackEvent(thread.CallOrder);
        threadInf.calledOrder = this.transforCallStackEvent(thread.CalledOrder);
        threadInf.libs = this.transforLibs(thread.libs);
    }

    private transforCallStackEvent(event: any): CallStackEvent {
        let callStackEvent = event as CallStackEvent;
        callStackEvent.symbol = this.symbolMap.get(event.symbol)!;
        for (const child of callStackEvent.callStack) {
            this.transforCallStackEvent(child);
        }
        return callStackEvent;
    }

    private transforLibs(libs: any[]): FileEvent[] {
        for (const file of libs) {
            let fileEvent = file as FileEvent;
            fileEvent.name = this.symbolsFileList[file.fileId];
            for (const functionInf of file.functions) {
                functionInf.symbol = this.symbolMap.get(functionInf.symbol as number)!;
            }
        }
        return libs;
    }

    public getProcessSumData(processName: string): PerfStatData[] {
        let resultMaps: Map<string, PerfStatData> = new Map();

        for (const sampleInfo of this.sampleInfos) {
            let event = sampleInfo.eventName;
            for (const process of sampleInfo.processes) {
                if (process.name !== processName && !process.name.startsWith(`${processName}:`)) {
                    continue;
                }

                let data: PerfStatData = { name: process.name, instructions: 0, cycles: 0 };
                if (resultMaps.has(process.name)) {
                    data = resultMaps.get(process.name)!;
                } else {
                    resultMaps.set(process.name, data);
                }

                if (CYCLES_EVENT.has(event)) {
                    data.cycles = process.eventCount;
                } else if (INSTRUCTION_EVENT.has(event)) {
                    data.instructions = process.eventCount;
                }
            }
        }

        return Array.from(resultMaps.values());
    }

    public getProcessFunctionData(processName: string): PerfDetailData[] {
        let resultMaps: Map<string, PerfDetailData> = new Map();

        for (const sampleInfo of this.sampleInfos) {
            let event = sampleInfo.eventName;
            for (const process of sampleInfo.processes) {
                if (process.name !== processName && !process.name.startsWith(`${processName}:`)) {
                    continue;
                }

                for (const thread of process.threads) {
                    for (const file of thread.libs) {
                        for (const func of file.functions) {
                            let data: PerfDetailData = {
                                pid: process.pid,
                                name: process.name,
                                tid: thread.tid,
                                threadName: thread.name,
                                file: func.symbol.file,
                                symbol: func.symbol.symbol,
                                instructions: 0,
                                instructionsTree: 0,
                                cycles: 0,
                                cyclesTree: 0,
                                moduleName: ''
                            }

                            data.moduleName = this.findModuleName(data);

                            if (CYCLES_EVENT.has(event)) {
                                data.cycles = func.counts[1];
                                data.cyclesTree = func.counts[2];
                            } else if (INSTRUCTION_EVENT.has(event)) {
                                data.instructions = func.counts[1];
                                data.instructionsTree = func.counts[2];
                            }

                            let key = `${data.pid}_${data.tid}_${data.symbol}`;
                            if (resultMaps.has(key)) {
                                let value = resultMaps.get(key)!;
                                value.cycles += data.cycles;
                                value.cyclesTree += data.cyclesTree;
                                value.instructions += data.instructions;
                                value.instructionsTree += data.instructionsTree;
                            } else {
                                resultMaps.set(key, data);
                            }
                        }
                    }
                }                
            }
        }

        return Array.from(resultMaps.values());
    }

    private findModuleName(data: PerfDetailData): string {
        return '';
    }
}
