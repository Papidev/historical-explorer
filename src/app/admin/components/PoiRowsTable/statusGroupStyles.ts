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
    filter: "border-amber-200 bg-amber-50 text-amber-900",
    checkbox: "accent-amber-600",
  },
  complete: {
    label: "Complete",
    row: "bg-lime-50 hover:bg-lime-100/70",
    filter: "border-emerald-200 bg-emerald-50 text-emerald-900",
    checkbox: "accent-emerald-600",
  },
  "needs-source": {
    label: "Needs source",
    row: "bg-slate-100 hover:bg-slate-200/70",
    filter: "border-sky-200 bg-sky-50 text-sky-900",
    checkbox: "accent-sky-600",
  },
} as const;
