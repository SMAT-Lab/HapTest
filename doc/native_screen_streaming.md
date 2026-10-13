# Native screen streaming

HapTest can receive screen frames pushed by the device's uitest agent. The agent exposes the `Captures` RPC in `com.ohos.devicetest.hypiumApiHelper`:

- Start with `startCaptureScreen` and `{ options: { scale: 0.5 } }`.
- Stop with `stopCaptureScreen` and `{}`.

The start request's message ID identifies the capture session. JPEG frames arrive asynchronously under that ID when the screen changes; the agent does not promise a fixed frame rate during an idle screen.

## Wire format

Capture control and Hypium control requests share one agent RPC socket, which uses framed binary messages:

```text
_uitestkit_rpc_message_head_
4-byte big-endian message ID
4-byte big-endian payload length
payload
_uitestkit_rpc_message_tail_
```

Control request and response payloads contain JSON. A pushed frame's payload is JPEG data. The response to `startCaptureScreen` and its asynchronous JPEG frames share the same message ID. Hypium requests use this framing too, so control and stream traffic are multiplexed on the same socket and HDC forward.

## HapTest implementation

- `HypiumRpc` owns the local HDC forward and RPC socket.
- `ScreenCaptureStream` ensures the shared RPC socket is connected, sends capture control requests, and parses asynchronous frames. It owns one capture session but does not close the shared RPC connection.
- The screen viewer owns its capture session and stops it before closing the agent RPC. An MCP adapter can use the same stream API with its device session and deliver frames through MCP; each adapter should stop its session before disconnecting the agent.
- Each adapter currently starts its own capture session. If multiple consumers need to share one running stream, add a shared stream owner only after confirming the agent's concurrent capture behavior.

The installed agent is selected by HapTest's existing uitest version, device architecture, and socket transport rules. If an agent does not support the capture RPC, the viewer reports an error and waits for a manual reconnect; it does not retry in a loop or fall back to screenshot polling.

Protocol references: [hdckit's capture API](https://github.com/growvv/hdckit/blob/master/src/hdc/UiDriver.ts#L1050-L1095) and [framing and dispatch](https://github.com/growvv/hdckit/blob/master/src/hdc/UiDriver.ts#L1336-L1560).
