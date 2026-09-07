"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function PartnerDestinationButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Opening offer…" : "Open offer destination"}
    </Button>
  );
}
