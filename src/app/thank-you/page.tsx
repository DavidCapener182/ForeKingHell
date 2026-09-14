import type { Metadata } from "next";
import Link from "next/link";
import { PublicDocument } from "@/components/marketing/public-document";
import { safeNextPath } from "@/lib/safe-next-path";

export const metadata: Metadata = {
  title: "Thank you — check your email",
  description:
    "Follow your secure email link to continue to LM World Tour. Find the next step and help if the email has not arrived.",
  robots: { index: false, follow: false },
};
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next ?? "");
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <PublicDocument
      title="Thank you. Check your email."
      description="The secure link is your next step. Opening this page does not sign you in or complete account creation."
    >
      <section>
        <h2>Open your secure link</h2>
        <p>
          If you have just requested a sign-in link, check your inbox and spam folder. Open the
          latest email link in this browser to continue. A new account is completed through that
          secure sign-in process.
        </p>
      </section>
      <section>
        <h2>Nothing arrived?</h2>
        <p>
          Allow a few minutes, then check that the email address was correct. You can{" "}
          <Link href={loginHref}>return to sign in</Link> to request a fresh link or use your
          password. Repeated requests may be temporarily limited.
        </p>
      </section>
    </PublicDocument>
  );
}
