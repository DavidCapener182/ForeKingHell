import "server-only";

import { userAgentFromString } from "next/server";
import { cookies, headers } from "next/headers";

import { APP_SURFACE_COOKIE, resolveAppSurface, type AppSurface } from "@/lib/app-surface";

export async function getRequestAppSurface(): Promise<AppSurface> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const userAgent = userAgentFromString(headerStore.get("user-agent") ?? undefined);

  return resolveAppSurface({
    storedPreference: cookieStore.get(APP_SURFACE_COOKIE)?.value,
    deviceType: userAgent.device.type,
  });
}
