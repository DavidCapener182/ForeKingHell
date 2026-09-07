"use client";
import { useRouter } from "next/navigation";
import { ComparisonSearchSheet } from "@/app/analyse/compare/comparison-search-sheet";
export function SessionImpactPicker({
  selectedId,
  options,
}: {
  selectedId: string;
  options: Array<{ id: string; label: string; date: string }>;
}) {
  const router = useRouter();
  return (
    <div className="grid gap-2">
      <ComparisonSearchSheet
        label="Session to inspect"
        value={selectedId}
        options={options.map((row) => ({ value: row.id, label: row.label, description: row.date }))}
        onValueChange={(value) => router.push(`/analyse/session-impact?sessionId=${value}`)}
      />
      <p className="text-xs text-muted-foreground">
        Search the latest {options.length} owned sessions (up to100). Use session history for older
        records.
      </p>
    </div>
  );
}
