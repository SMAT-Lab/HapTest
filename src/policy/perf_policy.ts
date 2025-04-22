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
import { Event } from '../event/event';
import { BACK_KEY_EVENT, HOME_KEY_EVENT } from '../event/key_event';
import { AbilityEvent, StopHapEvent } from '../event/system_event';
import { Page } from '../model/page';
import { Policy, PolicyFlag } from './policy';

export class PerfPolicy extends Policy {
    async generateEvent(page: Page): Promise<Event> {
        if (this.flag === PolicyFlag.FLAG_INIT) {
            if (this.hap.bundleName === 'com.ohos.sceneboard') {
                this.flag = PolicyFlag.FLAG_START_APP;
            } else if (!page.isStop()) {
                this.flag = PolicyFlag.FLAG_STOP_APP;
                return new StopHapEvent(this.hap.bundleName);
            }
        }

        if (this.flag === PolicyFlag.FLAG_START_APP) {
            this.device.dumpHap(this.hap);
            this.flag = PolicyFlag.FLAG_STARTED;
            return BACK_KEY_EVENT;
        }

        if (this.flag === PolicyFlag.FLAG_STARTED) {
            this.stop();
            return new StopHapEvent(this.hap.bundleName);
        }

        if (page.isStop() && (this.flag === PolicyFlag.FLAG_INIT || this.flag === PolicyFlag.FLAG_STOP_APP)) {
            this.flag = PolicyFlag.FLAG_START_APP;
            this.device
                .getHdc()
                .hiperfRecord()
                .then((perfdata) => {
                    this.writePerfData(perfdata);
                });
            return new AbilityEvent(this.hap.bundleName, this.hap.mainAbility);
        }

        return HOME_KEY_EVENT;
    }

    private writePerfData(perfData: string[]) {
        let perfDir = path.join(this.device.getOutput(), 'perf');
        if (!fs.existsSync(perfDir)) {
            fs.mkdirSync(perfDir);
        }
        for (const file of perfData) {
            this.device.getHdc().recvFile(file, path.join(this.device.getOutput(), 'perf', path.basename(file)));
        }
    }
}