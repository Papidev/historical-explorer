"use client";

import { useEffect } from "react";
import type { AdminActionWarning } from "../lib/types";

export type Toast = AdminActionWarning & { tone: "error" | "warning" };

export const getActionError = (error: unknown): Toast => {
  const details = error instanceof Error ? error.message : "The action failed. Please try again.";

  if (/\b429\b|too many requests/i.test(details)) {
    return {
      tone: "error",
      title: "Service temporarily unavailable",
      description: "An external service rate limit was reached. Wait a few minutes and try again.",
      details,
    };
  }
  if (details.includes("sources-unavailable")) {
    return {
      tone: "error",
      title: "Source acquisition failed",
      description: "A usable Wikipedia source could not be retrieved for this POI.",
      details,
    };
  }
  if (details.includes("story-content-generation-failed") || details.includes("ZodError")) {
    return {
      tone: "error",
      title: "Content generation failed",
      description: "The AI-generated Story or Person content could not be generated or validated.",
      details,
    };
  }
  if (details.includes("main-image-candidates-generation-failed")) {
    return {
      tone: "error",
      title: "Image generation failed",
      description: "Wikimedia image candidates could not be retrieved or processed.",
      details,
    };
  }
  if (details.includes("persistence-failed")) {
    return {
      tone: "error",
      title: "Save failed",
      description: "The generated content could not be saved safely.",
      details,
    };
  }
  if (details.includes("point-of-interest-not-found")) {
    return {
      tone: "error",
      title: "POI not found",
      description: "The requested Point of Interest is no longer available.",
      details,
    };
  }

  return {
    tone: "error",
    title: "Action failed",
    description: "An unexpected error interrupted the requested action.",
    details,
  };
};

export const ActionToast = ({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) => {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 12_000);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  const isWarning = toast.tone === "warning";

  return (
    <div
      role="alert"
      className={`fixed right-4 bottom-4 z-50 flex max-w-md items-start gap-4 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ring-1 ring-black/5 ${
        isWarning ? "border-amber-200 text-amber-900" : "border-red-200 text-red-800"
      }`}
    >
      <div className="flex-1">
        <p className="font-semibold">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 opacity-80">{toast.description}</p> : null}
        {toast.details ? (
          <p className="mt-1 font-mono text-xs break-words opacity-75">{toast.details}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        className={`-m-1 cursor-pointer rounded p-1 ${
          isWarning
            ? "text-amber-800/70 hover:bg-amber-50 hover:text-amber-950"
            : "text-red-700/70 hover:bg-red-50 hover:text-red-900"
        }`}
        onClick={onDismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
};
