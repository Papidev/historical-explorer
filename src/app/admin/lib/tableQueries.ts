import type { AdminPerson, AdminPoiRow } from "./types";
import { getPoiRowStatusGroup } from "./getPoiRowStatusGroup";

export type TableQuery = {
  page: number;
  search: string;
  sort: string;
  statuses: string[];
};

export type TablePage<T> = {
  items: T[];
  total: number;
  filteredTotal: number;
  query: TableQuery;
};

export const readTableQuery = (
  params: Record<string, string | string[] | undefined>,
  prefix: "poi" | "people",
): TableQuery => ({
  page:
    typeof params[`${prefix}Page`] === "string" && /^\d+$/.test(params[`${prefix}Page`] as string)
      ? Math.max(0, Number(params[`${prefix}Page`]) - 1)
      : 0,
  search:
    typeof params[`${prefix}Search`] === "string" ? (params[`${prefix}Search`] as string) : "",
  sort: ["newest", "oldest"].includes(params[`${prefix}Sort`] as string)
    ? (params[`${prefix}Sort`] as string)
    : "default",
  statuses:
    typeof params.poiStatuses === "string"
      ? params.poiStatuses
          .split(",")
          .filter((status) =>
            ["needs-attention", "to-do", "complete", "needs-source"].includes(status),
          )
      : ["needs-attention", "to-do", "complete", "needs-source"],
});

export const getPoiTablePage = (rows: AdminPoiRow[], query: TableQuery): TablePage<AdminPoiRow> => {
  const filtered = rows.filter(
    (row) =>
      query.statuses.includes(getPoiRowStatusGroup(row)) &&
      (!query.search.trim() ||
        [row.rawPoi?.name, row.transformedPoi?.name].some((name) =>
          name?.toLocaleLowerCase("en").includes(query.search.trim().toLocaleLowerCase("en")),
        )),
  );
  if (query.sort !== "default") {
    filtered.sort((left, right) => {
      if (!left.lastGenerationAt) return right.lastGenerationAt ? 1 : 0;
      if (!right.lastGenerationAt) return -1;
      return query.sort === "newest"
        ? Date.parse(right.lastGenerationAt) - Date.parse(left.lastGenerationAt)
        : Date.parse(left.lastGenerationAt) - Date.parse(right.lastGenerationAt);
    });
  }
  const page = Math.min(query.page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  return {
    items: filtered.slice(page * 50, (page + 1) * 50),
    total: rows.length,
    filteredTotal: filtered.length,
    query: { ...query, page },
  };
};

export const getPeopleTablePage = (
  people: AdminPerson[],
  query: TableQuery,
): TablePage<AdminPerson> => {
  const filtered = people
    .filter(({ name }) =>
      name.toLocaleLowerCase("en").includes(query.search.trim().toLocaleLowerCase("en")),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const page = Math.min(query.page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  return {
    items: filtered.slice(page * 50, (page + 1) * 50),
    total: people.length,
    filteredTotal: filtered.length,
    query: { ...query, page },
  };
};
