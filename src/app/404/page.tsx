import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "This LM World Tour page could not be found. Return to the product home or sign in to your golf account.",
  robots: { index: false, follow: false },
};
export default function MissingPage() {
  notFound();
}
