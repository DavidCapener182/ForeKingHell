"use client";

import { useRef, useState, type ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 text-left">
                <DialogTitle>{confirmTitle}</DialogTitle>
                <DialogDescription className="mt-2 leading-6">{confirmMessage}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <Button type="button" variant="destructive" onClick={submitConfirmedAction}>
              {confirmActionLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
