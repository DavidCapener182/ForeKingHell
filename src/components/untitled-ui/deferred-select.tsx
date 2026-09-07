"use client";
import { useEffect, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components/Button";
import { Label } from "react-aria-components/Label";
import { Text } from "react-aria-components/Text";
import { FieldError } from "react-aria-components/FieldError";
import { Select, SelectValue } from "react-aria-components/Select";
import { Popover } from "react-aria-components/Popover";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldProps } from "./field-props";
import styles from "./form-controls.module.css";
/** React Aria 1.21 uses value/onChange; selectedKey/onSelectionChange are deprecated.
 * String keys are the exact option values submitted under the native form name. */
export function DeferredSelect({
  openOnMount = false,
  label,
  name,
  value,
  defaultValue,
  onValueChange,
  required,
  disabled,
  description,
  error,
  className,
  options,
}: FieldProps & {
  openOnMount?: boolean;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<Element | undefined>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openOnMount) {
      setPortalContainer(
        triggerRef.current?.closest('[role="dialog"], [role="alertdialog"]') ?? undefined,
      );
      setOpen(true);
      triggerRef.current?.focus();
    }
  }, [openOnMount]);
  // Radix listens at document capture. Handle the inner menu first so Escape
  // closes only this menu and restores its trigger, leaving dialog drafts open.
  useEffect(() => {
    if (!open) return;
    const menu = popoverRef.current;
    const trigger = triggerRef.current;
    const closeMenu = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        event.target instanceof Node &&
        (menu?.contains(event.target) || trigger?.contains(event.target))
      ) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", closeMenu, true);
    return () => window.removeEventListener("keydown", closeMenu, true);
  }, [open]);
  return (
    <Select
      isOpen={open}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onOpenChange={(open) => {
        setOpen(open);
        if (open)
          setPortalContainer(
            triggerRef.current?.closest('[role="dialog"], [role="alertdialog"]') ?? undefined,
          );
      }}
      onChange={(key) => onValueChange?.(key === null ? "" : String(key))}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      validationBehavior="native"
      disabledKeys={options.filter((option) => option.disabled).map((option) => option.value)}
      className={cn(styles.field, className)}
    >
      <Label className={styles.label}>{label}</Label>
      <AriaButton ref={triggerRef} className={cn(styles.input, styles.selectTrigger)}>
        <SelectValue />
        <ChevronDown size={16} aria-hidden />
      </AriaButton>
      <Popover
        UNSTABLE_portalContainer={portalContainer}
        className={styles.popover}
        ref={popoverRef}
      >
        <ListBox className={styles.list} items={options}>
          {(option) => (
            <ListBoxItem id={option.value} textValue={option.label} className={styles.option}>
              {option.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      <FieldError className={styles.error}>{error}</FieldError>
    </Select>
  );
}
