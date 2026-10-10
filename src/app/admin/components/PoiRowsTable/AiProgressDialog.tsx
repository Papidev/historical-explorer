"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { AiProgressLog } from "./AiProgressLog";
import { useAiProgress } from "./useAiProgress";

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
}) => (
  <Dialog open onClose={onClose} className="relative z-50">
    <DialogBackdrop className="fixed inset-0 bg-black/35" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <DialogTitle className="text-base font-semibold text-gray-900">{title}</DialogTitle>
        <AiProgressLog state={useAiProgress({ runId, isFinished })} />
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
