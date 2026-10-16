import { useState, type ComponentProps } from "react";
import { PoiRowsTable as Table } from "./index";
import { getPoiTablePage, readTableQuery } from "../../lib/tableQueries";
import type { AdminPoiRow } from "../../lib/types";

// Supply server-selected pages while exercising the real table controls.
export const PoiRowsTable = ({
  rows,
  ...props
}: Omit<
  ComponentProps<typeof Table>,
  "rows" | "pagination" | "onQueryChange" | "generationRows"
> & { rows: AdminPoiRow[] }) => {
  const [query, setQuery] = useState(readTableQuery({}, "poi"));
  const pagination = getPoiTablePage(rows, query);
  return (
    <Table
      {...props}
      rows={pagination.items}
      pagination={pagination}
      generationRows={rows
        .filter((row) => row.rawPoi && !row.storyContent)
        .map(({ id, rawPoi }) => ({ id, rawPoi }))}
      onQueryChange={(change) =>
        setQuery({ ...pagination.query, ...change, page: change.page ?? 0 })
      }
    />
  );
};
