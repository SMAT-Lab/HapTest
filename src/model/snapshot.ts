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

import { CoverageReport } from "bjc";
import { Device } from "../device/device";
import { Expose } from 'class-transformer';

/**
 * Snapshots of the test site
 */
export class Snapshot {
    /** screen width */
    @Expose()
    screenWidth: number;
    /** screen height */
    @Expose()
    screenHeight: number;
    /** cap screen path */
    @Expose()
    screenCapPath: string;
    /** fault logs in device */
    @Expose()
    faultLogs: Set<string>;
    /** coverage */
    @Expose()
    coverage: CoverageReport | undefined;
    /** device udid */
    @Expose()
    udid: string;
    
    constructor(device: Device, screen: string, faultLogs: Set<string>, coverage?: CoverageReport) {
        this.udid = device.getUdid();
        this.screenWidth = device.getWidth();
        this.screenHeight = device.getHeight();
        this.screenCapPath = screen;
        this.faultLogs = faultLogs;
        this.coverage = coverage;
    }
}