/** A network-only, anonymous probe. A captive-portal HTML response is not a connection. */
export async function checkAppConnection(fetcher: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(`/assets/connection.txt?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
    return response.ok && (await response.text()).trim() === "forekinghell-connection-v1";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** A response cannot navigate after the golfer has chosen a different saved activity. */
export function createOfflineConnectionCheck(check = checkAppConnection) {
  let generation = 0;
  return {
    cancel() {
      generation += 1;
    },
    async check(): Promise<boolean | null> {
      const attempt = ++generation;
      const connected = await check();
      return attempt === generation ? connected : null;
    },
  };
}
