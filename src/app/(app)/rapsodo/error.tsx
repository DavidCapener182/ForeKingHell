"use client";
import { EvidenceRouteError } from "@/app/import/evidence-route-error";
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <EvidenceRouteError error={error} retry={retry} context="rapsodo" />;
}
