import Link from "next/link";
import type { ComponentProps } from "react";
import { CourseTwinRuntime } from "@/app/play/[courseId]/course-twin-runtime";
import mobileStyles from "@/app/play/[courseId]/course-twin-mobile.module.css";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";
import styles from "./shared-twin.module.css";

type Props = Pick<
  ComponentProps<typeof CourseTwinRuntime>,
  "manifest" | "replay" | "initialHoleNumber"
> & { title: string };
export function SharedTwinView({ title, manifest, replay, initialHoleNumber }: Props) {
  return (
    <main
      id="main-content"
      data-course-twin-viewport
      data-shared-course-twin-viewport
      className={`${mobileStyles.viewport} ${styles.viewport}`}
    >
      <header className={styles.header}>
        <div className="min-w-0">
          <p className="text-xs text-emerald-200">{BRAND_NAME} · read-only Course Twin</p>
          <h1 className="mt-1 break-words text-lg font-semibold leading-snug">{title}</h1>
          <p id="shared-course-twin-context" className="mt-1 text-sm leading-5 text-emerald-100/80">
            Only the linked reconstructed shot path and course package are shared. Account details
            and source uploads are excluded.
          </p>
        </div>
        <Button asChild variant="secondary" className="h-auto min-h-11 whitespace-normal">
          <Link href="/" prefetch={false} data-course-twin-exit data-shared-course-twin-exit>
            Product home
          </Link>
        </Button>
      </header>
      <section
        aria-label="Shared 3D round replay"
        aria-describedby="shared-course-twin-context"
        className={styles.runtime}
      >
        <CourseTwinRuntime
          manifest={manifest}
          replay={replay}
          readOnly
          initialMode="replay"
          initialHoleNumber={initialHoleNumber}
        />
      </section>
    </main>
  );
}
