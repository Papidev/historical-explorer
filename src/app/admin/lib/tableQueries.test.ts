import { describe, expect, it } from "vitest";
import { getPeopleTablePage, getPoiTablePage, readTableQuery } from "./tableQueries";
import type { AdminPerson, AdminPoiRow } from "./types";

const rows: AdminPoiRow[] = Array.from({ length: 105 }, (_, index) => ({
  id: `poi-${index}`,
  rawPoi: { id: `poi-${index}`, name: `Place ${index}`, featureIndex: index },
  lastGenerationAt: index ? new Date(Date.UTC(2026, 0, index)).toISOString() : undefined,
  ...(index === 104 ? { sourcePending: true } : {}),
}));

describe("server POI pages", () => {
  it("sorts globally before selecting a page and keeps undated rows last in either direction", () => {
    const newest = getPoiTablePage(
      rows,
      readTableQuery({ poiSort: "newest", poiPage: "2" }, "poi"),
    );
    expect(newest.items).toHaveLength(50);
    expect(newest.items[0].id).toBe("poi-54");
    expect(newest.filteredTotal).toBe(105);
    expect(
      getPoiTablePage(rows, readTableQuery({ poiSort: "newest", poiPage: "3" }, "poi")).items.at(-1)
        ?.id,
    ).toBe("poi-0");
    expect(
      getPoiTablePage(rows, readTableQuery({ poiSort: "oldest", poiPage: "3" }, "poi")).items.at(-1)
        ?.id,
    ).toBe("poi-0");
    expect(rows[0].id).toBe("poi-0");
  });

  it("searches and filters all rows before pagination, including generated names", () => {
    const catalog = [
      ...rows,
      {
        id: "renamed",
        rawPoi: { id: "renamed", name: "Old name", featureIndex: 105 },
        transformedPoi: { id: "renamed", name: "New name", featureIndex: 105 },
      },
    ];
    const found = getPoiTablePage(
      catalog,
      readTableQuery({ poiSearch: "  nEw NaMe  ", poiPage: "99" }, "poi"),
    );
    expect(found.items.map(({ id }) => id)).toEqual(["renamed"]);
    expect(found.query.page).toBe(0);
    expect(found.total).toBe(106);
    expect(found.filteredTotal).toBe(1);
    expect(
      getPoiTablePage(rows, readTableQuery({ poiStatuses: "needs-source" }, "poi")).items.map(
        ({ id }) => id,
      ),
    ).toEqual(["poi-104"]);
    expect(getPoiTablePage(rows, readTableQuery({ poiStatuses: "" }, "poi")).filteredTotal).toBe(0);
  });

  it("normalizes invalid URL values and clamps oversized and empty pages", () => {
    expect(
      readTableQuery({ poiPage: "-5", poiSearch: ["ambiguous"], poiSort: "unsupported" }, "poi"),
    ).toMatchObject({ page: 0, search: "", sort: "default" });
    const last = getPoiTablePage(
      rows,
      readTableQuery({ poiPage: "99999999999999999999999" }, "poi"),
    );
    expect(last.items).toHaveLength(5);
    expect(last.query.page).toBe(2);
    expect(getPoiTablePage([], readTableQuery({ poiPage: "4" }, "poi"))).toMatchObject({
      items: [],
      total: 0,
      filteredTotal: 0,
      query: { page: 0 },
    });
  });
});

describe("server People pages", () => {
  const people: AdminPerson[] = Array.from({ length: 65 }, (_, index) => ({
    id: `person-${index}`,
    name: `Person ${String(64 - index).padStart(2, "0")}`,
    description: ["First paragraph", "Second paragraph"],
    curiosities: [],
    linkedPois: [{ id: "off-page-poi", name: "Linked POI outside the visible page" }],
  }));

  it("sorts all People alphabetically before paginating and retains their complete POI links", () => {
    const page = getPeopleTablePage(people, readTableQuery({ peoplePage: "2" }, "people"));
    expect(page.items).toHaveLength(15);
    expect(page.items[0].name).toBe("Person 50");
    expect(page.items[0].linkedPois).toEqual(people[0].linkedPois);
    expect(page.total).toBe(65);
  });

  it("searches beyond the first page independently of POI parameters", () => {
    const page = getPeopleTablePage(
      people,
      readTableQuery(
        { peopleSearch: " pErSoN 64 ", peoplePage: "2", poiSearch: "unrelated", poiPage: "9" },
        "people",
      ),
    );
    expect(page.items.map(({ name }) => name)).toEqual(["Person 64"]);
    expect(page.query.page).toBe(0);
    expect(page.filteredTotal).toBe(1);
    expect(
      getPeopleTablePage(people, readTableQuery({ peopleSearch: "absent" }, "people")).items,
    ).toEqual([]);
  });
});
