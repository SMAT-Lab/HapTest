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

const Glob2Regex: Map<string, string> = new Map([
    ['*', '[^/]*'],
    ['?', '[^/]'],
    ['**', '(/.+?)?'],
  ]);
    
  export class GlobMatch {
    rulesReg: RegExp;

    constructor(rules: string[]) {
      this.rulesReg = new RegExp(rules.map(this.transform).join('|'), 'i');
    }
  
    match(filePath: string): boolean {
      return this.rulesReg.test(filePath);
    }
  
    private transform(glob: string): string {
      let regPattern = '';
      let segments = glob.split('/');
      let last = segments[segments.length - 1];
  
      // no extension add /**/* to end
      if (!/[.*?]/.test(last)) {
        segments.push('**', '*');
      }
  
      let hasWrittenSeg = false;
      for (let seg of segments) {
        if (seg == '**') {
          regPattern += Glob2Regex.get('**');
        } else {
          if (hasWrittenSeg) {
            regPattern += '/';
          }
          regPattern += seg.replace(/[^\w\s\/]/g, (match: string):string => {
            return match === '*' ? Glob2Regex.get('*')! : match === '?' ? Glob2Regex.get('?')! : '\\' + match;
          });
        }
        hasWrittenSeg = true;
      }
  
      return `^${regPattern}$`;
    }
  }
  