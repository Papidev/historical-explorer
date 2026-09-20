import type { ReactNode } from "react";

export const PipelineCell = ({
  children,
  available = false,
}: {
  children: ReactNode;
  available?: boolean;
}) => (
  <td
    className={`h-px min-w-0 border-r border-gray-100 px-3 py-2 align-top first:pl-4 last:border-r-0 last:pr-4 ${
      available ? "bg-teal-50/40" : ""
    }`}
  >
    <div className="flex h-full min-h-32 min-w-0 flex-col">{children}</div>
  </td>
);
