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

export class Hap {
    private _bundleName: string;
    private _versionCode: number;
    private _versionName: string;
    private _entryModuleName: string;
    private _mainAbility: string;
    private _ablities: string[];
    private _hapFile: string;
    private _reqPermissions: string[];

    constructor() {
        this._ablities = [];
        this._bundleName = '';
        this._versionCode = 0;
        this._versionName = '';
        this._entryModuleName = '';
        this._mainAbility = '';
        this._hapFile = '';
        this._reqPermissions = [];
    }

    public get bundleName(): string {
        return this._bundleName;
    }

    public set bundleName(bundleName: string) {
        this._bundleName = bundleName;
    }

    public get versionCode(): number {
        return this._versionCode;
    }

    public set versionCode(versionCode: number) {
        this._versionCode = versionCode;
    }

    public get versionName(): string {
        return this._versionName;
    }

    public set versionName(_versionName: string) {
        this._versionName = _versionName;
    }

    public get mainAbility(): string {
        return this._mainAbility;
    }

    public set mainAbility(mainAbility: string) {
        this._mainAbility = mainAbility;
    }

    public get ablities(): string[] {
        return this._ablities;
    }

    public set ablities(ablities: string[]) {
        this._ablities = ablities;
    }

    public get hapFile(): string {
        return this._hapFile;
    }

    public set hapFile(hapFile: string) {
        this._hapFile = hapFile;
    }

    public get entryModuleName(): string {
        return this._entryModuleName;
    }

    public set entryModuleName(entry: string) {
        this._entryModuleName = entry;
    }

    public get reqPermissions(): string[] {
        return this._reqPermissions;
    }

    public set reqPermissions(permissions: string[]) {
        this._reqPermissions = permissions;
    }
}

export enum HapRunningState {
    FOREGROUND,
    BACKGROUND,
    STOP
}

export function convertStr2RunningState(state: string): HapRunningState {
    const convertMap: { [key: string]: HapRunningState } = {
        READY: HapRunningState.BACKGROUND,
        FOREGROUND: HapRunningState.FOREGROUND,
        BACKGROUND: HapRunningState.BACKGROUND,
    };
    return convertMap[state];
}
