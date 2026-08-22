"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  onClick,
  onKeyDown,
  onKeyUp,
  onPointerDown,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  const [motionReady, setMotionReady] = React.useState(false);
  const keyboardActivationRef = React.useRef(false);
  const keyboardResetTimerRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (keyboardResetTimerRef.current !== null) {
        window.clearTimeout(keyboardResetTimerRef.current);
      }
    },
    [],
  );

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      data-motion-ready={motionReady ? "true" : "false"}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) {
          if (keyboardResetTimerRef.current !== null) {
            window.clearTimeout(keyboardResetTimerRef.current);
            keyboardResetTimerRef.current = null;
          }
          keyboardActivationRef.current = false;
          setMotionReady(true);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && (event.key === " " || event.key === "Enter")) {
          if (keyboardResetTimerRef.current !== null) {
            window.clearTimeout(keyboardResetTimerRef.current);
            keyboardResetTimerRef.current = null;
          }
          keyboardActivationRef.current = true;
          setMotionReady(false);
        }
      }}
      onKeyUp={(event) => {
        onKeyUp?.(event);
        if (!event.defaultPrevented && (event.key === " " || event.key === "Enter")) {
          keyboardResetTimerRef.current = window.setTimeout(() => {
            keyboardActivationRef.current = false;
            keyboardResetTimerRef.current = null;
          }, 0);
        }
      }}
      onClick={(event) => {
        const keyboardActivation = keyboardActivationRef.current;
        if (keyboardResetTimerRef.current !== null) {
          window.clearTimeout(keyboardResetTimerRef.current);
          keyboardResetTimerRef.current = null;
        }
        keyboardActivationRef.current = false;
        onClick?.(event);
        if (!event.defaultPrevented && !keyboardActivation) setMotionReady(true);
      }}
      className={cn(
        "t-toggle peer group/switch relative inline-flex shrink-0 touch-manipulation items-center rounded-full border border-transparent outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="t-toggle-thumb pointer-events-none block rounded-full bg-background ring-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
