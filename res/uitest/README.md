# Uitest agent 版本选择与兼容

本目录包含 HapTest 随包分发的 HarmonyOS `agent.so`。选择规则参考 Hypium 6.1.0.210 的 companion 包 [xdevice-ohos 6.1.0.210](https://pypi.org/project/xdevice-ohos/6.1.0.210/)，相关选择逻辑位于 `ohos/proxy/proxy_base.py::_init_so_resource`，Unix socket 模式判断位于 `ohos/environment/device.py::check_if_unix_socket_mode`。Hypium wheel 本身不含 agent 二进制；以下文件提取自其依赖包 [xdevice-devicetest 6.1.0.210](https://pypi.org/project/xdevice-devicetest/6.1.0.210/)。

## 选择规则

HapTest 在设备上读取 `/system/bin/uitest --version` 和 `file /system/bin/uitest`，据 uitest 版本和 ELF 架构选择 agent：

| 设备架构 / uitest 版本 | 选择的 agent | 设备 RPC endpoint |
| --- | --- | --- |
| x86_64（不按 uitest 版本区分） | 1.1.9 x86_64 | TCP `8012` |
| ARM64，uitest > 6.0.2.1 | 1.2.2 | Unix abstract socket `uitest_socket` |
| ARM64，uitest >= 5.1.1.3 | 1.1.10 | TCP `8012` |
| ARM64，uitest < 5.1.1.3 | 1.1.3 | TCP `8012` |

版本选择是动态的，并非所有设备共用一个默认 agent。当前已连接的 ARM64、uitest 6.0.2.3 设备会选择 **agent 1.2.2 + Unix socket**。较旧 ARM64 uitest 和 x86_64 设备会按表选择其他版本。原 v1.0.8 文件保留作手动回滚，自动选择器不会选择它。

由于 HapTest 不再打包 xdevice 在 uitest `5.1.1.2` 至 `<5.1.1.3` 区间使用的 v1.1.5，当前此区间回退到 v1.1.3；这属于 HapTest 的资源取舍，与 xdevice-devicetest 6.1.0.210 的选择规则不同。

## 设备已有 agent 时的处理

设备端 agent 路径为 `/data/local/tmp/agent.so`。启动时 HapTest 检查其 `UITEST_AGENT_LIBRARY` 版本标记和 ELF 架构。标记解析兼容旧格式（如 `@v1.1.10`）和新格式（如 `@v0.0.0#1.2.2`）。

出现以下情况会替换设备上的 agent：标记缺失或无法识别、ELF 架构不匹配、agent 主/次版本与所选版本不一致，或已安装版本低于所选版本。同一主/次版本下较新的补丁版本会保留；主/次版本不同则按 xdevice 的匹配方式替换，即使已安装版本号更高也会替换。

替换前，HapTest 会停止匹配 `uitest start-daemon singleness` 的 daemon，再删除旧文件、推送选定的二进制，并重新检查版本标记和 ELF 架构。校验成功后启动 daemon，等待所选 RPC endpoint 可用。若 agent 已兼容且对应 daemon 已运行，则复用现有文件和进程；若所选 endpoint 未运行，则启动 daemon。发现旧 transport 的 daemon 时会停止该 daemon，再按当前所选 transport 启动。未知架构、文件推送失败或安装后校验失败会报错退出。

运行日志会记录选择的 uitest 版本、设备架构、agent 版本和 transport；复用时会打印实际使用的 `agent.so` 版本。发生替换时会记录旧版本及 ELF 信息、目标版本和替换原因；安装时记录源文件与设备路径，安装后记录校验结果。例如：

```text
Uitest 6.0.2.3 (arm64) selected agent 1.2.2 and unix transport; installed agent update required=true.
Replacing device agent.so: current version=1.0.8, current ELF=...ARM aarch64..., selected version=1.2.2/arm64; reason=agent version 1.0.8 does not meet required version 1.2.2.
Installing device agent.so version=1.2.2, architecture=arm64, source=..., destination=/data/local/tmp/agent.so.
Installed and verified uitest agent 1.2.2 (arm64).
Using device agent.so version=1.2.2, architecture=arm64, transport=unix, endpoint=localabstract:uitest_socket.
```

## 测试建议

`npm test` 的 agent catalog 单测覆盖版本选择边界、架构识别、版本标记解析、已有 agent 的替换决策和 daemon 重启决策。单测验证 HapTest 自身的选择与生命周期逻辑，不能证明闭源 agent 的 RPC wire protocol 在不同版本间兼容。

RPC 协议应通过真实设备做端到端测试，覆盖连接与握手、请求/响应帧解析、`Driver.create`、屏幕尺寸、布局抓取、点击/按键/滑动、多次连续请求，以及 daemon 重启后的重连。应按 agent 版本和 transport 建立设备测试矩阵，每次更新 agent 后执行对应组合。当前已在 ARM64、uitest 6.0.2.3 设备验证 v1.2.2/Unix socket 的 RPC 操作和二次启动复用；此前 v1.0.8/TCP 的运行只能作为旧组合基线，不能据此断言所有版本的 RPC 协议完全相同。

## SHA-256

以下摘要用于校验提取的二进制文件：

| 文件 | SHA-256 |
| --- | --- |
| `uitest_agent_v1.1.3.so` | `6a76d6047b367b0e00be627daf212d3baa5b20566131cbe298abe7cdf6639b53` |
| `uitest_agent_v1.1.10.so` | `1c9286456fb003ee15d86fef04e8c93f004027349e6dd2ef972c792e0a6d4bf8` |
| `uitest_agent_v1.2.2.so` | `e1b8e75fad983aa29640784ee4b457fe7ac1c916a15f72c8b899d5a7716da651` |
| `uitest_agent_v1.1.9.x86_64_so` | `24a14a7841ec376dad4e1fa741de8f9f218c652a7e6d0100077798006367b274` |
