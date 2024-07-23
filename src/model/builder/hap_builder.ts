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
import { Hap } from '../hap';
import AdmZip from 'adm-zip';
import Logger from '../../utils/logger';
import { Device } from '../../device/device';
import { FileNotFoundError } from '../../error/error';
const logger = Logger.getLogger();

export class HapBuilder {
    static buildFromHapFile(hapFile: string): Hap {
        if (!fs.existsSync(hapFile)) {
            logger.error(`HapBuilder->buildFromHapFile HAP not exist. ${hapFile}`);
            throw new FileNotFoundError(`HAP ${hapFile} not exist.`);
        }
        let zip = new AdmZip(hapFile);
        try {
            // AdmZip/zipEntry.js/parseExtra exception, hap zip file extra field not satisfied: 2|Header ID 2|Data length n|Data
            let info = JSON.parse(zip.readAsText('pack.info'));
            let hap = new Hap();
            hap.hapFile = hapFile;
            hap.bundleName = info.summary.app.bundleName;
            hap.versionCode = info.summary.app.version.code;
            return hap;
        } catch (err) {
            logger.error(`HapBuilder->buildFromHapFile HAP ${hapFile} not found 'pack.info'.`);
            throw new Error(`HAP ${hapFile} not found 'pack.info'.`);
        }
    }

    static buildFromBundleName(device: Device, bundleName: string): Hap {
        let bundleInfo = device.getBundleInfo(bundleName);
        if (!bundleInfo) {
            logger.error(`HAP ${bundleName} not exist, please install the HAP first.`);
            throw new Error(`HAP ${bundleName} not exist.`);
        }

        let hap = new Hap();
        hap.bundleName = bundleInfo.applicationInfo.bundleName;
        hap.entryModuleName = bundleInfo.entryModuleName;
        hap.versionCode = bundleInfo.versionCode;
        hap.reqPermissions = bundleInfo.reqPermissions;
        for (let module of bundleInfo.hapModuleInfos) {
            for (let ability of module.abilityInfos) {
                if (ability.name.endsWith(module.mainAbility) && module.name == hap.entryModuleName) {
                    hap.mainAbility = ability.name;
                }
                if (ability.visible) {
                    hap.ablities.push(ability.name);
                }
            }
        }
        return hap;
    }
}
