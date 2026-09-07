"use client";
import { TextField } from "react-aria-components/TextField";
import { Input } from "react-aria-components/Input";
import { Label } from "react-aria-components/Label";
import { Text } from "react-aria-components/Text";
import { FieldError } from "react-aria-components/FieldError";
import { cn } from "@/lib/utils";
import type { FieldProps } from "./field-props";
import styles from "./form-controls.module.css";

/** New value-based API: onValueChange receives text, never a fabricated event.
 * Existing ui/Input remains the native ChangeEvent-compatible adapter. */
export function UntitledTextField({
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
  placeholder,
  type = "text",
}: FieldProps & {
  placeholder?: string;
  type?: "text" | "email" | "password" | "search" | "tel" | "url";
}) {
  return (
    <TextField
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onValueChange}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      validationBehavior="native"
      type={type}
      className={cn(styles.field, className)}
    >
      <Label className={styles.label}>{label}</Label>
      <Input placeholder={placeholder} className={styles.input} />
      {description ? (
        <Text slot="description" className={styles.description}>
          {description}
        </Text>
      ) : null}
      <FieldError className={styles.error}>{error}</FieldError>
    </TextField>
  );
}
