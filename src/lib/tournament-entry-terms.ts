export const TOURNAMENT_ENTRY_TERMS_VERSION = "2026-05-15-no-mulligans";
export const TOURNAMENT_ENTRY_TERMS_ACCEPT_FIELD = "acceptEntryTerms";
export const TOURNAMENT_ENTRY_TERMS_VERSION_FIELD = "entryTermsVersion";

export const TOURNAMENT_ENTRY_TERMS = [
  "I will only enter rounds I personally played inside the tournament window.",
  "I will submit the required saved round, Rapsodo import or scorecard evidence for the event.",
  "I understand mulligans are not allowed in any tournament round.",
  "I accept that duplicate imports, manual edits or score mismatches can be reviewed, rejected or removed from standings.",
] as const;

export const TOURNAMENT_SETUP_TERMS = [
  "Use the tournament course, tee set and round format shown on this event before starting play.",
  "Set simulator gimme/putt rules to competition mode: 10 ft counts as a 1-putt gimme, 20 ft counts as a 2-putt gimme, and anything outside that must be holed or scored by the event rules.",
  "Mulligans are not allowed for any ForeKingHell tournament. Keep mulligans and rewind shots off before the round starts.",
  "Manual score edits are review-only evidence and can move the submission out of the verified board.",
  "Save the full round and keep a scorecard screenshot ready for verification before submitting.",
] as const;

export function hasAcceptedTournamentEntryTerms(
  acceptedValue: FormDataEntryValue | null,
  versionValue: FormDataEntryValue | null,
) {
  return acceptedValue === "accepted" && versionValue === TOURNAMENT_ENTRY_TERMS_VERSION;
}

export function hasCurrentTournamentEntryTermsMetadata(metadata: Record<string, unknown>) {
  return (
    metadata.entryTermsAccepted === true &&
    metadata.entryTermsVersion === TOURNAMENT_ENTRY_TERMS_VERSION
  );
}
