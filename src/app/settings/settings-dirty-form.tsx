"use client";

import { useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onChange={() => setDirty(true)}
      onSubmit={() => setSaving(true)}
    >
      {children}
      <DirtyFormBar
        dirty={dirty}
        saving={saving}
        onReset={() => {
          formRef.current?.reset();
          setDirty(false);
        }}
      />
    </form>
  );
}
