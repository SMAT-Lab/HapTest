# ArkTest

## Description
ArkTest is an OpenHarmony application UI automated testing framework. It supports a variety of testing strategies and can effectively automate UI testing, thereby improving the stability and quality of applications.

## Installation
```
npm install ohos-arktest
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

## Instructions

### 1. Usage 
```
arktest [options]

Options:
  -V, --version             output the version number
  -i --hap <file>           hap file
  -o --output <dir>         output dir (default: "out")
  --policy <policyName>     policy name (default: "manu")
  -t --target [connectkey]  hdc connectkey
  -h, --help                display help for command
```

### 2.  Using DevEco simulator to run HAP  

1.  download DevEco: https://developer.huawei.com/consumer/cn/deveco-studio/  
2.  Refer to the link to run the emulator: https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-run-emulator-0000001582636200-V5
3.  test HAP photos
```
arktest -i com.huawei.hmos.photos -o out
```

## Contribution

1.  Fork the repository
2.  Create Feat_xxx branch
3.  Commit your code
4.  Create Pull Request

