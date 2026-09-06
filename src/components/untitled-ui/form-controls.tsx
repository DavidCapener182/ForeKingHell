"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button as AriaButton, type ButtonProps } from "react-aria-components/Button";
import { TextField } from "react-aria-components/TextField";
import { Input } from "react-aria-components/Input";
import { Label } from "react-aria-components/Label";
import { Text } from "react-aria-components/Text";
import { FieldError } from "react-aria-components/FieldError";
import { Select, SelectValue } from "react-aria-components/Select";
import { Popover } from "react-aria-components/Popover";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./form-controls.module.css";

/** Native submit intent/name/value/formAction flow through unchanged. React Aria
 * onPress is deliberate; this API does not pretend a PressEvent is a MouseEvent. */
export function UntitledSubmitButton({ children, pendingLabel = "Saving…", className, disabled, ...props }:
  Omit<ButtonProps, "className" | "children" | "isDisabled" | "isPending"> & {
    children: ReactNode; className?: string; disabled?: boolean; pendingLabel?: string;
  }) {
  const { pending } = useFormStatus();
  return <AriaButton {...props} type={props.type ?? "submit"} isDisabled={disabled} isPending={pending}
    className={cn(buttonVariants(), styles.button, className)}>
    {pending ? pendingLabel : children}
  </AriaButton>;
}

type FieldProps = {
  label: string; name: string; value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean; disabled?: boolean; description?: string; error?: string; className?: string;
};

/** New value-based API: onValueChange receives text, never a fabricated event.
 * Existing ui/Input remains the native ChangeEvent-compatible adapter. */
export function UntitledTextField({label, name, value, defaultValue, onValueChange, required, disabled, description, error, className, placeholder, type = "text"}:
  FieldProps & {placeholder?: string; type?: "text" | "email" | "password" | "search" | "tel" | "url"}) {
  return <TextField name={name} value={value} defaultValue={defaultValue} onChange={onValueChange}
    isRequired={required} isDisabled={disabled} isInvalid={Boolean(error)} validationBehavior="native"
    type={type} className={cn(styles.field, className)}>
    <Label className={styles.label}>{label}</Label>
    <Input placeholder={placeholder} className={styles.input} />
    {description ? <Text slot="description" className={styles.description}>{description}</Text> : null}
    <FieldError className={styles.error}>{error}</FieldError>
  </TextField>;
}

/** React Aria 1.21 uses value/onChange; selectedKey/onSelectionChange are deprecated.
 * String keys are the exact option values submitted under the native form name. */
export function UntitledSelect({label, name, value, defaultValue, onValueChange, required, disabled, description, error, className, options}:
  FieldProps & {options: Array<{value: string; label: string; disabled?: boolean}>}) {
  return <Select name={name} value={value} defaultValue={defaultValue}
    onChange={(key) => onValueChange?.(key === null ? "" : String(key))}
    isRequired={required} isDisabled={disabled} isInvalid={Boolean(error)} validationBehavior="native"
    disabledKeys={options.filter((option) => option.disabled).map((option) => option.value)}
    className={cn(styles.field, className)}>
    <Label className={styles.label}>{label}</Label>
    <AriaButton className={cn(styles.input, styles.selectTrigger)}><SelectValue /><ChevronDown size={16} aria-hidden /></AriaButton>
    <Popover className={styles.popover}>
      <ListBox className={styles.list} items={options}>
        {(option) => <ListBoxItem id={option.value} textValue={option.label} className={styles.option}>{option.label}</ListBoxItem>}
      </ListBox>
    </Popover>
    {description ? <Text slot="description" className={styles.description}>{description}</Text> : null}
    <FieldError className={styles.error}>{error}</FieldError>
  </Select>;
}
