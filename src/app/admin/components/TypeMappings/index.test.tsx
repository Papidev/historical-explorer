// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { useState, useRef } from "react";
import { cleanup, render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createPoiTypeMappings } from "@/server/poiTypeMappings";
import { createPoiCategoriesForCity } from "@/server/poiCategories";
import { TypeMappings } from ".";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "curator-mappings-"));
  writeFileSync(
    path.join(directory, "poi-type-category-map.json"),
    JSON.stringify({ version: 1, mappings: { Q16970: ["Church"] } }),
  );
  for (const city of ["rome", "florence"]) {
    mkdirSync(path.join(directory, city, "pois"), { recursive: true });
    mkdirSync(path.join(directory, city, "generated", "wikidata"), { recursive: true });
    writeFileSync(
      path.join(directory, city, "pois", "pois.geojson"),
      JSON.stringify({
        features: [
          { id: "church", wikidataId: "Q1", properties: { name: `${city} church` } },
          { id: "missing", properties: { name: `${city} missing types` } },
        ],
      }),
    );
    writeFileSync(
      path.join(directory, city, "generated", "wikidata", "church.json"),
      JSON.stringify({ types: [{ id: "Q16970", label: "church building" }] }),
    );
    createPoiCategoriesForCity(city, directory).rebuild();
  }
});
afterEach(() => {
  cleanup();
  rmSync(directory, { recursive: true, force: true });
});

const CatalogProvider = () => {
  const repository = createPoiTypeMappings(directory);
  const [catalog, setCatalog] = useState(() => repository.getCatalog());
  const aiSelectionRef = useRef({ mode: "cloud" as const, model: "selected-model" });
  return (
    <TypeMappings
      catalog={catalog}
      aiSelectionRef={aiSelectionRef}
      saveRule={async (id, categories) => {
        const result = repository.save(id, categories);
        setCatalog(repository.getCatalog());
        return result;
      }}
      categoryActions={{
        move: async (id, parent) => {
          const result = repository.moveCategory(id, parent);
          setCatalog(repository.getCatalog());
          return result;
        },
        save: async (id, name) => {
          const result = repository.saveCategory(id, name);
          setCatalog(repository.getCatalog());
          return result;
        },
        delete: async (id) => {
          const result = repository.deleteCategory(id);
          setCatalog(repository.getCatalog());
          return result;
        },
      }}
      classifyRules={async (form) => {
        const result = await repository.classify({
          mode: form.get("aiMode") as "cloud",
          model: String(form.get("aiModel")),
          provider: "ollama",
        });
        setCatalog(repository.getCatalog());
        return result;
      }}
    />
  );
};

it("lets the Curator assign several categories, reload, ignore and clear a shared rule across cities", async () => {
  const user = userEvent.setup();
  const view = render(<CatalogProvider />);
  await user.click(screen.getByRole("checkbox", { name: "Museum" }));
  await user.click(screen.getByRole("button", { name: "Save categories" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Updated 2 POIs across 2 cities");
  expect(screen.getByRole("checkbox", { name: "Church" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Museum" })).toBeChecked();
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().church).toEqual([
      "Church",
      "Churches & cathedrals",
      "Museum",
    ]);
  view.unmount();
  render(<CatalogProvider />);
  expect(screen.getByRole("checkbox", { name: "Museum" })).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Ignore type" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Rule saved");
  expect(screen.queryByRole("region", { name: "Edit church building" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", { name: "Show ignored types" }));
  expect(
    within(screen.getByRole("region", { name: "Edit church building" })).getByText(/Ignored/),
  ).toBeInTheDocument();
  expect(screen.getByText(/1 types · 0 unmapped/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear rule" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Rule saved");
  expect(await screen.findByText(/1 types · 1 unmapped/)).toBeInTheDocument();
  expect(createPoiTypeMappings(directory).getCatalog().types[0].categories).toBeUndefined();
  expect(
    JSON.parse(readFileSync(path.join(directory, "poi-type-category-map.json"), "utf-8")).mappings,
  ).not.toHaveProperty("Q16970");
  await user.click(screen.getByText("Missing POI types (2)"));
  expect(screen.getByText("rome missing types")).toBeVisible();
  expect(screen.getByText("florence missing types")).toBeVisible();
  await user.type(screen.getByRole("textbox", { name: "Search types" }), "not a type");
  expect(screen.getByText("No matching types.")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Edit church building" })).not.toBeInTheDocument();
});

it("keeps an unsaved selection available for retry when saving fails", async () => {
  const user = userEvent.setup();
  render(<CatalogProvider />);
  await user.click(screen.getByRole("checkbox", { name: "Museum" }));
  writeFileSync(path.join(directory, "rome", "pois", "categories.json"), "invalid json");
  await user.click(screen.getByRole("button", { name: "Save categories" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("checkbox", { name: "Museum" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Save categories" })).toBeEnabled();
  expect(createPoiTypeMappings(directory).getCatalog().types[0].categories).toEqual(["Church"]);
});

it("automatically creates a shared category with the selected AI, then lets the Curator rename and delete it", async () => {
  for (const city of ["rome", "florence"]) {
    const file = path.join(directory, city, "pois", "pois.geojson");
    const catalog = JSON.parse(readFileSync(file, "utf-8"));
    catalog.features.push({ id: "tower", wikidataId: "Q2", properties: { name: `${city} tower` } });
    writeFileSync(file, JSON.stringify(catalog));
    writeFileSync(
      path.join(directory, city, "generated", "wikidata", "tower.json"),
      JSON.stringify({ types: [{ id: "Q12518", label: "tower" }] }),
    );
  }
  const server = setupServer(
    http.post("http://localhost:11434/api/chat", async ({ request }) => {
      expect(((await request.json()) as { model: string }).model).toBe("selected-model");
      return HttpResponse.json({
        message: {
          content: JSON.stringify({
            rules: [
              {
                id: "Q12518",
                decision: "mapped",
                categoryIds: [],
                newCategoryNames: ["Tower"],
                reason: "A distinct architectural type.",
              },
            ],
          }),
        },
      });
    }),
  );
  server.listen({ onUnhandledRequest: "error" });
  try {
    const user = userEvent.setup();
    render(<CatalogProvider />);
    await user.click(screen.getByRole("button", { name: "Classify unmapped types" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Classified 1 types, created 1 categories, and updated 2 POIs",
    );
    await user.click(
      within(screen.getByRole("navigation", { name: "Acquired types" })).getByRole("button", {
        name: /^tower/,
      }),
    );
    expect(screen.getByRole("checkbox", { name: "Tower" })).toBeChecked();
    expect(screen.queryByText("A distinct architectural type.")).not.toBeInTheDocument();
    await user.click(screen.getByText("Manage categories (13)"));
    await user.clear(screen.getByRole("textbox", { name: "Name for Tower" }));
    await user.type(screen.getByRole("textbox", { name: "Name for Tower" }), "Observation tower");
    await user.click(screen.getByRole("button", { name: "Rename Tower" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Category saved");
    expect(await screen.findByRole("checkbox", { name: "Observation tower" })).toBeChecked();
    for (const city of ["rome", "florence"])
      expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual(["Tower"]);
    await user.click(
      within(screen.getByRole("listitem", { name: "Category Observation tower" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );
    expect(screen.getByRole("dialog", { name: "Confirm delete" })).toHaveTextContent(
      "Its child categories will also be deleted",
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Category deleted");
    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: "Observation tower" })).not.toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("navigation", { name: "Acquired types" })).getByRole("button", {
        name: /^tower/,
      }),
    ).toHaveTextContent("Unmapped");
    for (const city of ["rome", "florence"])
      expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual([]);
  } finally {
    server.close();
  }
});

it("shows two category levels and saves all children when their parent is selected", async () => {
  const user = userEvent.setup();
  const view = render(<CatalogProvider />);
  const children = screen.getByRole("group", { name: "Child categories of Churches & cathedrals" });
  expect(within(children).getByRole("checkbox", { name: "Church" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
  await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
  for (const name of ["Church", "Basilica", "Cathedral"])
    expect(within(children).getByRole("checkbox", { name })).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Save categories" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Updated 2 POIs");
  expect(createPoiTypeMappings(directory).getCatalog().types[0].categories).toEqual([
    "Churches & cathedrals",
    "Cathedral",
    "Basilica",
    "Church",
  ]);
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().church).toEqual(
      expect.arrayContaining(["Churches & cathedrals", "Church", "Basilica", "Cathedral"]),
    );
  view.unmount();
  render(<CatalogProvider />);
  expect(screen.getByRole("checkbox", { name: "Cathedral" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Basilica" }));
  expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Church" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Cathedral" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
  for (const name of ["Church", "Basilica", "Cathedral"])
    expect(screen.getByRole("checkbox", { name })).not.toBeChecked();
  await user.click(screen.getByText("Manage categories (12)"));
  expect(
    within(
      screen.getByRole("list", { name: "Child categories of Churches & cathedrals" }),
    ).getByRole("textbox", { name: "Name for Cathedral" }),
  ).toBeVisible();
});

it("expands a parent-only assignment before persisting it across cities", () => {
  createPoiTypeMappings(directory).save("Q16970", ["Churches & cathedrals"]);
  expect(createPoiTypeMappings(directory).getCatalog().types[0].categories).toEqual([
    "Churches & cathedrals",
    "Cathedral",
    "Basilica",
    "Church",
  ]);
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().church).toEqual([
      "Churches & cathedrals",
      "Cathedral",
      "Basilica",
      "Church",
    ]);
});

it("assigns a child's parent without its siblings and preserves that subset after saving", async () => {
  const user = userEvent.setup();
  const view = render(<CatalogProvider />);
  await user.click(screen.getByRole("checkbox", { name: "Churches & cathedrals" }));
  await user.click(screen.getByRole("checkbox", { name: "Basilica" }));
  expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Church" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Cathedral" })).not.toBeChecked();
  await user.click(screen.getByRole("button", { name: "Save categories" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Rule saved");
  expect(createPoiTypeMappings(directory).getCatalog().types[0].categories).toEqual([
    "Basilica",
    "Churches & cathedrals",
  ]);
  view.unmount();
  render(<CatalogProvider />);
  expect(screen.getByRole("checkbox", { name: "Basilica" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Church" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Cathedral" })).not.toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Basilica" }));
  expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).not.toBeChecked();
});

it("moves a child into another parent by drag and drop and retains its saved assignments", async () => {
  const user = userEvent.setup();
  const view = render(<CatalogProvider />);
  await user.click(screen.getByText("Manage categories (12)"));
  expect(screen.queryByText("Parent for Church")).not.toBeInTheDocument();
  fireEvent.dragStart(screen.getByRole("button", { name: "Drag Church" }), {
    dataTransfer: { setData: () => {}, effectAllowed: "move" },
  });
  fireEvent.dragOver(screen.getByRole("listitem", { name: "Category Museum" }), {
    dataTransfer: { dropEffect: "move" },
  });
  fireEvent.drop(screen.getByRole("listitem", { name: "Category Museum" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Category moved");
  expect(
    within(await screen.findByRole("list", { name: "Child categories of Museum" })).getByRole(
      "textbox",
      { name: "Name for Church" },
    ),
  ).toBeVisible();
  expect(screen.getByRole("checkbox", { name: "Church" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Museum" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Churches & cathedrals" })).not.toBeChecked();
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().church).toEqual([
      "Church",
      "Museum",
    ]);
  view.unmount();
  render(<CatalogProvider />);
  await user.click(screen.getByText("Manage categories (12)"));
  expect(
    within(screen.getByRole("list", { name: "Child categories of Museum" })).getByRole("button", {
      name: "Drag Church",
    }),
  ).toBeVisible();
  fireEvent.dragStart(screen.getByRole("button", { name: "Drag Church" }), {
    dataTransfer: { setData: () => {}, effectAllowed: "move" },
  });
  fireEvent.drop(screen.getByRole("group", { name: "Top-level category drop area" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("list", { name: "Child categories of Museum" }),
    ).not.toBeInTheDocument(),
  );
  expect(createPoiTypeMappings(directory).getCatalog().types[0].categories).toEqual(["Church"]);
  expect(screen.getByRole("checkbox", { name: "Museum" })).not.toBeChecked();
});

it("cancels deletion through the admin confirmation modal without changing the category", async () => {
  const user = userEvent.setup();
  render(<CatalogProvider />);
  await user.click(screen.getByText("Manage categories (12)"));
  await user.click(
    within(screen.getByRole("listitem", { name: "Category Museum" })).getByRole("button", {
      name: "Delete",
    }),
  );
  expect(screen.getByRole("dialog", { name: "Confirm delete" })).toHaveTextContent(
    "Remove Museum from all type rules and POIs?",
  );
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    createPoiTypeMappings(directory)
      .getCatalog()
      .categories?.some((category) => category.id === "Museum"),
  ).toBe(true);
  await user.click(
    within(screen.getByRole("listitem", { name: "Category Museum" })).getByRole("button", {
      name: "Delete",
    }),
  );
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
