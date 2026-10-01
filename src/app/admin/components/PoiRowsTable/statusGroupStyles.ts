export const statusGroupStyles = {
  "needs-attention": {
    label: "Needs attention",
    row: "bg-rose-50 hover:bg-rose-100/70",
    filter: "border-rose-200 bg-rose-50 text-rose-900",
    checkbox: "accent-rose-600",
  },
  "to-do": {
    label: "To do",
    row: "bg-white hover:bg-gray-50",
    filter: "border-gray-200 bg-white text-gray-700",
    checkbox: "accent-gray-600",
  },
  complete: {
    label: "Complete",
    row: "bg-lime-50 hover:bg-lime-100/70",
    filter: "border-lime-200 bg-lime-50 text-lime-900",
    checkbox: "accent-lime-600",
  },
  "needs-source": {
    label: "Needs source",
    row: "bg-slate-100 hover:bg-slate-200/70",
    filter: "border-slate-200 bg-slate-100 text-slate-800",
    checkbox: "accent-slate-600",
  },
} as const;
