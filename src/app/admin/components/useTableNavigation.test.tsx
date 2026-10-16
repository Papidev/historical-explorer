// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { useTableNavigation } from "./useTableNavigation";
import { readTableQuery, type TableQuery } from "../lib/tableQueries";

afterEach(cleanup);

const Controls = ({ query, prefix }: { query: TableQuery; prefix: "poi" | "people" }) => {
  const navigation = useTableNavigation(query, prefix);
  return (
    <>
      <label>
        Search
        <input
          value={navigation.query.search}
          onChange={(event) => navigation.update({ search: event.target.value })}
        />
      </label>
      <button onClick={() => navigation.update({ page: navigation.query.page + 1 })}>
        Next page
      </button>
      <button onClick={() => navigation.update({ sort: "newest" })}>Newest first</button>
      <button onClick={() => navigation.update({ statuses: [] })}>Clear statuses</button>
    </>
  );
};

const NavigationFixture = ({ prefix }: { prefix: "poi" | "people" }) => {
  const [url, setUrl] = useState(
    "/admin?section=people&poiPage=3&poiSearch=Ostia&poiSort=oldest&peoplePage=2&peopleSearch=Hadrian",
  );
  const params = new URL(url, "http://localhost").searchParams;
  return (
    <AppRouterContext.Provider
      value={{
        back: () => {},
        forward: () => {},
        refresh: () => {},
        push: setUrl,
        replace: setUrl,
        prefetch: () => {},
        bfcacheId: "test",
      }}
    >
      <SearchParamsContext.Provider value={params}>
        <output aria-label="Current URL">{url}</output>
        <Controls query={readTableQuery(Object.fromEntries(params), prefix)} prefix={prefix} />
      </SearchParamsContext.Provider>
    </AppRouterContext.Provider>
  );
};

it.each(["poi", "people"] as const)(
  "stores %s controls in the URL while preserving the other table",
  async (prefix) => {
    const user = userEvent.setup();
    render(<NavigationFixture prefix={prefix} />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      `${prefix}Page=${prefix === "poi" ? "4" : "3"}`,
    );
    await user.clear(screen.getByRole("textbox", { name: "Search" }));
    await user.type(screen.getByRole("textbox", { name: "Search" }), "Rome & Ostia");
    const params = new URL(screen.getByLabelText("Current URL").textContent!, "http://localhost")
      .searchParams;
    expect(params.get(`${prefix}Search`)).toBe("Rome & Ostia");
    expect(params.get(`${prefix}Page`)).toBe("1");
    expect(params.get("section")).toBe("people");
    expect(params.get(prefix === "poi" ? "peopleSearch" : "poiSearch")).toBe(
      prefix === "poi" ? "Hadrian" : "Ostia",
    );
    expect(params.get(prefix === "poi" ? "peoplePage" : "poiPage")).toBe(
      prefix === "poi" ? "2" : "3",
    );
    if (prefix === "poi") {
      await user.click(screen.getByRole("button", { name: "Newest first" }));
      await user.click(screen.getByRole("button", { name: "Clear statuses" }));
      const updated = new URL(screen.getByLabelText("Current URL").textContent!, "http://localhost")
        .searchParams;
      expect(updated.get("poiSort")).toBe("newest");
      expect(updated.get("poiStatuses")).toBe("");
    }
  },
);
