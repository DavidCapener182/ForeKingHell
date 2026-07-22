import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { chmod } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "../..");
const platformName = `${process.platform}-${process.arch}`;
const outputDirectory = resolve(root, "dist/course-twin-bridge", platformName);
const bundlePath = resolve(outputDirectory, "bridge.cjs");
const blobPath = resolve(outputDirectory, "bridge.blob");
const configPath = resolve(outputDirectory, "sea-config.json");
const executableName =
  process.platform === "win32"
    ? "forekinghell-course-twin-bridge.exe"
    : "forekinghell-course-twin-bridge";
const executablePath = resolve(outputDirectory, executableName);

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

await build({
  entryPoints: [resolve(import.meta.dirname, "cli.mjs")],
  outfile: bundlePath,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  minify: true,
  sourcemap: false,
  legalComments: "none",
});

writeFileSync(
  configPath,
  JSON.stringify(
    {
      main: bundlePath,
      output: blobPath,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
    },
    null,
    2,
  ),
);
run(process.execPath, ["--experimental-sea-config", configPath]);
copyFileSync(process.execPath, executablePath);
if (process.platform !== "win32") await chmod(executablePath, 0o755);

if (process.platform === "darwin") {
  const thinPath = `${executablePath}.thin`;
  run("lipo", [
    executablePath,
    "-thin",
    process.arch === "x64" ? "x86_64" : process.arch,
    "-output",
    thinPath,
  ]);
  renameSync(thinPath, executablePath);
  await chmod(executablePath, 0o755);
  run("codesign", ["--remove-signature", executablePath], { allowFailure: true });
}

const postject = resolve(
  root,
  "node_modules/.bin",
  process.platform === "win32" ? "postject.cmd" : "postject",
);
const postjectArguments = [
  executablePath,
  "NODE_SEA_BLOB",
  blobPath,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
];
if (process.platform === "darwin") postjectArguments.push("--macho-segment-name", "NODE_SEA");
run(postject, postjectArguments, { shell: process.platform === "win32" });

if (process.platform === "darwin") {
  const identity = process.env.FKH_MACOS_SIGN_IDENTITY || "-";
  const signingArguments = ["--force", "--sign", identity];
  if (identity !== "-") signingArguments.push("--options", "runtime", "--timestamp");
  signingArguments.push(executablePath);
  run("codesign", signingArguments);
} else if (process.platform === "win32" && process.env.FKH_WINDOWS_SIGN_CERT_SHA1) {
  run("signtool", [
    "sign",
    "/sha1",
    process.env.FKH_WINDOWS_SIGN_CERT_SHA1,
    "/fd",
    "SHA256",
    "/tr",
    "http://timestamp.digicert.com",
    "/td",
    "SHA256",
    executablePath,
  ]);
}

run(executablePath, ["--self-test"]);
const checksum = createHash("sha256").update(readFileSync(executablePath)).digest("hex");
writeFileSync(`${executablePath}.sha256`, `${checksum}  ${basename(executablePath)}\n`);
writePortSetupArtifacts();
process.stdout.write(`Built ${executablePath}\nSHA-256 ${checksum}\n`);

function writePortSetupArtifacts() {
  if (process.platform === "darwin") {
    const label = "com.forekinghell.course-twin-port-forwarder";
    const helperPath = `/Library/PrivilegedHelperTools/${label}`;
    const plistPath = `/Library/LaunchDaemons/${label}.plist`;
    const installerPath = resolve(outputDirectory, "install-macos-port-helper.sh");
    const uninstallerPath = resolve(outputDirectory, "uninstall-macos-port-helper.sh");
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${helperPath}</string><string>--port-forwarder</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ProcessType</key><string>Interactive</string>
<key>StandardOutPath</key><string>/var/log/forekinghell-course-twin-port.log</string>
<key>StandardErrorPath</key><string>/var/log/forekinghell-course-twin-port.log</string>
</dict></plist>`;
    writeFileSync(
      installerPath,
      `#!/bin/sh
set -eu
if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo: sudo $0" >&2; exit 1; fi
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -o root -g wheel -m 755 "$SCRIPT_DIR/${executableName}" "${helperPath}"
cat > "${plistPath}" <<'FKH_PLIST'
${plist}
FKH_PLIST
chown root:wheel "${plistPath}"
chmod 644 "${plistPath}"
launchctl bootout system/${label} >/dev/null 2>&1 || true
launchctl bootstrap system "${plistPath}"
echo "ForeKingHell GSPro port helper installed: 127.0.0.1:921 -> 127.0.0.1:4921"
`,
    );
    writeFileSync(
      uninstallerPath,
      `#!/bin/sh
set -eu
if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo: sudo $0" >&2; exit 1; fi
launchctl bootout system/${label} >/dev/null 2>&1 || true
rm -f "${plistPath}" "${helperPath}"
echo "ForeKingHell GSPro port helper removed."
`,
    );
    chmodSync(installerPath, 0o755);
    chmodSync(uninstallerPath, 0o755);
  }
  if (process.platform === "linux") {
    const installerPath = resolve(outputDirectory, "enable-linux-port-921.sh");
    writeFileSync(
      installerPath,
      `#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v setcap >/dev/null 2>&1; then echo "Install libcap2-bin first." >&2; exit 1; fi
setcap cap_net_bind_service=+ep "$SCRIPT_DIR/${executableName}"
echo "ForeKingHell bridge can now bind loopback port 921 without running as root."
`,
    );
    chmodSync(installerPath, 0o755);
  }
}

function run(command, args, { allowFailure = false, shell = false } = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "pipe", shell });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `${basename(command)} failed with exit code ${result.status ?? "unknown"}${result.error ? `: ${result.error.message}` : ""}.`,
    );
  }
}
