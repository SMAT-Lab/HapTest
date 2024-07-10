import fs from 'fs';
import { Hap } from '../hap';
import AdmZip from 'adm-zip';
import Logger from '../../utils/logger';
import { Device } from '../../device/device';
const logger = Logger.getLogger();

export class HapBuilder {
    static buildHap(device: Device, hap: string): Hap {
        if (fs.existsSync(hap)) {
            return HapBuilder.buildFromHapFile(hap);
        }

        return HapBuilder.buildFromBundleName(device, hap);
    }

    static buildFromHapFile(hapFile: string): Hap {
        if (!fs.existsSync(hapFile)) {
            logger.error(`HapBuilder->buildFromHapFile HAP not exist. ${hapFile}`);
            throw new Error(`HAP not exist. ${hapFile}`);
        }
        let zip = new AdmZip(hapFile);
        try {
            // AdmZip/zipEntry.js/parseExtra exception, hap zip file extra field not satisfied: 2|Header ID 2|Data length n|Data
            let info = JSON.parse(zip.readAsText('pack.info'));
            let hap = new Hap();
            hap.hapFile = hapFile;
            hap.bundleName = info.summary.app.bundleName;
            hap.versionCode = info.summary.app.version.code;

            for (let module of info.summary.modules) {
                if (module.mainAbility) {
                    hap.mainAbility = module.mainAbility;
                }
                module.abilities?.forEach((ability: { name: string }) => {
                    hap.ablities.push(ability.name);
                });
            }
            hap.mainAbility = 'EntryAbility';
            hap.ablities = ['EntryAbility'];
            return hap;
        } catch (err) {
            logger.error(`HapBuilder->buildFromHapFile HAP ${hapFile} not found 'pack.info'.`);
            throw new Error(`HAP ${hapFile} not found 'pack.info'.`);
        }
    }

    static buildFromBundleName(device: Device, bundleName: string): Hap {
        let bundleInfo = device.getBundleInfo(bundleName);
        if (!bundleInfo) {
            logger.error(`HAP ${bundleName} not exist, please install the HAP first.`)
            throw new Error(`HAP ${bundleName} not exist.`);
        }

        let hap = new Hap();
        hap.bundleName = bundleInfo.applicationInfo.bundleName;
        for (let module of bundleInfo.hapModuleInfos) {
            for (let ability of module.abilityInfos) {
                if (ability.name.endsWith(module.mainAbility) && module.name == bundleInfo.mainEntry) {
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
