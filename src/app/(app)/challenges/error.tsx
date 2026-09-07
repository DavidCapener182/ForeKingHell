"use client";
import { Button } from "@/components/ui/button";
export default function ChallengesError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section role="alert" className="grid gap-3 p-6 pb-40">
      <h1 className="text-2xl font-semibold">Challenges could not be loaded</h1>
      <p>Your saved challenges are unchanged. Retry to load the latest results.</p>
      <Button className="min-h-11 justify-self-start" onClick={retry}>
        Retry challenges
      </Button>
    </section>
  );
}
