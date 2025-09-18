# HapTest

## Description
HapTest is an OpenHarmony application UI automated testing framework. It supports a variety of testing strategies and can effectively automate UI testing, thereby improving the stability and quality of applications.

## Installation
```
npm install haptest
```

## Build
Install dependencies
```
npm i
```
Build & Pack
```
npm run build
npm pack
```

## Static Analysis Setup
If you want to use the static analysis module (```--policy static_guided```), you need to install its dependencies first:
```
cd static/test-demo
npm install
```

## Instructions

### 1. Usage 
```
haptest [options]

Options:
  -V, --version                              output the version number
  -i, --hap <file/bundleName/sourceRoot>     HAP bundle name or HAP file path or HAP project source root
  -o, --output <dir>                         output dir (default: "out")
  --policy <policyName>                      policy name (default: "manu")
  -t, --target [connectkey]                  hdc connectkey
  -c, --coverage                             enable coverage (default: false)
  --llm                                      enable LLM-guided exploration (default: false)
  --simk <number>                            set similarity threshold K for tarpit detection (default: 3)
  --staticConfig <file>                      path to static analysis configuration file (required when policy=static_guided)
  -h, --help                                 display help for command

```

#### Note:
- ```--policy static_guided:``` Enable the static-analysis-guided exploration policy (requires ```--staticConfig``` to specify the static module configuration file).
-``` --llm:``` Enable the LLM-based enhanced exploration module; can be combined with static_guided policy for a hybrid strategy.
- ```--simk:``` Set the UI similarity threshold for tarpit detection.

### 2. Using DevEco simulator to run HAP  

1.  download DevEco: https://developer.huawei.com/consumer/cn/deveco-studio/  
2.  Refer to the link to run the emulator: https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-run-emulator-0000001582636200-V5
3.  test HAP photos
```
haptest -i com.huawei.hmos.photos -o out
```

### 3. Build & Test your Hap Build Hap & Instrument coverage
1. download Command Line Tools: https://developer.huawei.com/consumer/cn/download/
2. add ${command-line-tools}/bin to PATH
3. using haptest cmd to build instrument and test your Hap. 
```
haptest -i {Hap project root } --policy greedy_dfs -o out
```

### 4. Run Hap & dump mem
```
haptest --policy perf_start_hap -i ALL --exclude com.huawei.* com.ohos.* -o out
```

### 5. Run with static analysis and LLM enabled
```
haptest -i com.example.demo --policy static_guided --staticConfig config.json --llm --simk 3 -o out
```

## Contribution

1.  Fork the repository
2.  Create Feat_xxx branch
3.  Commit your code
4.  Create Pull Request

