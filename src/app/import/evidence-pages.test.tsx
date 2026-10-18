import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EvidenceRouteError } from "./evidence-route-error";
import { UploadDropzone } from "./upload-dropzone";
import {
  ClubSuggestionConfirmation,
  isReviewedClubSelection,
} from "@/app/rapsodo/club-suggestion-confirmation";
import { ImportPracticeReview } from "./import-result-sections";

const upload = {
  fileInputRef: createRef<HTMLInputElement>(),
  isDragging: false,
  readProgress: null,
  files: [],
  setIsDragging: vi.fn(),
  onFilesSelected: vi.fn(),
  onClear: vi.fn(),
  onRemoveFile: vi.fn(),
};

describe("evidence workflow recovery", () => {
  it.each([
    ["import", "Import workspace could not load", "/sessions"],
    ["rapsodo", "Rapsodo workspace could not load", "/import?source=csv"],
    ["shots", "Shot evidence could not load", "/sessions"],
    ["providers", "Provider connections could not load", "/sessions"],
    ["companion", "Companion task could not load", "/sessions"],
  ] as const)(
    "offers contextual recovery for %s without starting an import",
    (context, title, href) => {
      const html = renderToStaticMarkup(
        <EvidenceRouteError context={context} error={new Error("synthetic")} retry={vi.fn()} />,
      );
      expect(html).toContain(title);
      expect(html).toContain('role="alert"');
      expect(html).toContain(`href="${href}"`);
      expect(html).not.toContain("synthetic");
      expect(html).not.toContain("Reload page");
    },
  );
  it("never offers file actions without a recovery handler", () => {
    const html = renderToStaticMarkup(
      <UploadDropzone
        {...upload}
        errors={[
          { id: "failed", file: { name: "failed.csv" } as File, message: "Choose a readable CSV" },
        ]}
      />,
    );
    expect(html).toContain("Choose a readable CSV");
    expect(html).not.toContain("Retry file");
    expect(html).not.toContain("Dismiss error");
  });
  it("disables removal while parsing and keeps the selected filename readable", () => {
    const html = renderToStaticMarkup(
      <UploadDropzone
        {...upload}
        disabled
        files={[
          {
            id: "one",
            fileName: "source.csv",
            parsed: { shotCount: 2, exportedAtIso: null, detectedDistanceUnit: "yards" },
          },
        ]}
      />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Remove source.csv"/);
    expect(html).toContain("Date not detected");
  });
  it("distinguishes a suggestion from an accepted club", () => {
    const props = { shotLabel: "shot 2", clubLabel: "7 Iron", onConfirm: vi.fn() };
    const initial = renderToStaticMarkup(
      <ClubSuggestionConfirmation {...props} confirmed={false} />,
    );
    expect(initial).toContain('aria-label="Confirm 7 Iron for shot 2"');
    expect(initial).toContain("not a confirmed club");
    const confirmed = renderToStaticMarkup(<ClubSuggestionConfirmation {...props} confirmed />);
    expect(confirmed).toContain('role="status"');
    expect(confirmed).toContain("Club confirmed");
    expect(confirmed).not.toContain("<button");
  });
  it("retains valid source-mode selections while requiring explicit review of suggestions", () => {
    const source = {
      selectedClubKey: "7i:source",
      reportedClubKey: "7i:source",
      origin: "reported",
      trustedSuggestion: false,
    };
    expect(isReviewedClubSelection(source)).toBe(true);
    expect(isReviewedClubSelection({ ...source, origin: "recommendation" })).toBe(false);
    expect(isReviewedClubSelection({ ...source, selectedClubKey: "driver:other" })).toBe(false);
    expect(
      isReviewedClubSelection({ ...source, origin: "user", selectedClubKey: "driver:other" }),
    ).toBe(true);
    expect(isReviewedClubSelection({ ...source, origin: "user", selectedClubKey: undefined })).toBe(
      false,
    );
  });

  it("does not present missing practice blocks as a zero performance score", () => {
    const review = {
      title: "Saved plan",
      planId: "plan",
      score: 0,
      verdict: "Not enough evidence",
      nextAction: "Review the uploaded evidence",
      comparison: null,
    } as Parameters<typeof ImportPracticeReview>[0]["review"];
    const html = renderToStaticMarkup(<ImportPracticeReview review={review} sessionId="session" />);
    expect(html).toContain("no recorded block comparisons");
    expect(html).not.toContain("0/100");
    expect(html).toContain("Open matched plan");
  });
});
