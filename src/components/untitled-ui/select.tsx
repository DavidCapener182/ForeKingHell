"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldProps } from "./field-props";
import styles from "./form-controls.module.css";

type SelectProps = FieldProps & {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
};

/** Load the optional menu on first use. A native select keeps required fields
 * usable and valid while their enhanced menu loads, including without JS. */
export function UntitledSelect(props: SelectProps) {
  const [Menu, setMenu] = useState<typeof import("./deferred-select").DeferredSelect>();
  const [loading, setLoading] = useState(false);
  const [nativeFocused, setNativeFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activation, setActivation] = useState(false);
  const pending = useRef(false);
  const [draft, setDraft] = useState(props.defaultValue ?? "");
  const id = useId();
  const value = props.value ?? draft;
  const load = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    import("./deferred-select").then(
      (module) => {
        setMenu(() => module.DeferredSelect);
        setLoading(false);
      },
      () => {
        setFailed(true);
        setLoading(false);
        pending.current = false;
      },
    );
  }, []);
  useEffect(() => {
    if (props.required) load();
  }, [props.required, load]);
  if (Menu && !nativeFocused)
    return <Menu {...props} defaultValue={draft} openOnMount={activation} />;
  const describedBy =
    [props.description && `${id}-description`, props.error && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div
      className={cn(styles.field, props.className)}
      data-invalid={Boolean(props.error) || undefined}
      data-disabled={props.disabled || undefined}
    >
      <label id={`${id}-label`} htmlFor={id} className={styles.label}>
        {props.label}
      </label>
      {props.required || failed ? (
        <select
          id={id}
          name={props.name}
          value={props.value}
          defaultValue={props.defaultValue}
          onFocus={() => setNativeFocused(true)}
          onBlur={() => setNativeFocused(false)}
          required={props.required}
          disabled={props.disabled}
          aria-describedby={describedBy}
          aria-invalid={Boolean(props.error) || undefined}
          className={styles.input}
          onChange={(event) => {
            setDraft(event.target.value);
            props.onValueChange?.(event.target.value);
          }}
        >
          {!props.options.some((option) => option.value === "") && !value ? (
            <option value="">Select an option</option>
          ) : null}
          {props.options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <button
            id={id}
            type="button"
            disabled={props.disabled}
            className={cn(styles.input, styles.selectTrigger)}
            aria-labelledby={`${id}-value ${id}-label`}
            aria-describedby={describedBy}
            aria-haspopup="listbox"
            aria-expanded={false}
            aria-busy={loading || undefined}
            onClick={() => {
              setActivation(true);
              load();
            }}
            onBlur={() => {
              setActivation(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setActivation(false);
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActivation(true);
                load();
              }
            }}
          >
            <span id={`${id}-value`}>
              {props.options.find((option) => option.value === value)?.label ?? "Select an option"}
            </span>
            <ChevronDown size={16} aria-hidden />
          </button>
          <input type="hidden" name={props.name} value={value} disabled={props.disabled} />
        </>
      )}
      {props.description ? (
        <span id={`${id}-description`} className={styles.description}>
          {props.description}
        </span>
      ) : null}
      {props.error ? (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {props.error}
        </span>
      ) : null}
    </div>
  );
}
