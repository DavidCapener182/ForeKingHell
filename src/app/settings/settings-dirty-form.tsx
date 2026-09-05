"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { DirtyFormBar } from "@/components/app/dirty-form-bar";

export function SettingsDirtyForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  return (
    <form key={revision} action={action} className={className} onChange={() => setDirty(true)}>
      {children}
      <SettingsSaveBar
        dirty={dirty}
        onReset={() => {
          // Remount controlled selects/switches as well as native fields. Native reset
          // alone leaves Radix state and the theme preview at their edited values.
          setRevision((value) => value + 1);
          setDirty(false);
        }}
      />
    </form>
  );
}

function SettingsSaveBar({ dirty, onReset }: { dirty: boolean; onReset: () => void }) {
  const { pending } = useFormStatus();
  return <DirtyFormBar dirty={dirty} saving={pending} onReset={onReset} />;
}
