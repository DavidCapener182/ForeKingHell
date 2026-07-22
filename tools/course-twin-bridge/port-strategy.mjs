export const OFFICIAL_GSPRO_PORT = 921;
export const UNPRIVILEGED_GSPRO_TARGET_PORT = 4921;

export function defaultGsProPort({ platform = process.platform, effectiveUserId } = {}) {
  if (platform === "win32") return OFFICIAL_GSPRO_PORT;
  const euid =
    effectiveUserId ?? (typeof process.geteuid === "function" ? process.geteuid() : undefined);
  return euid === 0 ? OFFICIAL_GSPRO_PORT : UNPRIVILEGED_GSPRO_TARGET_PORT;
}

export function gsProPortStatus(port, { platform = process.platform } = {}) {
  if (port === OFFICIAL_GSPRO_PORT) {
    return { ready: true, requiresForwarder: false, message: "GSPro can connect on port 921." };
  }
  if (platform === "win32") {
    return {
      ready: false,
      requiresForwarder: false,
      message: `GSPro expects port 921; the bridge is listening on ${port}.`,
    };
  }
  return {
    ready: false,
    requiresForwarder: true,
    message: `Install the packaged loopback port helper so GSPro port 921 forwards to ${port}.`,
  };
}
