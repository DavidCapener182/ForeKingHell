import { rapsodoProvider } from "@/lib/imports/providers/rapsodo";
import { squareProvider } from "@/lib/imports/providers/square";
import { trackmanProvider } from "@/lib/imports/providers/trackman";
import type { LaunchMonitorProvider, ProviderInput } from "@/lib/imports/providers/types";

export const launchMonitorProviders = [
  rapsodoProvider,
  squareProvider,
  trackmanProvider,
] satisfies LaunchMonitorProvider[];

export async function detectLaunchMonitorProvider(input: ProviderInput) {
  for (const provider of launchMonitorProviders) {
    if (await provider.detect(input)) {
      return provider;
    }
  }

  return null;
}

export type {
  LaunchMonitorProvider,
  LaunchMonitorProviderKind,
  NormalizedSession,
  NormalizedShot,
} from "@/lib/imports/providers/types";
