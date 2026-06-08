"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export const SubmitButton = ({
  idleLabel,
  pendingLabel,
  confirmMessage,
  icon,
  tone = "primary",
  disabled = false,
}: {
  idleLabel: string;
  pendingLabel: string;
  confirmMessage?: string;
  icon?: ReactNode;
  tone?: "primary" | "danger";
  disabled?: boolean;
}) => {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isDisabled = pending || disabled;

  useEffect(() => {
    if (isConfirmOpen) {
      dialogRef.current?.focus();
    }
  }, [isConfirmOpen]);

  const confirmSubmit = () => {
    setIsConfirmOpen(false);
    buttonRef.current?.form?.requestSubmit(buttonRef.current);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        disabled={isDisabled}
        onClick={(event) => {
          if (!confirmMessage || isDisabled) {
            return;
          }

          event.preventDefault();
          setIsConfirmOpen(true);
        }}
        aria-label={icon ? idleLabel : undefined}
        title={pending ? pendingLabel : idleLabel}
        className={`inline-flex items-center justify-center text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
          icon
            ? "admin-icon-button rounded-full p-1.5 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2"
            : "rounded-md px-2 py-1 text-xs font-medium"
        } ${
          tone === "danger"
            ? "border border-red-700/20 bg-red-700 hover:bg-red-700/90 focus-visible:outline-red-700"
            : "border border-black/15 bg-black hover:bg-black/85 focus-visible:outline-black"
        }`}
      >
        {icon ?? (pending ? pendingLabel : idleLabel)}
      </button>
      {isConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmSubmit();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setIsConfirmOpen(false);
              }
            }}
            className="w-[min(420px,100%)] rounded-lg border border-black/10 bg-white p-5 shadow-2xl"
          >
            <p id="confirm-action-title" className="text-sm font-semibold text-black">
              Confirm {idleLabel.toLowerCase()}
            </p>
            <p className="mt-2 text-sm leading-6 text-black/70">{confirmMessage}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="inline-flex items-center rounded-md border border-black/15 bg-white px-3 py-1.5 text-xs font-medium text-black transition hover:bg-black/[0.03]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white transition ${
                  tone === "danger"
                    ? "border border-red-700/20 bg-red-700 hover:bg-red-700/90"
                    : "border border-black/15 bg-black hover:bg-black/85"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
