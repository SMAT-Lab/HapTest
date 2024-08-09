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

import { Expose } from 'class-transformer';
import { EventSimulator } from '../device/event_simulator';
import { SerializeUtils } from '../utils/serialize_utils';
import { CryptoUtils } from '../utils/crypto_utils';
import { Rank } from '../model/rank';
import { Page } from '../model/page';

export abstract class Event {
    @Expose()
    protected type: string;
    protected rank: number;

    constructor(type: string) {
        this.type = type;
        this.rank = Rank.NORMAL;
    }

    toString(): string {
        return SerializeUtils.serialize(this.toJson());
    }

    toJson(): Record<string, any> {
        return SerializeUtils.instanceToPlain(this);
    }

    eventPageSig(page: Page): string {
        return CryptoUtils.sha256(SerializeUtils.serialize({ event: this.toJson(), page: page.getContent() }));
    }

    getRank(): number {
        return this.rank;
    }

    setRank(rank: number): void {
        this.rank = rank;
    }

    abstract send(simulator: EventSimulator): void;
}
