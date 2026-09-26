"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useEffect, useState } from "react";
import type { AiProgress } from "@/server/aiProgress";

export const AiProgressDialog = ({
  runId,
  title,
  isFinished,
  onClose,
}: {
  runId: string;
  title: string;
  isFinished: boolean;
  onClose: () => void;
}) => {
  const [progress, setProgress] = useState<AiProgress>();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/ai-progress/${runId}`, { cache: "no-store" });
        if (response.ok && active) setProgress((await response.json()) as AiProgress);
      } catch {
        // The action may not have created its progress file yet.
      }
    };
    void poll();
    const interval = setInterval(() => {
      setNow(Date.now());
      void poll();
    }, 1_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [runId]);

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
          <DialogTitle className="text-base font-semibold text-gray-900">{title}</DialogTitle>
          <p className="mt-1 text-sm text-gray-600">
            {isFinished
              ? "Generation finished. Review the events below."
              : `Working for ${Math.floor((now - startedAt) / 1_000)} seconds.`}
          </p>
          <ol
            role="log"
            aria-live="polite"
            className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3"
          >
            {progress?.entries.length ? (
              progress.entries.map(({ at, message }, index) => (
                <li key={`${at}-${index}`} className="flex gap-3 text-sm text-gray-800">
                  <time className="shrink-0 font-mono text-xs text-gray-500">
                    {new Date(at).toLocaleTimeString()}
                  </time>
                  <span>{message}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500">Starting generation...</li>
            )}
          </ol>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {isFinished ? "Close" : "Hide"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};
