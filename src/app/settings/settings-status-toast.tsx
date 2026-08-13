"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";

export function SettingsStatusToast({ saved }: { saved: boolean }) {
  useEffect(() => {
    if (!saved) return;

    toast.success("Settings saved", {
      id: "settings-saved",
      description: "Your profile and preference changes are active for this account.",
    });
  }, [saved]);

  return <Toaster />;
}
