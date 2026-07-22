import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CourseTwinNotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div className="max-w-lg space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Course Twin unavailable
        </p>
        <h1 className="text-3xl font-semibold">
          This course does not have a pilot 3D package yet.
        </h1>
        <p className="text-muted-foreground">
          The first controlled pilot is limited to mapped Bootle Golf Course data while terrain
          quality and replay truth are verified.
        </p>
        <Button asChild>
          <Link href="/courses">Back to courses</Link>
        </Button>
      </div>
    </main>
  );
}
