import type { ReactNode } from "react";

export const PipelineCell = ({
  children,
  available = false,
  inProgress = false,
}: {
  children: ReactNode;
  available?: boolean;
  inProgress?: boolean;
}) => (
  <td
    className={`h-px min-w-0 border-r px-3 py-2 align-top transition-colors first:pl-4 last:pr-4 ${
      inProgress
        ? "border-y border-amber-300 bg-amber-50 first:border-l last:border-r"
        : `border-gray-100 last:border-r-0 ${available ? "bg-teal-50/40" : ""}`
    }`}
  >
    <div className="flex h-full min-h-32 min-w-0 flex-col">{children}</div>
  </td>
);
