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

import { HypiumRpc } from './hypium_rpc';

export class FrontEnd {
    protected rpc: HypiumRpc;
    protected backendObjRef: string;

    constructor(rpc: HypiumRpc) {
        this.rpc = rpc;
        this.backendObjRef = '';
    }

    async doRpc(params: any): Promise<any | undefined> {
        return await this.rpc.request(params);
    }

    activate(backendObjRef: string) {
        this.backendObjRef = backendObjRef;
    }

    deactivate() {
        this.backendObjRef = '';
    }

    getBackendObjRef(): string {
        return this.backendObjRef;
    }
}

const ClassNameMap: Map<string, string> = new Map([
    ['ArkUiDriver', 'Driver'],
    ['PointerMatrix', 'PointerMatrix'],
]);

export function RpcApiCall() {
    return (target: FrontEnd, propertyKey: string, descriptor: PropertyDescriptor) => {
        descriptor.value = async function (...args: any) {
            let argsArray: any[] = [];
            for (const arg of args) {
                if (arg instanceof FrontEnd) {
                    argsArray.push(arg.getBackendObjRef());
                } else {
                    argsArray.push(arg);
                }
            }

            let thisFrontEnd = this as FrontEnd;
            if (propertyKey == 'create') {
                let response = await thisFrontEnd.doRpc({
                    api: `${ClassNameMap.get(target.constructor.name)}.${propertyKey}`,
                    this: null,
                    args: argsArray,
                    message_type: 'hypium',
                });
                if (response) {
                    thisFrontEnd.activate(response);
                }
                return;
            }

            if (propertyKey == 'free') {
                let response = await thisFrontEnd.doRpc({
                    api: `BackendObjectsCleaner`,
                    this: null,
                    args: [thisFrontEnd.getBackendObjRef()],
                    message_type: 'hypium',
                });
                if (response) {
                    thisFrontEnd.deactivate();
                }
                return;
            }

            return await thisFrontEnd.doRpc({
                api: `${ClassNameMap.get(target.constructor.name)}.${propertyKey}`,
                this: thisFrontEnd.getBackendObjRef(),
                args: argsArray,
                message_type: 'hypium',
            });
        };
    };
}
