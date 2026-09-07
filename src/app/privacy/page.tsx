import Link from "next/link";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";
const sections = [
  {
    id: "stored-data",
    title: "Data stored",
    body: `${BRAND_NAME} stores your profile and preferences, imported CSV files and original rows, processed shots, sessions, rounds, courses you create, equipment history, achievements and coaching outputs. These records support your golf history and the app’s analysis.`,
  },
  {
    id: "account-scope",
    title: "Account scope and sharing",
    body: "Account access is tied to your sign-in identity. Collaboration invitations create memberships with assigned roles. Private share links provide access to the resource named in the link. Review visibility and sharing settings before publishing a profile or sharing a link.",
  },
  {
    id: "ai-context",
    title: "AI coaching and Data Chat",
    body: "AI coaching and Data Chat use golf evidence relevant to your question, such as shot, round, bag, speed, practice or record summaries. Data Chat leaves out free-text notes, challenge descriptions and challenge rules. Its responses explain records and cannot edit your data.",
  },
  {
    id: "scorecard-images",
    title: "Scorecard images",
    body: "When you choose scorecard extraction, the app checks the image format and size, then re-encodes the image to remove embedded metadata before sending it to the external AI service. The original raw image is not persisted; derived scorecard data and its signed proof hash are stored.",
  },
  {
    id: "analytics",
    title: "Product analytics",
    body: "Where enabled, Plausible records product events such as imports, round creation, AI coach generation, app installation and invitation acceptance. The app does not send raw shot rows as analytics event properties.",
  },
  {
    id: "data-controls",
    title: "Export, reset and account deletion",
    body: `You can export account data before deciding whether to reset or delete it. Golf data reset removes ${BRAND_NAME} golf records while keeping the sign-in identity. Permanent account deletion is a separate operation requiring recent sign-in and explicit confirmation. Follow its result and recovery instructions to confirm completion; opening a settings link does not delete anything.`,
  },
];
export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-12">
        <nav aria-label="Data notice navigation" className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/">Product home</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login" prefetch={false}>
              Sign in
            </Link>
          </Button>
        </nav>
        <PageHeader
          title={`${BRAND_NAME} data notice`}
          description="The golf data the app uses, what is shared with AI and analytics, and the controls available to you."
          actions={
            <Button asChild>
              <Link href="/settings?section=privacy" prefetch={false}>
                Privacy settings
              </Link>
            </Button>
          }
        />
        <nav aria-label="On this page" className="flex flex-wrap gap-2 rounded-xl border p-4">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm underline underline-offset-4"
            >
              {s.title}
            </a>
          ))}
        </nav>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-24 rounded-xl border p-5"
              aria-labelledby={`${s.id}-title`}
            >
              <h2 id={`${s.id}-title`} className="text-lg font-semibold">
                {s.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
        <section className="grid gap-3 rounded-xl border p-5" aria-labelledby="controls-title">
          <h2 id="controls-title" className="text-lg font-semibold">
            Your practical controls
          </h2>
          <p className="text-sm text-muted-foreground">
            These links open the appropriate settings. Sign in when asked; export, reset and
            deletion each have their own action and result.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="grid content-start gap-3">
              <h3 className="font-semibold">Export account data</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Choose the data you need and follow any continuation links for larger exports.
              </p>
              <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
                <Link href="/settings?section=data" prefetch={false}>
                  Review export options
                </Link>
              </Button>
            </article>
            <article className="grid content-start gap-3">
              <h3 className="font-semibold">Review shared access</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Inspect memberships and the people with access to shared account data.
              </p>
              <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
                <Link href="/settings?section=sharing" prefetch={false}>
                  Review shared access
                </Link>
              </Button>
            </article>
            <article className="grid content-start gap-3">
              <h3 className="font-semibold">Reset or delete</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Read the scope and confirmation requirements before choosing either action.
              </p>
              <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal">
                <Link href="/settings?section=danger" prefetch={false}>
                  Review reset and deletion
                </Link>
              </Button>
            </article>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
