"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SpeedFormResult } from "./actions";
export function SpeedForm({
  action,
  children,
  label,
  disabled = false,
}: {
  action: (data: FormData) => Promise<SpeedFormResult>;
  children: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SpeedFormResult | null>(null);
  const [revision, setRevision] = useState(0);
  return (
    <form
      className="grid gap-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current || result?.ok || disabled) return;
        const data = new FormData(event.currentTarget);
        busy.current = true;
        setResult(null);
        startTransition(async () => {
          try {
            setResult(await action(data));
          } catch {
            setResult({
              ok: false,
              error:
                "The save could not be confirmed. Your entries are retained. Check saved sessions before retrying.",
            });
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      <fieldset
        key={revision}
        disabled={pending || result?.ok === true}
        className="grid min-w-0 gap-4"
      >
        {children}
      </fieldset>
      {result?.ok ? (
        <p role="status" className="text-sm text-primary">
          {label} saved.
          {result.sessionId && (
            <>
              {" "}
              <a className="underline" href={`/speed/sessions/${result.sessionId}`}>
                Open saved session
              </a>
            </>
          )}
        </p>
      ) : (
        result && (
          <p role="alert" className="text-sm text-destructive">
            {result.error}
          </p>
        )
      )}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setRevision((value) => value + 1);
            setResult(null);
          }}
        >
          {result?.ok ? "New entry" : "Cancel changes"}
        </Button>
        <Button type="submit" disabled={disabled || pending || result?.ok === true}>
          {pending ? "Saving…" : `Save ${label.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
export function SpeedReadingsInput() {
  const [text, setText] = useState("");
  const [reading, setReading] = useState("");
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Maximum-speed swings (mph)
        <Textarea
          name="speedReadings"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="Paste readings separated by spaces, commas or new lines"
        />
      </label>
      <div className="flex items-end gap-2">
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          Add a reading (mph)
          <Input
            inputMode="decimal"
            value={reading}
            onChange={(event) => setReading(event.target.value)}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={!reading.trim()}
          onClick={() => {
            setText((value) => `${value}${value.trim() ? "\n" : ""}${reading.trim()}`);
            setReading("");
          }}
        >
          Add reading
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Maximum-speed readings remain separate from warm-up swings and with-ball measurements.
        Entries are preserved exactly for server validation.
      </p>
    </div>
  );
}
