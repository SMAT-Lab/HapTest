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

import { ClassConstructor, ClassTransformOptions, instanceToPlain, plainToInstance } from 'class-transformer';

export class SerializeUtils {
    static instanceToPlain<T>(object: T, options?: ClassTransformOptions): Record<string, any> {
        let defaultOptions: ClassTransformOptions = { enableCircularCheck: true, excludeExtraneousValues: true };
        defaultOptions.groups = options?.groups;
        return instanceToPlain(object, defaultOptions);
    }

    static serialize<T>(object: T, options?: ClassTransformOptions, space?: number): string {
        return JSON.stringify(SerializeUtils.instanceToPlain(object, options), null, space);
    }

    static plainToInstance<T, V>(cls: ClassConstructor<T>, plain: V, options?: ClassTransformOptions): T {
        let defaultOptions: ClassTransformOptions = { enableCircularCheck: true, excludeExtraneousValues: true };
        defaultOptions.groups = options?.groups;

        return plainToInstance(cls, plain, options);
    } 

    // 新增反序列化方法
    static deserialize<T, V>(cls: ClassConstructor<T>, plain: V, options?: ClassTransformOptions): T {
        let defaultOptions: ClassTransformOptions = { enableCircularCheck: true, excludeExtraneousValues: true };
        defaultOptions.groups = options?.groups;
    
        // 反序列化为类实例
        const instance = plainToInstance(cls, plain, defaultOptions);
    
        // 如果实例有 bounds 字段，且是字符串，则转换为 Point[] 数组
        if (typeof instance === 'object' && instance !== null && 'bounds' in instance && typeof (instance as any).bounds === 'string') {
            const boundsString = (instance as any).bounds;
            const regex = /\[(\d+),(\d+)\]/g;
            const points: { x: number; y: number }[] = [];
            let match;
            while ((match = regex.exec(boundsString)) !== null) {
                points.push({ x: parseInt(match[1], 10), y: parseInt(match[2], 10) });
            }
            (instance as any).bounds = points; // 转换后的 Point[] 数组
        }
    
        return instance;
    }
}
