"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useClientReady } from "@/hooks/use-client-ready";
import { DirtyFormBar } from "@/components/app/dirty-form-bar";
import { discardThemePreview } from "@/components/theme-controller";
export function SettingsDirtyForm({
  action,
  children,
  className,
}: {
  action: (
    previous: { ok: boolean; error?: string },
    data: FormData,
  ) => Promise<{ ok: boolean; error?: string }>;
  children: ReactNode;
  className?: string;
}) {
  const ready = useClientReady();
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const router = useRouter();
  return (
    <form
      ref={formRef}
      key={revision}
      className={className}
      aria-busy={pending}
      onChange={() => {
        setDirty(true);
        setSaved(false);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (lock.current) return;
        const data = new FormData(e.currentTarget);
        lock.current = true;
        setError(undefined);
        start(async () => {
          try {
            const result = await action({ ok: false }, data);
            if (!result.ok) {
              setError(result.error ?? "Settings could not be saved. Your draft is retained.");
              return;
            }
            setDirty(false);
            setSaved(true);
            router.refresh();
          } catch {
            setError("Settings could not be saved. Your draft is retained.");
          } finally {
            lock.current = false;
          }
        });
      }}
    >
      <fieldset disabled={pending || !ready} className="min-w-0 grid gap-6">
        {children}
      </fieldset>
      {error ? (
        <p role="alert" className="rounded-xl border p-3">
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">Settings saved.</p> : null}
      <DirtyFormBar
        dirty={dirty}
        saving={pending}
        onReset={() => {
          if (
            formRef.current?.querySelector<HTMLInputElement>('input[name="settingsSection"]')
              ?.value === "appearance"
          )
            discardThemePreview();
          setRevision((v) => v + 1);
          setDirty(false);
          setError(undefined);
          setSaved(false);
        }}
      />
    </form>
  );
}
