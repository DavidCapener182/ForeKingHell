"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

import { SessionShotPreview } from "./session-shot-preview-lazy";
export { SessionShotPreview } from "./session-shot-preview-lazy";

export function SessionShotPreviewDisclosure({ sessionId }: { sessionId: string }) {
  const [visited, setVisited] = useState(false);
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) setVisited(true);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">
        Inspect shot measurements and source
      </summary>
      {visited ? <SessionShotPreview key={sessionId} sessionId={sessionId} /> : null}
    </details>
  );
}

export function SessionShotPreviewSheet({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11 w-full">
          Preview shot evidence
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Measured shots, original source fields and review history.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          {open ? <SessionShotPreview key={sessionId} sessionId={sessionId} /> : null}
        </div>
        <SheetClose asChild>
          <Button variant="outline" className="mx-4 min-h-11">
            Close preview
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
