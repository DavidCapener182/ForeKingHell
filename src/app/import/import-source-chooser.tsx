"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Cloud, FileUp, FlaskConical, PenLine } from "lucide-react";
import { UntitledRadioCards } from "@/components/untitled-ui/radio-cards";
import { Button } from "@/components/ui/button";

export function ImportSourceChooser({
  connected,
  initialSource = "csv",
  companion = false,
}: {
  connected: boolean;
  initialSource?: string;
  companion?: boolean;
}) {
  const [source, setSource] = useState(initialSource);
  const query = useSearchParams();
  const next = new URLSearchParams(query.toString());
  next.set("source", source);
  const href =
    source === "rapsodo"
      ? `/rapsodo${query.get("practicePlanId") ? `?practicePlanId=${encodeURIComponent(query.get("practicePlanId")!)}` : ""}`
      : source === "csv" && !companion && initialSource !== "sample"
        ? "#csv-import"
        : `/import?${next.toString()}#csv-import`;
  return (
    <section className="grid min-w-0 gap-3" data-import-source-card>
      <UntitledRadioCards
        label="Choose your source"
        value={source}
        onValueChange={setSource}
        options={[
          {
            value: "rapsodo",
            title: "Rapsodo R-Cloud",
            badge: connected ? "Connected" : "Connect",
            description: connected
              ? "Check R-Cloud for measured sessions to import."
              : "Connect R-Cloud and choose a measured session.",
            icon: <Cloud size={18} />,
          },
          {
            value: "csv",
            title: "Upload CSV",
            badge: "Measured data",
            description: "Choose files, confirm units and review shots before saving.",
            icon: <FileUp size={18} />,
          },
          {
            value: "sample",
            title: "Try sample data",
            badge: "Preview only",
            description: "Explore five clearly labelled demo shots. Nothing is saved.",
            icon: <FlaskConical size={18} />,
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild className="min-h-11">
          <Link href={href} prefetch={false}>
            {source === "rapsodo"
              ? "Continue to R-Cloud"
              : source === "sample"
                ? "Preview sample"
                : "Choose CSV files"}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/rounds/new">
            <PenLine size={16} aria-hidden />
            Add manual round
          </Link>
        </Button>
      </div>
    </section>
  );
}
