"use client";

import { useFormStatus } from "react-dom";

export const SubmitButton = ({
  idleLabel,
  pendingLabel,
  tone = "primary",
}: {
  idleLabel: string;
  pendingLabel: string;
  tone?: "primary" | "danger";
}) => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "border border-red-700/20 bg-red-700 hover:bg-red-700/90"
          : "border border-black/15 bg-black hover:bg-black/85"
      }`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
};
