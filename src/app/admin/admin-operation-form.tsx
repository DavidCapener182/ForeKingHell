"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { adminFormAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/hooks/use-client-ready";
export function AdminOperationForm({
  operation,
  title,
  description,
  children,
}: {
  operation: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const ready = useClientReady();
  const [review, setReview] = useState<FormData | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const router = useRouter();
  return (
    <form
      className="grid gap-3 rounded-xl border p-4"
      aria-label={title}
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        setMessage(undefined);
        const data = new FormData(e.currentTarget);
        data.set("operation", operation);
        setReview(data);
      }}
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <fieldset disabled={!ready || pending || review !== null} className="grid min-w-0 gap-3">
        {children}
      </fieldset>
      {review ? (
        <div className="grid gap-3 border-t pt-3">
          <p className="font-medium">Review {title.toLowerCase()}</p>
          <dl className="grid gap-2 text-sm">
            {Array.from(review.entries())
              .filter(([key]) => key !== "operation")
              .map(([key, value], index) => (
                <div key={index}>
                  <dt className="text-muted-foreground">
                    {key === "userId"
                      ? "Account ID"
                      : key === "email"
                        ? "Account email"
                        : key === "role"
                          ? "Admin role"
                          : key}
                  </dt>
                  <dd className="break-all font-medium">{String(value)}</dd>
                </div>
              ))}
          </dl>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setReview(null)}
          >
            Cancel review
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setError(undefined);
              start(async () => {
                try {
                  const result = await adminFormAction({ ok: false }, review);
                  if (!result.ok) {
                    setError(result.error ?? "The action could not be completed.");
                    return;
                  }
                  setMessage(result.message ?? "Action saved.");
                  setReview(null);
                  router.refresh();
                } catch {
                  setError("The action could not be confirmed. Review the account and retry.");
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Applying…" : `Confirm ${title.toLowerCase()}`}
          </Button>
        </div>
      ) : (
        <Button type="submit" variant="outline" disabled={!ready || pending}>
          Review {title.toLowerCase()}
        </Button>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {message ? (
        <p role="status">
          {title}: {message}
        </p>
      ) : null}
    </form>
  );
}
