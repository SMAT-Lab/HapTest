# Uitest agents

The versioned agents below were extracted from the `xdevice-devicetest` 6.1.0.210 wheel, a dependency used by Hypium 6.1.0.210. Hypium's wheel itself does not contain the native agent binaries. The selection and validation rules follow `xdevice-ohos` 6.1.0.210, the companion package that implements the Hypium device proxy.

Selection follows `ohos/proxy/proxy_base.py::_init_so_resource` and `ohos/environment/device.py::check_if_unix_socket_mode` from `xdevice-ohos` 6.1.0.210:

| Device / uitest condition | Agent | HDC endpoint |
| --- | --- | --- |
| x86_64 | 1.1.9 x86_64 | `tcp:8012` |
| ARM64, uitest > 6.0.2.1 | 1.2.2 | `localabstract:uitest_socket` |
| ARM64, uitest >= 5.1.1.3 | 1.1.10 | `tcp:8012` |
| ARM64, uitest >= 5.1.1.2 | 1.1.5 | `tcp:8012` |
| ARM64, older uitest | 1.1.3 | `tcp:8012` |

At startup HapTest reads the device agent marker and ELF architecture. It replaces an agent with an older or incompatible version, restarts a running `uitest` daemon when the agent or transport changes, then verifies the deployed marker and architecture before opening the RPC connection.

The original v1.0.8 binaries remain in this directory for manual rollback; the automatic selector does not choose them.

## SHA-256

Extracted binaries are pinned by digest for provenance:

| File | SHA-256 |
| --- | --- |
| `uitest_agent_v1.1.3.so` | `6a76d6047b367b0e00be627daf212d3baa5b20566131cbe298abe7cdf6639b53` |
| `uitest_agent_v1.1.5.so` | `fc2322feb8145ddda244f2b97046f448d040d886e6f81e546842ee45fa028781` |
| `uitest_agent_v1.1.10.so` | `1c9286456fb003ee15d86fef04e8c93f004027349e6dd2ef972c792e0a6d4bf8` |
| `uitest_agent_v1.2.2.so` | `e1b8e75fad983aa29640784ee4b457fe7ac1c916a15f72c8b899d5a7716da651` |
| `uitest_agent_v1.1.9.x86_64_so` | `24a14a7841ec376dad4e1fa741de8f9f218c652a7e6d0100077798006367b274` |
