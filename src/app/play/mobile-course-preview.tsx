"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Cuboid } from "lucide-react";
import styles from "./mobile-course-preview.module.css";

/** A lightweight entry to the original Course Twin; no renderer loads in this preview. */
export function MobileCoursePreview({
  courseName,
  imageUrl,
  attribution,
  href,
}: {
  courseName: string;
  imageUrl: string;
  attribution: string;
  href: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className={styles.preview}>
      <Link
        href={href}
        prefetch={false}
        className={styles.imageLink}
        aria-label={`Explore ${courseName} in 3D Course Twin`}
      >
        <Image
          src={imageUrl}
          alt={`Aerial view of ${courseName} and its surroundings`}
          fill
          sizes="(max-width: 767px) calc(100vw - 32px), 720px"
          loading="eager"
          // Course assets require the browser's session; Next's optimizer omits those cookies.
          unoptimized
          onError={() => setFailed(true)}
        />
        <span className={styles.openLabel}>
          <Cuboid aria-hidden />
          Explore in 3D
        </span>
      </Link>
      {attribution ? (
        <figcaption className={styles.credits}>
          <details>
            <summary>Imagery credits</summary>
            <p>{attribution}</p>
          </details>
        </figcaption>
      ) : null}
    </figure>
  );
}
