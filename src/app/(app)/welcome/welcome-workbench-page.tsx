import { WelcomeJourney } from "@/app/welcome/welcome-journey";
import type { ActivationJourney } from "@/lib/activation-journey";
export default function WelcomeWorkbenchPage({ journey }: { journey: ActivationJourney }) {
  return <WelcomeJourney journey={journey} />;
}
