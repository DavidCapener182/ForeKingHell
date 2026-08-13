"use client";

import { useRef, useState, type ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";

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
};

export function ConfirmSubmitButton({
  confirmMessage,
  confirmTitle = "Confirm action",
  confirmActionLabel = "Confirm",
  cancelLabel = "Cancel",
  onClick,
  type = "submit",
  ...props
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmedClickRef = useRef(false);

  function submitConfirmedAction() {
    setOpen(false);

    if (type === "submit") {
      buttonRef.current?.form?.requestSubmit(buttonRef.current);
      return;
    }

    confirmedClickRef.current = true;
    buttonRef.current?.click();
  }

  return (
    <>
      <Button
        {...props}
        ref={buttonRef}
        type={type}
        data-confirm-submit="true"
        data-confirm-message={confirmMessage}
        onClick={(event) => {
          if (confirmedClickRef.current) {
            confirmedClickRef.current = false;
            onClick?.(event);
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          setOpen(true);
        }}
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
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
