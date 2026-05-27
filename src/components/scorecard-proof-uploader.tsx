"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ImageIcon, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ExtractState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ScorecardExtractResponse = {
  scorecard?: {
    courseName?: string | null;
    dateIso?: string | null;
    teeName?: string | null;
    totalScore?: number | null;
  };
  proofToken?: string;
  message?: string;
};

export function ScorecardProofUploader({
  screenshotFieldName,
  extractedTotalFieldName,
  screenshotLabel = "Scorecard screenshot reference",
  extractedTotalLabel = "Extracted score total",
}: {
  screenshotFieldName: string;
  extractedTotalFieldName: string;
  screenshotLabel?: string;
  extractedTotalLabel?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [screenshotPath, setScreenshotPath] = useState("");
  const [extractedTotal, setExtractedTotal] = useState("");
  const [proofToken, setProofToken] = useState("");
  const [state, setState] = useState<ExtractState>({
    status: "idle",
    message: "Upload a scorecard image, then confirm the extracted total before submitting.",
  });

  async function extractScorecard(file: File | null | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setState({ status: "error", message: "Choose an image file for the scorecard." });
      return;
    }

    setScreenshotPath(`scorecard-upload:${file.name}`);
    setState({ status: "loading", message: `Reading ${file.name}…` });

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/scorecard/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const payload = (await response.json()) as ScorecardExtractResponse;

      if (!response.ok || !payload.scorecard) {
        throw new Error(payload.message ?? "Scorecard extraction failed.");
      }

      if (typeof payload.scorecard.totalScore === "number") {
        setExtractedTotal(String(payload.scorecard.totalScore));
      }
      setProofToken(payload.proofToken ?? "");

      setState({
        status: "success",
        message: proofSummary(file.name, payload.scorecard),
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `${error.message} You can still confirm the total manually.`
            : "Scorecard extraction failed. You can still confirm the total manually.",
      });
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-[#F5F6F4] p-3">
      <input type="hidden" name="scorecardProofToken" value={proofToken} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void extractScorecard(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-emerald-600" />
            Proof check
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Upload a scorecard screenshot for OCR, then confirm the total against the imported
            provider round.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={state.status === "loading"}
          onClick={() => fileInputRef.current?.click()}
        >
          {state.status === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageIcon className="size-4" />
          )}
          {state.status === "loading" ? "Reading…" : "Upload"}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          {screenshotLabel}
          <Input
            name={screenshotFieldName}
            value={screenshotPath}
            placeholder="/uploads/scorecards/round.png"
            className="h-10 rounded-xl bg-white"
            readOnly
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {extractedTotalLabel}
          <Input
            name={extractedTotalFieldName}
            value={extractedTotal}
            onChange={(event) => setExtractedTotal(event.target.value)}
            inputMode="numeric"
            className="h-10 rounded-xl bg-white"
          />
        </label>
      </div>
      <p
        className={
          state.status === "error"
            ? "flex items-start gap-2 text-xs leading-5 text-destructive"
            : "text-xs leading-5 text-muted-foreground"
        }
        aria-live="polite"
      >
        {state.status === "error" ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> : null}
        <span>{state.message}</span>
      </p>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read the scorecard image."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the scorecard image."));
    reader.readAsDataURL(file);
  });
}

function proofSummary(
  fileName: string,
  scorecard: NonNullable<ScorecardExtractResponse["scorecard"]>,
) {
  const pieces = [
    scorecard.courseName,
    scorecard.teeName,
    scorecard.dateIso,
    typeof scorecard.totalScore === "number" ? `${scorecard.totalScore} total` : null,
  ].filter(Boolean);

  return pieces.length > 0
    ? `${fileName}: ${pieces.join(" - ")}`
    : `${fileName}: scorecard read. Confirm the total.`;
}
