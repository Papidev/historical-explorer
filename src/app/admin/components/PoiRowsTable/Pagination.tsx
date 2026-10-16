import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { IconButton } from "../../../components/ui/IconButton";

export const Pagination = ({
  page,
  totalRows,
  onPageChange,
  label = "POIs",
  disabled = false,
}: {
  label?: "POIs" | "People";
  disabled?: boolean;
  page: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}) => (
  <nav
    aria-label={label === "People" ? "People pagination" : "POI pagination"}
    className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-4 py-1.5 text-xs text-gray-600"
  >
    <p aria-live="polite">
      Showing {page * 50 + 1}–{Math.min((page + 1) * 50, totalRows)} of {totalRows} {label}
    </p>
    <div className="flex items-center gap-2">
      <IconButton
        label="Previous page"
        size="small"
        disabled={disabled || page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
      </IconButton>
      <span>
        Page {page + 1} of {Math.ceil(totalRows / 50)}
      </span>
      <IconButton
        label="Next page"
        size="small"
        disabled={disabled || (page + 1) * 50 >= totalRows}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon />
      </IconButton>
    </div>
  </nav>
);
