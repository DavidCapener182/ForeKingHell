"use client";

import { useRef, useState, type ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmSubmitButtonProps = ComponentProps<typeof Button> & {
  confirmMessage: string;
  confirmTitle?: string;
  confirmActionLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({
  confirmMessage,
  confirmTitle = "Confirm action",
  confirmActionLabel = "Confirm",
  cancelLabel = "Cancel",
  pendingLabel = "Working…",
  onClick,
  type = "submit",
  ...props
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmedClickRef = useRef(false);
  const { pending } = useFormStatus();

  function submitConfirmedAction() {
    if (pending || props.disabled || !buttonRef.current) return;
    setOpen(false);
    confirmedClickRef.current = true;
    buttonRef.current?.click();
  }

  return (
    <>
      <Button
        {...props}
        ref={buttonRef}
        type={type}
        aria-busy={pending || undefined}
        aria-disabled={pending || props.disabled || undefined}
        data-confirm-submit="true"
        data-confirm-message={confirmMessage}
        onClick={(event) => {
          if (pending) {
            event.preventDefault();
            return;
          }
          if (confirmedClickRef.current) {
            confirmedClickRef.current = false;
            onClick?.(event);
            if (type === "submit" && !event.defaultPrevented) {
              event.preventDefault();
              buttonRef.current?.form?.requestSubmit(buttonRef.current);
            }
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          const form = buttonRef.current?.form;
          if (
            type === "submit" &&
            form &&
            !props.formNoValidate &&
            !form.noValidate &&
            !form.reportValidity()
          )
            return;
          setOpen(true);
        }}
      >
        {pending ? pendingLabel : props.children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]">
              <AlertTriangle className="size-5" aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={submitConfirmedAction}>
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
