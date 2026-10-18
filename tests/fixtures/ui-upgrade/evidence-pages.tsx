import { createRoot } from "react-dom/client";
import { useRef, useState } from "react";
import { EvidenceRouteError } from "@/app/import/evidence-route-error";
import { UploadDropzone } from "@/app/import/upload-dropzone";
import { ClubSuggestionConfirmation } from "@/app/rapsodo/club-suggestion-confirmation";
import { Button } from "@/components/ui/button";
const syntheticError = new Error("Synthetic route failure");
function Fixture() {
  const [view, setView] = useState("recovery");
  const [recovered, setRecovered] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [errors, setErrors] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <aside
        className="flex flex-wrap items-center gap-3 border-b bg-card p-4"
        aria-label="Synthetic fixture controls"
      >
        <strong className="text-sm">SYNTHETIC EVIDENCE PAGE REVIEW</strong>
        {["recovery", "upload", "confirmation"].map((name) => (
          <Button
            key={name}
            variant="outline"
            onClick={() => {
              setView(name);
              setRecovered(false);
            }}
          >
            {name}
          </Button>
        ))}
      </aside>
      {view === "recovery" ? (
        recovered ? (
          <main className="p-4">
            <h1>Recovery confirmed in fixture</h1>
          </main>
        ) : (
          <EvidenceRouteError
            context="import"
            error={syntheticError}
            retry={() => setRecovered(true)}
          />
        )
      ) : (
        <main className="grid min-w-0 gap-5 p-4 sm:p-6">
          <header>
            <h1 className="text-2xl font-semibold">
              {view === "upload" ? "Review selected files" : "Confirm the club you used"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Synthetic input only. No account, provider connection or live import is used.
            </p>
          </header>
          {view === "upload" ? (
            <>
              <Button className="w-fit" onClick={() => setReading(!reading)}>
                Toggle simulated reading
              </Button>
              <UploadDropzone
                fileInputRef={input}
                isDragging={false}
                setIsDragging={() => {}}
                onFilesSelected={() => {}}
                onClear={() => {}}
                onRemoveFile={() => {}}
                disabled={reading}
                readProgress={
                  reading
                    ? {
                        fileName:
                          "Synthetic_very_long_source_session_name_for_wrap_and_mobile_check.csv",
                        loaded: 12,
                        total: 30,
                      }
                    : null
                }
                files={[
                  {
                    id: "fixture-file",
                    fileName:
                      "Synthetic_very_long_source_session_name_for_wrap_and_mobile_check.csv",
                    parsed: {
                      shotCount: 12,
                      detectedDistanceUnit: "yards",
                      exportedAtIso: null,
                      warnings: ["Apex unit is unknown; raw values are retained for review."],
                    },
                  },
                ]}
                errors={
                  errors
                    ? [
                        {
                          id: "failed",
                          file: { name: "Synthetic_failed_export.csv" } as File,
                          message:
                            "The export could not be read. Choose a readable CSV or retry this file.",
                        },
                      ]
                    : []
                }
                onRetry={() => setErrors(false)}
                onDismissError={() => setErrors(false)}
              />
            </>
          ) : (
            <section
              className="grid min-w-0 gap-4 rounded-xl border bg-card p-4"
              aria-label="Club mapping"
            >
              <h2 className="font-semibold">Shot 2 · source club unknown</h2>
              <p className="text-sm">Suggested club · 7 Iron</p>
              <ClubSuggestionConfirmation
                shotLabel="shot 2"
                clubLabel="7 Iron"
                confirmed={confirmed}
                onConfirm={() => setConfirmed(true)}
              />
              <Button disabled={!confirmed} className="w-fit">
                Continue fixture review
              </Button>
            </section>
          )}
        </main>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
