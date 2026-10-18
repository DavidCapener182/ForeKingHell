"use client";
import { Button } from "@/components/ui/button";

export function ClubSuggestionConfirmation({
  shotLabel,
  clubLabel,
  confirmed,
  disabled,
  onConfirm,
}: {
  shotLabel: string;
  clubLabel: string;
  confirmed: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-xs leading-5 text-muted-foreground">
        {confirmed
          ? "Your club selection is confirmed for this import."
          : "A suggested match is not a confirmed club. Check the club you used before saving."}
      </p>
      {confirmed ? (
        <p role="status" className="text-xs font-medium text-primary">
          Club confirmed · {clubLabel}
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 w-fit max-w-full whitespace-normal text-left"
          disabled={disabled}
          onClick={onConfirm}
          aria-label={`Confirm ${clubLabel} for ${shotLabel}`}
        >
          Use selected club · {clubLabel}
        </Button>
      )}
    </div>
  );
}

/** Preview-only readiness: keeping a reported source club is different from accepting a suggestion. */
export function isReviewedClubSelection({
  selectedClubKey,
  reportedClubKey,
  origin,
  trustedSuggestion,
}: {
  selectedClubKey: string | undefined;
  reportedClubKey: string | undefined;
  origin: string | undefined;
  trustedSuggestion: boolean;
}) {
  return Boolean(
    selectedClubKey &&
    (trustedSuggestion ||
      origin === "user" ||
      (origin === "reported" && selectedClubKey === reportedClubKey)),
  );
}
