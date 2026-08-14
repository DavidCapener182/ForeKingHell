"use client";

import Image from "next/image";
import { useState } from "react";

import { DataPanel, SectionHeader } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";

type GoogleCourseContextPanelProps = {
  address: string | null;
  googleRating: number | null;
  latitude: number;
  longitude: number;
  name: string;
  reviewCount: number | null;
  websiteUrl: string | null;
};

const coordinateFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 6,
});

export function GoogleCourseContextPanel({
  address,
  googleRating,
  latitude,
  longitude,
  name,
  reviewCount,
  websiteUrl,
}: GoogleCourseContextPanelProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const [streetViewFailed, setStreetViewFailed] = useState(false);
  const mapSrc = `/api/courses/google/map?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&zoom=16&width=640&height=360`;
  const streetViewSrc = `/api/courses/google/street-view?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&width=640&height=360`;

  return (
    <DataPanel>
      <SectionHeader
        title="Google course context"
        description={address ?? websiteUrl ?? "Google Places course context"}
        action={<Badge variant="secondary">Google</Badge>}
      />
      <CardContent className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        {!mapFailed ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Image
              src={mapSrc}
              alt={`${name} map`}
              width={640}
              height={360}
              unoptimized
              onError={() => setMapFailed(true)}
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        ) : null}
        <div className="grid gap-3">
          {!streetViewFailed ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <Image
                src={streetViewSrc}
                alt={`${name} street view`}
                width={640}
                height={360}
                unoptimized
                onError={() => setStreetViewFailed(true)}
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          ) : null}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <ReadonlyValue label="Google rating" value={formatOptionalNumber(googleRating)} />
            <ReadonlyValue label="Reviews" value={reviewCount?.toString() ?? "--"} />
            <ReadonlyValue label="Latitude" value={coordinateFormatter.format(latitude)} />
            <ReadonlyValue label="Longitude" value={coordinateFormatter.format(longitude)} />
          </dl>
        </div>
      </CardContent>
    </DataPanel>
  );
}

function ReadonlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/35 px-3 py-2">
      <dt className="text-xs uppercase tracking-normal text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function formatOptionalNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}
