import type { Metadata } from "next";
import Link from "next/link";
import { PublicDocument } from "@/components/marketing/public-document";
import { BRAND_CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description:
    "Terms for using LM World Tour, including accounts, golf data, beta features, paid plans and your consumer rights.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PublicDocument
      title="Terms and conditions"
      description="How LM World Tour works, what to expect from the beta, and the responsibilities that come with using your golf account. Updated 14 September 2026."
    >
      <section>
        <h2>Using the service</h2>
        <p>
          LM World Tour helps you organise launch-monitor evidence, rounds and practice. Use the
          service lawfully, give accurate account information, keep your sign-in details secure and
          only upload information you have permission to use. Do not attempt to access another
          person’s private records or interfere with the service.
        </p>
      </section>
      <section>
        <h2>Your golf data</h2>
        <p>
          You keep your rights in the content you upload. You allow us to process it to provide the
          features you request. You control the sharing options available in your account; anyone
          with a private share link may be able to access the content named by that link. Our{" "}
          <Link href="/privacy">privacy policy</Link> explains the handling of your information and
          available controls.
        </p>
      </section>
      <section>
        <h2>Evidence, estimates and AI</h2>
        <p>
          Measured records, reconstructed course information and modelled outcomes serve different
          purposes. Estimates and AI responses can be incomplete or incorrect. Check important
          decisions against your own evidence, current course conditions and appropriate coaching.
          The service does not guarantee a handicap, performance result or safe shot.
        </p>
      </section>
      <section>
        <h2>Beta features and availability</h2>
        <p>
          Some features and provider integrations are in beta, depend on your plan or are only
          available for supported equipment. Availability is described in the product. We may
          improve, replace or temporarily interrupt features, including for maintenance and
          security. Keep a separate copy of important original records.
        </p>
      </section>
      <section>
        <h2>Plans, payment and cancellation</h2>
        <p>
          The price, billing interval, included limits and any renewal terms are shown before a paid
          purchase. Review these before confirming payment. Manage an existing subscription through
          the billing controls in your account. Nothing in these terms removes applicable
          cancellation, refund or other statutory consumer rights.
        </p>
      </section>
      <section>
        <h2>Sharing and community conduct</h2>
        <p>
          Respect other golfers. Do not publish abusive, misleading or unlawful material,
          impersonate others, or share personal information without permission. Competition and
          tournament features may have additional rules presented when you enter.
        </p>
      </section>
      <section>
        <h2>Account access and closure</h2>
        <p>
          Access may be restricted to address misuse, security incidents or legal obligations. You
          can review export and account-deletion options in settings. Follow the confirmation and
          completion messages carefully: requesting an action and completing it are separate steps.
        </p>
      </section>
      <section>
        <h2>Your rights and changes to these terms</h2>
        <p>
          We remain responsible where the law requires it, including for fraud or liabilities that
          cannot lawfully be excluded. These terms do not limit your mandatory consumer rights.
          Updated terms will be available on this page; material changes affecting an existing paid
          service should be brought to your attention before they take effect.
        </p>
        <p className="mt-4">
          For questions about these terms or the service, email{" "}
          <a href={`mailto:${BRAND_CONTACT_EMAIL}`} className="break-words">
            {BRAND_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </PublicDocument>
  );
}
