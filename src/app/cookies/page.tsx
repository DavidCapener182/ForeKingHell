import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/marketing/analytics-consent";
import { PublicDocument } from "@/components/marketing/public-document";

export const metadata: Metadata = {
  title: "Cookies and privacy choices",
  description:
    "Understand essential browser storage and optional Vercel Web Analytics, and change your LM World Tour cookie preferences.",
  alternates: { canonical: "/cookies" },
};
export default function CookiesPage() {
  return (
    <PublicDocument
      title="Your privacy choices"
      description="Essential storage keeps the product working. Optional analytics is your choice, and you can change it here at any time."
    >
      <section>
        <h2>Essential storage</h2>
        <p>
          Sign-in cookies keep your session secure. Browser storage also remembers preferences such
          as your theme and app layout, supports offline features when you use them, and saves your
          analytics choice. These functions support the service you request. You can clear storage
          in your browser, but doing so may sign you out or reset preferences.
        </p>
      </section>
      <section>
        <h2>Optional analytics</h2>
        <p>
          With your permission, Vercel Web Analytics helps us understand visits and actions on
          public product pages. It uses no analytics cookies. We exclude signed-in pages, sign-in
          and share links, and remove query strings and fragments from page URLs before sending
          events. Marketing events contain no account identifiers or golf records.
        </p>
      </section>
      <section>
        <h2>Remembering your choice</h2>
        <p>
          Your choice is stored on this browser for up to 180 days under{" "}
          <code className="break-all">lmwt.analytics-consent.v1</code>. If browser storage is
          unavailable, the choice applies only to the current page session. Choosing essential
          storage only keeps optional analytics off.
        </p>
      </section>
      <section>
        <h2>Change your preference</h2>
        <p className="mb-5">
          Allow or decline analytics below. Withdrawing permission stops future optional events; it
          does not undo events already sent. Read the <Link href="/privacy">privacy policy</Link>{" "}
          for the wider data notice.
        </p>
        <CookieSettingsButton />
      </section>
    </PublicDocument>
  );
}
