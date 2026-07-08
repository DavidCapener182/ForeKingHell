"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminConfirmSubmitButton } from "@/app/admin/admin-confirm-submit-button";

type AdminBulkActionSubmitProps = {
  actionDescription: string;
  buttonLabel: string;
  fieldName: string;
  formId: string;
  itemPlural: string;
  itemSingular: string;
};

export function AdminBulkActionSubmit({
  actionDescription,
  buttonLabel,
  fieldName,
  formId,
  itemPlural,
  itemSingular,
}: AdminBulkActionSubmitProps) {
  const [selectedCount, setSelectedCount] = useState(0);
  const itemLabel = selectedCount === 1 ? itemSingular : itemPlural;
  const selectedLabel =
    selectedCount === 0 ? `No ${itemPlural} selected` : `${selectedCount} ${itemLabel} selected`;
  const confirmMessage = useMemo(
    () =>
      selectedCount === 0
        ? `Select at least one ${itemSingular} before running this bulk action.`
        : `Resolve ${selectedCount} selected ${itemLabel}? ${actionDescription}`,
    [actionDescription, itemLabel, itemSingular, selectedCount],
  );

  useEffect(() => {
    const selector = `input[type="checkbox"][form="${formId}"][name="${fieldName}"]`;
    const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>(selector));
    const updateSelectedCount = () => {
      setSelectedCount(
        checkboxes.filter((checkbox) => checkbox.checked && !checkbox.disabled).length,
      );
    };

    updateSelectedCount();
    checkboxes.forEach((checkbox) => checkbox.addEventListener("change", updateSelectedCount));

    return () => {
      checkboxes.forEach((checkbox) => checkbox.removeEventListener("change", updateSelectedCount));
    };
  }, [fieldName, formId]);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <p
        className="text-xs font-semibold text-amber-950"
        aria-live="polite"
        data-admin-bulk-selected-count="true"
      >
        {selectedLabel}
      </p>
      <AdminConfirmSubmitButton
        confirmActionLabel={buttonLabel}
        confirmMessage={confirmMessage}
        disabled={selectedCount === 0}
        form={formId}
        size="sm"
        variant="outline"
        data-admin-bulk-submit="true"
      >
        {buttonLabel}
      </AdminConfirmSubmitButton>
    </div>
  );
}
