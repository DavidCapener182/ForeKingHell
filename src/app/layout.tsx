import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Libre_Baskerville, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { InteractionFeedback } from "@/components/interaction-feedback";
import { ThemeBootstrapScript } from "@/components/theme-bootstrap-script";
import { ThemeController } from "@/components/theme-controller";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_PUBLIC_URL, BRAND_SHORT_NAME } from "@/lib/brand";
import { themeColourByMode } from "@/lib/theme";
import { defaultThemePreference } from "@/lib/user-settings";
import "./globals.css";
import "./mobile-apple.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui-source",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-source",
  display: "swap",
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-editorial-source",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_PUBLIC_URL),
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: BRAND_SHORT_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/lmwt-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    siteName: BRAND_NAME,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "LM World Tour" }],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    {
      media: "(prefers-color-scheme: light) and (max-width: 1023px)",
      color: "#f2f2f7",
    },
    {
      media: "(prefers-color-scheme: dark) and (max-width: 1023px)",
      color: "#000000",
    },
    { media: "(min-width: 1024px)", color: themeColourByMode.clubhouse },
  ],
};

const publicPreferences = {
  preferredUnits: "yards",
  theme: defaultThemePreference,
  tableDensity: "comfortable",
} as const;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        "h-full",
        plusJakarta.variable,
        barlowCondensed.variable,
        libreBaskerville.variable,
      ].join(" ")}
      data-theme={publicPreferences.theme}
      data-theme-preference={publicPreferences.theme}
      data-table-density={publicPreferences.tableDensity}
      data-preferred-units={publicPreferences.preferredUnits}
      suppressHydrationWarning
    >
      <head>
        <ThemeBootstrapScript preference={publicPreferences.theme} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <ThemeController />
        <PlausibleScript />
        <InteractionFeedback />
        {children}
      </body>
    </html>
  );
}

function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) {
    return null;
  }

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
