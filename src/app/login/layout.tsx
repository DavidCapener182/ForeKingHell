import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in or join",
  description: "Sign in to your golf account or request a secure email link to join LM World Tour.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
