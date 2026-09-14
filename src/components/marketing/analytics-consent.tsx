"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  CONSENT_SETTINGS_EVENT,
  filterAnalyticsEvent,
  isPublicAnalyticsPath,
  readAnalyticsConsent,
  saveAnalyticsConsent,
  subscribeAnalyticsConsent,
} from "@/lib/analytics-consent";
import styles from "./public-ui.module.css";

const serverConsent = () => "unknown" as const;
const subscribeHydration = () => () => {};
const browserHydrated = () => true;
const serverHydrated = () => false;

export function AnalyticsConsent() {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(subscribeHydration, browserHydrated, serverHydrated);
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    readAnalyticsConsent,
    serverConsent,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const publicPage =
    isPublicAnalyticsPath(pathname) || ["/login", "/thank-you", "/404"].includes(pathname);
  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(CONSENT_SETTINGS_EVENT, open);
    return () => window.removeEventListener(CONSENT_SETTINGS_EVENT, open);
  }, []);
  const choose = (allow: boolean) => {
    saveAnalyticsConsent(allow);
    setSettingsOpen(false);
  };
  return (
    <>
      {process.env.NODE_ENV === "production" &&
      consent === "granted" &&
      isPublicAnalyticsPath(pathname) ? (
        <Analytics
          beforeSend={filterAnalyticsEvent}
          route={pathname}
          path={pathname}
          scriptSrc="/_vercel/insights/script.js"
          debug={false}
        />
      ) : null}
      {hydrated && publicPage && (consent === "unknown" || settingsOpen) ? (
        <section
          className={styles.cookieBanner}
          aria-labelledby="cookie-choice-title"
          data-cookie-banner
        >
          <div>
            <h2 id="cookie-choice-title">Cookies & privacy</h2>
            <p>
              Essential storage keeps sign-in and your preferences working. With your permission, we
              also use cookie-free analytics to understand visits to our public pages.{" "}
              <Link href="/cookies">Read the details</Link>.
            </p>
          </div>
          <div className={styles.cookieActions}>
            <button type="button" onClick={() => choose(false)}>
              Essential only
            </button>
            <button type="button" onClick={() => choose(true)}>
              Allow analytics
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function CookieSettingsButton() {
  return (
    <button
      className={styles.settingsButton}
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_SETTINGS_EVENT))}
    >
      Change cookie preferences
    </button>
  );
}
