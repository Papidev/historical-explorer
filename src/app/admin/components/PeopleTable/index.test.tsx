// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { PeopleTable } from "./index";
import { getPeopleTablePage, readTableQuery } from "../../lib/tableQueries";
import type { AdminPerson } from "../../lib/types";

afterEach(cleanup);

const PeoplePage = () => {
  const [query, setQuery] = useState(readTableQuery({}, "people"));
  const page = getPeopleTablePage(
    Array.from(
      { length: 65 },
      (_, index): AdminPerson => ({
        id: `person-${index}`,
        name: `Person ${String(index).padStart(2, "0")}`,
        description: ["A description", "Another paragraph"],
        curiosities: [],
        linkedPois: [{ id: "somewhere", name: "Somewhere" }],
      }),
    ),
    query,
  );
  return (
    <PeopleTable
      people={page.items}
      pagination={page}
      aiSelectionRef={{ current: { mode: "local", provider: "ollama", model: "test" } }}
      regeneratePersonAction={async () => {}}
      onQueryChange={(change) => setQuery({ ...page.query, ...change, page: change.page ?? 0 })}
    />
  );
};

it("navigates server-selected People pages, searches globally and opens full Person details", async () => {
  const user = userEvent.setup();
  render(<PeoplePage />);
  expect(screen.getByText("Showing 1–50 of 65 People")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Person 64" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByText("Showing 51–65 of 65 People")).toBeVisible();
  await user.type(screen.getByRole("searchbox", { name: "Search People by name" }), "person 64");
  expect(screen.getByText("Showing 1–1 of 1 People")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Person 64" }));
  expect(within(screen.getByRole("dialog")).getByText("Somewhere")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Close/ }));
  await user.clear(screen.getByRole("searchbox", { name: "Search People by name" }));
  expect(screen.getByText("Showing 1–50 of 65 People")).toBeVisible();
});
