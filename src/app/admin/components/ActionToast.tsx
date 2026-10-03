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
    };
  }
  if (details.includes("source-not-found")) {
    return {
      tone: "warning",
      title: "Story waiting for a source",
      description: "No unambiguous English or Italian Wikipedia page was found for this POI.",
    };
  }
  if (details.includes("sources-unavailable")) {
    return {
      tone: "error",
      title: "Source acquisition failed",
      description: "A usable Wikipedia source could not be retrieved for this POI.",
    };
  }
  if (details.includes("story-content-generation-failed") || details.includes("ZodError")) {
    return {
      tone: "error",
      title: "Content generation failed",
      description: "The AI-generated Story or Person content could not be generated or validated.",
    };
  }
  if (details.includes("main-image-candidates-generation-failed")) {
    return {
      tone: "error",
      title: "Image generation failed",
      description: "Wikimedia image candidates could not be retrieved or processed.",
    };
  }
  if (details.includes("persistence-failed")) {
    return {
      tone: "error",
      title: "Save failed",
      description: "The generated content could not be saved safely.",
    };
  }
  if (details.includes("point-of-interest-not-found")) {
    return {
      tone: "error",
      title: "POI not found",
      description: "The requested POI is no longer available.",
    };
  }

  return {
    tone: "error",
    title: "Action failed",
    description: "An unexpected error interrupted the requested action.",
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
      className={`fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-xl items-start gap-5 rounded-xl border-2 bg-white px-5 py-4 text-base shadow-2xl sm:px-6 sm:py-5 ${
        isWarning ? "border-amber-300 text-amber-950" : "border-red-300 text-red-950"
      }`}
    >
      <div className="flex-1">
        <p className="text-lg font-bold">{toast.title}</p>
        {toast.description ? <p className="mt-1 leading-6">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        className={`-m-1 cursor-pointer rounded p-2 text-2xl leading-none ${
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
