import {
  TOURNAMENT_ENTRY_TERMS,
  TOURNAMENT_ENTRY_TERMS_ACCEPT_FIELD,
  TOURNAMENT_ENTRY_TERMS_VERSION,
  TOURNAMENT_ENTRY_TERMS_VERSION_FIELD,
  TOURNAMENT_SETUP_TERMS,
} from "@/lib/tournament-entry-terms";
import { cn } from "@/lib/utils";

type TournamentEntryTermsProps = {
  controlId: string;
  compact?: boolean;
  className?: string;
};

export function TournamentEntryTerms({ controlId, compact = false, className }: TournamentEntryTermsProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white/80 p-3 text-xs leading-5", className)}>
      <input type="hidden" name={TOURNAMENT_ENTRY_TERMS_VERSION_FIELD} value={TOURNAMENT_ENTRY_TERMS_VERSION} />
      <div>
        <p className="font-semibold text-slate-900">{compact ? "Entry terms" : "Terms and conditions of entry"}</p>
        <ul className="mt-2 grid gap-1 text-muted-foreground">
          {TOURNAMENT_ENTRY_TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>
      {!compact ? (
        <div className="mt-4">
          <p className="font-semibold text-slate-900">Tournament setup instructions</p>
          <ul className="mt-2 grid gap-1 text-muted-foreground">
            {TOURNAMENT_SETUP_TERMS.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <label htmlFor={controlId} className="mt-2 flex items-start gap-2 text-slate-800">
        <input
          id={controlId}
          type="checkbox"
          name={TOURNAMENT_ENTRY_TERMS_ACCEPT_FIELD}
          value="accepted"
          required
          className="mt-0.5 size-4 shrink-0 accent-[#111827]"
        />
        <span>
          I accept {compact ? "the terms and conditions of entry" : "these terms and conditions"}.
        </span>
      </label>
    </div>
  );
}
