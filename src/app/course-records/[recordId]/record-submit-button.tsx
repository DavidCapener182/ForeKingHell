"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

type RecordSubmitButtonProps = {
  className?: string;
  label?: string;
};

export function RecordSubmitButton({ className, label = "Submit evidence" }: RecordSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      {pending ? "Submitting..." : label}
    </Button>
  );
}
