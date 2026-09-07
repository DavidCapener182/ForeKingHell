"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, ImageIcon, Loader2, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  proofScopeId,
  proofScopeType,
  screenshotFieldName,
  extractedTotalFieldName,
  screenshotLabel = "Scorecard screenshot reference",
  extractedTotalLabel = "Extracted score total",
  onPendingChange,
  onProofChange,
}: {
  proofScopeId: string;
  proofScopeType: "course_record" | "tournament";
  screenshotFieldName: string;
  extractedTotalFieldName: string;
  screenshotLabel?: string;
  extractedTotalLabel?: string;
  onPendingChange?: (pending: boolean) => void;
  onProofChange?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestVersion = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [screenshotPath, setScreenshotPath] = useState("");
  const [extractedTotal, setExtractedTotal] = useState("");
  const [proofToken, setProofToken] = useState("");
  const [state, setState] = useState<ExtractState>({
    status: "idle",
    message: "Upload a scorecard image, then confirm the extracted total before submitting.",
  });

  useEffect(() => {
    onPendingChange?.(state.status === "loading");
  }, [state.status, onPendingChange]);
  useEffect(
    () => () => {
      requestVersion.current++;
      controllerRef.current?.abort();
    },
    [],
  );
  function removeProof() {
    onProofChange?.();
    requestVersion.current++;
    controllerRef.current?.abort();
    setFile(null);
    setPreview("");
    setScreenshotPath("");
    setExtractedTotal("");
    setProofToken("");
    setState({
      status: "idle",
      message: "No image selected. Choose a JPEG, PNG or WebP scorecard, up to 5 MB.",
    });
  }
  async function extractScorecard(nextFile: File | null | undefined) {
    if (!nextFile) return;
    onProofChange?.();
    const version = ++requestVersion.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setProofToken("");
    setExtractedTotal("");
    setScreenshotPath("");
    setPreview("");
    setFile(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) {
      setState({ status: "error", message: "Choose a JPEG, PNG or WebP image." });
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setState({ status: "error", message: "This image exceeds 5 MB. Choose a smaller image." });
      return;
    }
    setFile(nextFile);
    setScreenshotPath(`scorecard-upload:${nextFile.name}`);
    setState({ status: "loading", message: `Reading ${nextFile.name}…` });
    try {
      const imageDataUrl = await readFileAsDataUrl(nextFile);
      if (version !== requestVersion.current) return;
      setPreview(imageDataUrl);
      const response = await fetch("/api/scorecard/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ imageDataUrl, proofScopeId, proofScopeType }),
      });
      const payload = (await response.json()) as ScorecardExtractResponse;
      if (version !== requestVersion.current) return;
      if (!response.ok || !payload.scorecard)
        throw new Error(payload.message ?? "Scorecard extraction failed.");
      setExtractedTotal(
        typeof payload.scorecard.totalScore === "number" &&
          Number.isFinite(payload.scorecard.totalScore)
          ? String(payload.scorecard.totalScore)
          : "",
      );
      setProofToken(payload.proofToken ?? "");
      setState({
        status: "success",
        message: `${proofSummary(nextFile.name, payload.scorecard)}. Image read; the attempt is not verified until its board checks pass.`,
      });
    } catch (error) {
      if (version !== requestVersion.current || controller.signal.aborted) return;
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `${error.message} Retry this image or choose another. Manual totals do not establish verified proof.`
            : "Image could not be read. Retry or choose another image.",
      });
    }
  }

  return (
    <div
      className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void extractScorecard(event.dataTransfer.files[0]);
      }}
      aria-busy={state.status === "loading"}
    >
      <input type="hidden" name="scorecardProofToken" value={proofToken} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose scorecard image"
        className="hidden"
        onChange={(event) => {
          void extractScorecard(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            Proof check
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Choose from Files or your photo library, or drop one JPEG, PNG or WebP image here.
            Maximum 5 MB. Confirm the extracted total against the selected saved round.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          disabled={state.status === "loading"}
          onClick={() => fileInputRef.current?.click()}
        >
          {state.status === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageIcon className="size-4" />
          )}
          {state.status === "loading" ? "Reading…" : "Choose scorecard image"}
        </Button>
      </div>
      {file ? (
        <div className="grid gap-2">
          <p className="break-words text-sm">
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          {preview ? (
            <details>
              <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">
                Preview scorecard image
              </summary>
              <Image
                src={preview}
                alt={`Scorecard preview: ${file.name}`}
                width={1200}
                height={1600}
                unoptimized
                className="h-auto w-full rounded border"
              />
            </details>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {state.status === "error" ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => void extractScorecard(file)}
              >
                Retry image
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="min-h-11" onClick={removeProof}>
              Remove image
            </Button>
          </div>
        </div>
      ) : null}
      {state.status === "loading" ? (
        <progress aria-label="Reading scorecard image" className="w-full" />
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          {screenshotLabel}
          <Input
            name={screenshotFieldName}
            value={screenshotPath}
            placeholder="/uploads/scorecards/round.png"
            className="min-h-11 rounded-xl bg-background"
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
            type="number"
            min="1"
            step="1"
            className="min-h-11 rounded-xl bg-background"
          />
        </label>
      </div>
      {state.status === "error" ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>Proof check</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : (
        <p className="break-words text-sm leading-5 text-muted-foreground" aria-live="polite">
          {state.message}
        </p>
      )}
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
