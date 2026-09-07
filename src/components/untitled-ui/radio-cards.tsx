"use client";
import { useId, type ReactNode } from "react";
import { RadioGroup, Radio, Label } from "react-aria-components";
import styles from "./radio-cards.module.css";

/** Local accessible Icon card composition. Options retain their exact domain values. */
export function UntitledRadioCards({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{
    value: string;
    title: string;
    description: string;
    badge?: string;
    icon?: ReactNode;
  }>;
}) {
  const id = useId();
  return (
    <RadioGroup value={value} onChange={onValueChange} className={styles.group}>
      <Label className={styles.label}>{label}</Label>
      <div className={styles.options}>
        {options.map((option, index) => (
          <Radio
            key={option.value}
            value={option.value}
            className={styles.card}
            aria-labelledby={`${id}-${index}-title`}
            aria-describedby={`${id}-${index}-description`}
          >
            {({ isSelected }) => (
              <>
                <span className={styles.top}>
                  <span aria-hidden className={styles.icon}>
                    {option.icon}
                  </span>
                  <span id={`${id}-${index}-title`} className={styles.title}>
                    {option.title}
                  </span>
                  {option.badge ? <span className={styles.badge}>{option.badge}</span> : null}
                  <span aria-hidden className={styles.indicator}>
                    {isSelected ? "✓" : ""}
                  </span>
                </span>
                <span id={`${id}-${index}-description`} className={styles.description}>
                  {option.description}
                </span>
                <span className={styles.selection}>
                  {isSelected ? "Selected" : "Select source"}
                </span>
              </>
            )}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
