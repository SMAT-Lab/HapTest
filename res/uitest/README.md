# Uitest agent

HapTest selects and installs the device-side `agent.so` using the uitest version and ELF architecture. The selection rules follow [xdevice-ohos 6.1.0.210](https://pypi.org/project/xdevice-ohos/6.1.0.210/); binaries come from its companion package [xdevice-devicetest 6.1.0.210](https://pypi.org/project/xdevice-devicetest/6.1.0.210/).

| Device profile | Agent | RPC endpoint |
| --- | --- | --- |
| x86_64 | 1.1.9 | TCP `8012` |
| ARM64, uitest > 6.0.2.1 | 1.2.2 | Unix socket `uitest_socket` |
| ARM64, uitest >= 5.1.1.3 | 1.1.10 | TCP `8012` |
| ARM64, older uitest | 1.1.3 | TCP `8012` |

At startup, HapTest checks `/data/local/tmp/agent.so` for its version marker and ELF architecture. It replaces missing or incompatible files, verifies the installation, and restarts the uitest daemon when the agent or transport changes. The original v1.0.8 binaries remain available for manual rollback.

Logs report the selected profile, installed version, replacement reason, installation result, and RPC endpoint. Unit tests cover selection and compatibility checks; RPC compatibility across agent versions requires device E2E testing. The connected ARM64 device has been tested with uitest 6.0.2.3, agent 1.2.2, and Unix socket transport.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `uitest_agent_v1.1.3.so` | `6a76d6047b367b0e00be627daf212d3baa5b20566131cbe298abe7cdf6639b53` |
| `uitest_agent_v1.1.10.so` | `1c9286456fb003ee15d86fef04e8c93f004027349e6dd2ef972c792e0a6d4bf8` |
| `uitest_agent_v1.2.2.so` | `e1b8e75fad983aa29640784ee4b457fe7ac1c916a15f72c8b899d5a7716da651` |
| `uitest_agent_v1.1.9.x86_64_so` | `24a14a7841ec376dad4e1fa741de8f9f218c652a7e6d0100077798006367b274` |
