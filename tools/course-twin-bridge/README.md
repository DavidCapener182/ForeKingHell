# ForeKingHell Course Twin Bridge

The bridge translates the documented GSPro Open Connect v1 TCP feed into a small, authenticated browser WebSocket for Course Twin.

## Local use

1. Run `npm run bridge:start`.
2. Put the launch monitor into its supported GSPro mode.
3. Enter the six-digit code printed by the bridge into Course Twin.
4. Keep the bridge window open for the session.

Run the packaged executable with `--diagnostics` to print a redacted support report. When the bridge is detected, Course Twin also offers **Download connection report** in Live mode. The report includes operating system, ports, connection state and accepted/rejected counters, but never pairing codes, session tokens or raw shot payloads.

The official GSPro listener is `127.0.0.1:921`. Windows and privileged Unix launches bind it directly. An ordinary macOS/Linux process cannot bind a port below 1024, so the bridge safely defaults to `127.0.0.1:4921` there and prints the required setup status. The browser service defaults to `127.0.0.1:9791`. Every service rejects non-loopback binding. Browser origins are exact-matched; add a production origin with `FKH_BRIDGE_ALLOWED_ORIGINS`.

## Security boundary

- A pairing code is one-time and compared in constant time.
- The returned 256-bit session token lasts ten minutes, is stored only as a SHA-256 digest, and is sent as a WebSocket subprotocol rather than in a URL.
- Input is capped at 64 KiB, rate-limited, parsed as a JSON object stream, and validated against realistic GSPro v1 field ranges.
- Only normalised golf measurements are relayed. Unknown input fields, URLs and file paths are discarded.
- Health diagnostics expose connection counts and timestamps, never tokens or raw shot payloads.

## Desktop packaging

Run `npm run bridge:build` on each target operating system. It bundles the service and its WebSocket dependency, injects that bundle into the pinned Node 24 executable, runs an ephemeral-port self-test, and writes a SHA-256 checksum plus `release-manifest.json` under `dist/course-twin-bridge/<platform>-<architecture>/`.

Local builds are clearly labelled `unsigned-local` in that manifest. Set `FKH_BRIDGE_RELEASE_CHANNEL=beta` or `stable` only in protected release CI: public channels fail closed unless `FKH_RELEASE_MANIFEST_PRIVATE_KEY` and the appropriate macOS or Windows code-signing identity are present. The resulting Ed25519 `release-manifest.sig` authenticates the complete artifact list, sizes and SHA-256 digests. Stable macOS releases additionally require `FKH_APPLE_NOTARY_PROFILE`; the build submits the signed executable archive to Apple's notary service before marking the manifest notarised.

The macOS build uses `FKH_MACOS_SIGN_IDENTITY` when supplied; without it the script only attempts ad-hoc signing for local testing. The Windows build uses `FKH_WINDOWS_SIGN_CERT_SHA1` with `signtool` when supplied. Production macOS builds must subsequently be notarised and stapled. Signing certificates and notarisation credentials belong in protected release-CI secrets and are intentionally absent from this repository.

The macOS package also emits `install-macos-port-helper.sh` and `uninstall-macos-port-helper.sh`. The installer copies the same signed executable into the standard privileged-helper location and registers a minimal launch daemon that does only loopback TCP forwarding from port 921 to the unprivileged bridge on port 4921. Run the installer with `sudo`; the normal browser/bridge process remains unprivileged. Linux packages emit `enable-linux-port-921.sh`, which grants only `cap_net_bind_service` to the signed executable via `setcap`. Windows needs no privileged-port helper.

Node's single-executable support is still marked as active development, so releases remain pinned to Node 24.15.0 and run the included executable self-test on every target platform.

Until signed builds are published, run the bridge from this repository. Do not expose port 921 or 9791 through a firewall or router.
