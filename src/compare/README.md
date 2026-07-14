# Dynamic Compare 使用说明

本目录提供 `haptest compare` 动态日志对比能力，主要用于对比 `mobile` 与 `2in1` 两端执行同一应用后的 UI 一致性问题。

当前可检测 4 类问题：

- full-width：检测同一组件是否都为横向铺满
- ratio：检测同一组件宽高比是否明显变化
- scene：检测同一事件前后业务场景是否发生偏移
- diff：对已匹配到的同一组件逐字段比对，任何字段差异都会上报

并支持可选 AI 组件匹配：开启后组件匹配阶段仅使用 AI 判定，不再执行 `type + key/id` 精确匹配。

---

## 1. 快速开始

```bash
haptest compare -a <appFolder>
```

最小示例：

```bash
haptest compare -a com.demo.app
```

指定数据根目录与输出文件：

```bash
haptest compare -a com.demo.app \
  --dataRoot out \
  --output out/reports/compare_all_com.demo.app.json
```

只跑某一个检测器：

```bash
haptest compare -a com.demo.app --detector ratio
```

启用 AI 组件匹配：

```bash
haptest compare -a com.demo.app \
  --aiComponentMatch \
  --aiComponentModel openrouter/free \
  --aiComponentThreshold 0.6 \
  --aiComponentMaxCalls 200 \
  --aiComponentConfig config.json
```

---

## 2. 输入目录约定

默认从以下结构读取数据（可通过参数覆盖目录名）：

```text
<dataRoot>/
  mobile/
    <appFolder>/
      <runDir>/
        events/
        temp/
  2in1/
    <appFolder>/
      <runDir>/
        events/
        temp/
```

- `events/`：事件与页面快照 JSON
- `temp/`：截图文件（png/jpg/jpeg）

如果 `<appFolder>` 下有多个 `runDir`，会按目录名排序后选择最新一个。

---

## 3. 按可检测功能分章

### 3.1 all（一次跑完全部检测）

用途：一次执行 `full-width + ratio + scene + diff` 四类检测。

运行方式：

```bash
haptest compare -a com.demo.app --detector all
```

说明：

- `--detector <name>` 默认值为 `all`。
- 建议先跑 `all` 获取全量问题，再按单个 detector 精确定位。

---

### 3.2 diff（组件字段差异全量检测）

用途：针对已匹配的同一组件，按字段逐项比较并上报所有差异。

运行方式：

```bash
haptest compare -a com.demo.app --detector diff
```

说明：

- 该检测器不设置容差，属于“有差异即报”。
- 报告会给出每个字段在 `mobile` 与 `2in1` 两端的值。
- 报告中的 `diffs` 字段会直接按三组输出：结构差异（`structuralDiffs`）、状态差异（`statusDiffs`）、文本差异（`textDiffs`）。
- 当前会比较：`type/id/key/name/text/hint`、交互状态字段（如 `clickable`、`enabled`、`visible` 等）、`bounds` 与 `origBounds`。

---

### 3.3 full-width（横向铺满一致性）

用途：检测同一组件在两端是否都表现为“横向铺满容器”。

运行方式：

```bash
haptest compare -a com.demo.app --detector full-width
```

相关数值参数：

- `--tolerance <number>`（默认 `1`）
  - 含义：像素容差，允许两端在“是否铺满”判定时有小范围误差。
  - 可以理解为：当组件宽度与容器宽度的差值在该阈值内时，仍可视为铺满。
  - 调参建议：
    - 值更小（如 `0`）：更严格，容易报出更多问题。
    - 值更大（如 `2`、`3`）：更宽松，可减少因取整/缩放导致的误报。

---

### 3.4 ratio（宽高比一致性）

用途：检测同一组件在两端是否出现明显形变（宽高比变化）。

运行方式：

```bash
haptest compare -a com.demo.app --detector ratio
```

相关数值参数：

- `--ratioTolerance <number>`（默认 `0.01`）
  - 含义：宽高比差异容差。
  - 判定思路可理解为：比较两端组件的宽高比差值，若超过该阈值则记为问题。
  - 例如：`0.01` 约等于允许 $1\%$ 的比例偏差量级（用于过滤轻微浮动）。
  - 调参建议：
    - 值更小（如 `0.005`）：更敏感，更容易发现细微变形。
    - 值更大（如 `0.02`）：更宽松，减少轻微差异告警。

---

### 3.5 scene（场景偏移检测）

用途：检测同一事件前后，两端是否进入了不同业务场景。

运行方式：

```bash
haptest compare -a com.demo.app --detector scene
```

相关数值参数：

- `--sceneSimilarityThreshold <number>`（默认 `0.35`）
  - 含义：场景相似度阈值。
  - 相似度通常在 `[0, 1]` 区间，值越大表示越相似。
  - 判定逻辑可理解为：相似度低于该阈值时，认为发生场景偏移。
  - 调参建议：
    - 值更高（如 `0.5`）：更严格，更容易判定为场景偏移。
    - 值更低（如 `0.25`）：更宽松，只关注明显偏移。

---

## 4. 通用参数与数值参数说明

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `-a, --app <dir>` | string | 无（必填） | 设备目录下的应用日志目录名 |
| `-o, --output <path>` | string | 自动生成 | 报告输出文件或目录 |
| `--dataRoot <dir>` | string | `out` | 动态日志根目录 |
| `--mobile <dir>` | string | `mobile` | 手机侧目录名 |
| `--twoInOne <dir>` | string | `2in1` | 2in1 侧目录名 |
| `--tolerance <number>` | number | `1` | full-width 检测像素容差 |
| `--ratioTolerance <number>` | number | `0.01` | ratio 检测宽高比容差 |
| `--sceneSimilarityThreshold <number>` | number | `0.35` | scene 检测场景相似度阈值 |
| `--detector <name>` | enum | `all` | 运行检测器：`all \| full-width \| ratio \| scene \| diff` |
| `--aiComponentMatch` | boolean | `false` | 开启 AI 组件匹配（不再做精确匹配） |
| `--aiComponentModel <name>` | string | `openrouter/free` | AI 匹配模型名 |
| `--aiComponentThreshold <number>` | number | `0.6` | AI 判定为同一组件的最小置信度 |
| `--aiComponentMaxCalls <number>` | number | `200` | 单次 compare 最大 AI 调用次数 |
| `--aiComponentConfig <path>` | string | `config.json` | 包含 `GPT_CONFIG` 的配置文件路径 |
| `--debug` | boolean | `false` | 使用 debug 日志级别 |

### 4.1 需要填写数值的参数（速查）

- `--tolerance`
  - 单位：像素。
  - 含义：full-width 判定时允许的宽度误差。
- `--ratioTolerance`
  - 单位：比例差（无单位）。
  - 含义：ratio 判定时允许的宽高比差值。
- `--sceneSimilarityThreshold`
  - 单位：相似度分数（通常 `0~1`）。
  - 含义：scene 判定为“同场景”的最低相似度门槛。
- `--aiComponentThreshold`
  - 单位：置信度分数（通常 `0~1`）。
  - 含义：AI 认为两组件可匹配的最小置信度。
  - 取值越高，匹配越保守；取值越低，匹配越激进。
- `--aiComponentMaxCalls`
  - 单位：次数。
  - 含义：一次 compare 过程中允许的最大 AI 调用次数上限。
  - 值越大，覆盖更多候选匹配，但耗时/成本也可能增加。

### output 参数行为

- 未指定 `--output`：自动写入 `dataRoot/compare_<detector>_<app>_mobile_2in1.json`
- 指定为目录：自动在目录下生成上述文件名
- 指定为 `.json` 文件：直接写入该文件

---

## 5. AI 匹配配置

当启用 `--aiComponentMatch` 时，会读取配置文件中的 `GPT_CONFIG`：

```json
{
  "GPT_CONFIG": {
    "baseURL": "https://openrouter.ai/api/v1",
    "apiKey": "",
    "siteURL": "https://github.com/SMAT-Lab/HapTest",
    "appName": "HapTest"
  }
}
```

注意：

- `apiKey` 为空时会跳过 AI 调用；由于已开启仅 AI 匹配，组件匹配结果会显著减少
- 开启 `--aiComponentMatch` 后，组件匹配阶段仅由 AI 决定
- OpenRouter 下会自动附带 `HTTP-Referer` 与 `X-Title` 请求头，并在连接错误时自动重试
- 若 `openrouter/free` 连接不稳定，会自动回退尝试其他免费路由模型

### 5.1 OpenRouter `Connection error` 排查

若日志出现 `LLM call failed: Error: Connection error`，建议确认：

- `GPT_CONFIG.baseURL` 是否为 `https://openrouter.ai/api/v1`
- 网络是否可访问 OpenRouter（公司网络/代理可能拦截）
- `apiKey` 是否有效且账户可用

可先用最简命令验证：

```bash
haptest compare -a com.demo.app --aiComponentMatch --aiComponentModel openrouter/free --aiComponentConfig config.json
```

---

## 6. 输出报告结构

核心字段如下：

- `issues`：full-width 问题列表
- `aspectRatioIssues`：ratio 问题列表
- `sceneIssues`：scene 问题列表
- `componentDiffIssues`：diff 问题列表（字段级差异）
- `pageCount`：页面对比数量
- `transitionCount`：转移对比数量
- `mobilePages` / `twoInOnePages`：两端页面总数
- `mobileTransitions` / `twoInOneTransitions`：两端转移总数
- `mobileScreenshots` / `twoInOneScreenshots`：两端截图数量

建议先使用 `--detector all` 观察全量结果，再按问题类型缩小到单个 detector 做定位。
