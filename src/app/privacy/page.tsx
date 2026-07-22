import Link from "next/link";
import { ArrowLeft, Database, LockKeyhole, MessageCircle, Share2, ShieldCheck } from "lucide-react";

import {
  MobileAccordionSection,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BRAND_NAME } from "@/lib/brand";

const privacySections = [
  {
    title: "Data stored",
    icon: Database,
    body: `${BRAND_NAME} stores your profile, preferences, imported CSV files, raw CSV rows, normalized shots, sessions, rounds, courses you create, equipment history, achievements, and coaching outputs in the configured Supabase Postgres database.`,
  },
  {
    title: "Account scope",
    icon: LockKeyhole,
    body: "Runtime reads and writes are scoped to your Supabase Auth user. Collaboration links create role-based memberships, and private share links expose only the resource named in the link.",
  },
  {
    title: "AI coaching",
    icon: MessageCircle,
    body: "OpenAI-backed coach and Data Chat responses use question-relevant, SQL-retrieved golf evidence from your account. Prompts may include measured shot, round, bag, speed, practice or record summaries when that subject is requested. Free-text notes, challenge descriptions and challenge rules are omitted from Data Chat prompts; AI responses cannot edit your data. When you choose scorecard extraction, the image is magic-byte validated, limited to 5 MB and 40 million pixels, then decoded and re-encoded to strip EXIF, XMP and IPTC metadata before the normalized image is sent to the configured external model. The original raw image is not persisted; the app stores the derived scorecard data and its signed proof hash.",
  },
  {
    title: "Analytics",
    icon: ShieldCheck,
    body: "If NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured, Plausible records product events such as imports, round creation, AI coach generation, PWA install, and invite acceptance. The app does not send raw shot rows as analytics event properties.",
  },
  {
    title: "Export and deletion",
    icon: Share2,
    body: `The settings page separates Golf data reset from permanent account deletion. Golf data reset removes ${BRAND_NAME} golf records while keeping the sign-in identity. Permanent account deletion requires a recent reauthentication, removes the account data, and deletes the linked Supabase Auth identity. Export remains available before either action.`,
  },
];

export default function PrivacyPage() {
  return (
    <PageShell>
      <Button asChild variant="ghost" className="w-fit px-0">
        <Link href="/login" prefetch={false}>
          <ArrowLeft className="size-4" />
          Sign in
        </Link>
      </Button>

      <PageHeader
        eyebrow={<StatusPill tone="green">Privacy</StatusPill>}
        title={`${BRAND_NAME} data notice`}
        description="How the app stores golf data, uses AI context, records analytics events, and lets you export or delete account data."
      />

      <Card className="premium-card sm:hidden">
        <CardContent className="space-y-3 p-4">
          <SectionHeader
            title="Privacy summary"
            description="Your golf records are scoped to your account, sharing is role-based, and export/delete controls live in settings."
          />
          <Button asChild className="w-full rounded-xl bg-[#111827] text-white">
            <Link href="/settings" prefetch={false}>
              Data controls
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:hidden">
        {privacySections.map((section) => (
          <MobileAccordionSection key={section.title} title={section.title}>
            <p className="text-sm leading-6 text-muted-foreground">{section.body}</p>
          </MobileAccordionSection>
        ))}
      </div>

      <div className="hidden gap-4 sm:grid md:grid-cols-2">
        {privacySections.map((section) => {
          const Icon = section.icon;

          return (
            <Card key={section.title} className="premium-card">
              <CardContent className="space-y-3 p-5">
                <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Icon className="size-5" />
                </div>
                <SectionHeader title={section.title} description={section.body} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="premium-card">
        <CardContent className="space-y-3 p-5">
          <SectionHeader
            title="Public launch gate"
            description="Before broad public deployment, verify Supabase Auth providers, RLS policies, role-scoped access, export/delete flows, rate limits, and production analytics configuration in the target Supabase project."
          />
          <Button asChild className="w-fit rounded-xl bg-[#111827] text-white">
            <Link href="/login" prefetch={false}>
              Continue to sign in
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
