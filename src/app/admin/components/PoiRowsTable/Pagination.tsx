import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { IconButton } from "../../../components/ui/IconButton";

export const Pagination = ({
  page,
  totalRows,
  onPageChange,
}: {
  page: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}) => (
  <nav
    aria-label="POI pagination"
    className="flex items-center justify-between gap-4 border-t border-gray-200 px-4 py-3 text-sm text-gray-600"
  >
    <p aria-live="polite">
      Showing {page * 50 + 1}–{Math.min((page + 1) * 50, totalRows)} of {totalRows} POIs
    </p>
    <div className="flex items-center gap-3">
      <IconButton
        label="Previous page"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
      </IconButton>
      <span>
        Page {page + 1} of {Math.ceil(totalRows / 50)}
      </span>
      <IconButton
        label="Next page"
        disabled={(page + 1) * 50 >= totalRows}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon />
      </IconButton>
    </div>
  </nav>
);
