# Live screen

`haptest screen` streams the HarmonyOS device display to a browser using native frames pushed by the uitest agent. It is read-only and does not send input events.

```sh
npm run build
node bin/haptest screen --target <hdc-serial> --port 7790
```

When exactly one device is connected, `--target` can be omitted. The server binds to `127.0.0.1`, so only applications on the same machine can access the screen and status endpoints. Open `http://localhost:7790` in a browser. The page shows the active target and the size and time of the latest frame. If the stream errors, use **Reconnect stream** to retry once; the server does not retry unsupported capture RPCs in a loop. Press Ctrl+C to stop the viewer and release the agent stream and HDC forward.

The viewer uses the agent selected for the device's uitest version, architecture, and socket mode. See [native screen streaming](native_screen_streaming.md) for the RPC and frame format.
