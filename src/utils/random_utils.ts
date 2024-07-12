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

export class RandomUtils {
    /**
     * Generate random integer.
     * @param min
     * @param max
     * @returns
     */
    static genRandomNum(min: number, max: number): number {
        let range = max - min;
        let rand = Math.random();
        return min + Math.round(rand * range);
    }

    static shuffle<T>(a: Array<T>): Array<T> {
        a.sort(() => Math.random() - 0.5);
        return a;
    }

    /**
     * Generate random string
     * @param len string length
     * @returns 
     */
    static genRandomString(len: number): string {
        const chars = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890';
        const randomArray = Array.from({ length: len }, (v, k) => chars[Math.floor(Math.random() * chars.length)]);
        return randomArray.join('');
    }
}
