"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button as AriaButton, type ButtonProps } from "react-aria-components/Button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./form-controls.module.css";

/** Native submit intent/name/value/formAction flow through unchanged. React Aria
 * onPress is deliberate; this API does not pretend a PressEvent is a MouseEvent. */
export function UntitledSubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  disabled,
  ...props
}: Omit<ButtonProps, "className" | "children" | "isDisabled" | "isPending"> & {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <AriaButton
      {...props}
      type={props.type ?? "submit"}
      isDisabled={disabled}
      isPending={pending}
      className={cn(buttonVariants(), styles.button, className)}
    >
      {pending ? pendingLabel : children}
    </AriaButton>
  );
}
