import { WelcomeJourney } from "@/app/welcome/welcome-journey";
import type { ActivationJourney } from "@/lib/activation-journey";
export default function WelcomeCompanionPage({ journey }: { journey: ActivationJourney }) {
  return <WelcomeJourney journey={journey} />;
}
