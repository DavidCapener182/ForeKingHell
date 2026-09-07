"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { partnerFormAction } from "@/app/partners/actions";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useClientReady } from "@/hooks/use-client-ready";
export function PartnerCreationForms({ sponsors }: { sponsors: { id: string; name: string }[] }) {
  const ready = useClientReady();
  const [open, setOpen] = useState<"sponsor" | "offer" | null>(null);
  return (
    <section id="partner-setup" className="grid gap-3">
      <h2 className="text-xl font-semibold">Partner setup</h2>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!ready} onClick={() => setOpen("sponsor")}>
          Create sponsor
        </Button>
        <Button
          disabled={!ready || !sponsors.length}
          variant="outline"
          onClick={() => setOpen("offer")}
        >
          Create partner offer
        </Button>
      </div>
      {!sponsors.length ? (
        <p className="text-sm">Create a sponsor you own before creating an offer.</p>
      ) : null}
      <ResponsiveDetailPanel
        open={open !== null}
        onOpenChange={(value) => {
          if (!value) setOpen(null);
        }}
        title={open === "offer" ? "Create partner offer" : "Create sponsor"}
        description={
          open === "offer"
            ? "Review the sponsor, context, terms and destination before making this offer active."
            : "Create a prospect record. This does not send a contact message or publish any offer."
        }
      >
        {open ? (
          <PartnerReviewForm key={open} operation={open} sponsors={sponsors}>
            {open === "sponsor" ? (
              <>
                <Field label="Sponsor name">
                  <Input name="name" required maxLength={160} />
                </Field>
                <Field label="Website URL">
                  <Input
                    name="websiteUrl"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com"
                  />
                </Field>
                <Field label="Contact email">
                  <Input name="contactEmail" type="email" inputMode="email" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Sponsor">
                  <select
                    name="sponsorId"
                    required
                    className="min-h-11 rounded-lg border bg-background px-3"
                  >
                    {sponsors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Offer title">
                  <Input name="title" required maxLength={160} />
                </Field>
                <Field label="Offer terms and description">
                  <Textarea name="description" rows={5} />
                </Field>
                <Field label="Offer type">
                  <select
                    name="offerType"
                    className="min-h-11 rounded-lg border bg-background px-3"
                  >
                    {["affiliate", "discount", "prize", "range_credit"].map((t) => (
                      <option key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Target context">
                  <Input name="targetContext" maxLength={80} />
                </Field>
                <Field label="Offer destination URL">
                  <Input name="offerUrl" type="url" inputMode="url" />
                </Field>
                <Field label="Coupon code">
                  <Input name="couponCode" maxLength={80} />
                </Field>
                <p className="text-sm">
                  Saving creates an active offer. Sponsored or affiliate labelling is shown
                  alongside the terms. No message is sent.
                </p>
              </>
            )}
          </PartnerReviewForm>
        ) : null}
      </ResponsiveDetailPanel>
    </section>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}
function PartnerReviewForm({
  operation,
  children,
  sponsors,
}: {
  operation: string;
  children: ReactNode;
  sponsors: { id: string; name: string }[];
}) {
  const ready = useClientReady();
  const router = useRouter();
  const busy = useRef(false);
  const [review, setReview] = useState<FormData | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      aria-label="Partner creation"
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        setMessage(undefined);
        const data = new FormData(e.currentTarget);
        data.set("operation", operation);
        setReview(data);
      }}
    >
      <fieldset disabled={!ready || pending || review !== null} className="grid min-w-0 gap-3">
        {children}
      </fieldset>
      {review ? (
        <div className="grid gap-3 rounded-xl border p-4">
          <h3 className="font-semibold">Review {operation}</h3>
          <dl className="grid gap-2 text-sm">
            {Array.from(review.entries())
              .filter(([key]) => key !== "operation")
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="whitespace-pre-wrap break-all">
                    {key === "sponsorId"
                      ? `${sponsors.find((s) => s.id === value)?.name ?? "Unknown sponsor"} · ${value}`
                      : String(value) || "Not supplied"}
                  </dd>
                </div>
              ))}
          </dl>
          <Button
            variant="outline"
            type="button"
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
                  const result = await partnerFormAction({ ok: false }, review);
                  if (!result.ok) {
                    setError(result.error ?? "The record could not be created.");
                    return;
                  }
                  setMessage(result.message ?? "Record created.");
                  setReview(null);
                  router.refresh();
                } catch {
                  setError(
                    "Creation could not be confirmed. Your draft is retained; check the register before retrying.",
                  );
                } finally {
                  busy.current = false;
                }
              });
            }}
          >
            {pending ? "Creating…" : `Confirm ${operation} creation`}
          </Button>
        </div>
      ) : (
        <Button disabled={!ready || pending}>Review creation</Button>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
