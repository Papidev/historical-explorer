import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createPoiTypeMappings } from ".";
import { createPoiCategoriesForCity } from "@/server/poiCategories";
import { readPoiCategoryCatalog } from "@/server/poiCategoryCatalog";
import type { AiSelection } from "@/app/admin/lib/aiModels";

const server = setupServer();
let directory: string;
const ai: AiSelection = { mode: "cloud", provider: "ollama", model: "selected-cloud-model" };
const rules = [
  {
    id: "Q12518",
    decision: "mapped",
    categoryIds: [],
    newCategoryNames: ["Tower"],
    reason: "A distinct architectural place type.",
  },
  {
    id: "Q33506",
    decision: "mapped",
    categoryIds: ["Museum"],
    newCategoryNames: [],
    reason: "Matches the existing Museum category.",
  },
];
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "automatic-type-mapping-"));
  writeFileSync(
    path.join(directory, "poi-type-category-map.json"),
    JSON.stringify({
      version: 1,
      mappings: { Q16970: ["Church"], Q999: [] },
      origins: { Q840482: "manual" },
    }),
  );
  for (const city of ["rome", "florence"]) {
    mkdirSync(path.join(directory, city, "pois"), { recursive: true });
    mkdirSync(path.join(directory, city, "generated", "wikidata"), { recursive: true });
    const types = [
      ["tower", "Q12518", "tower"],
      ["museum", "Q33506", "museum"],
      ["church", "Q16970", "church building"],
      ["ignored", "Q999", "administrative type"],
      ["cleared", "Q840482", "shrine"],
    ];
    writeFileSync(
      path.join(directory, city, "pois", "pois.geojson"),
      JSON.stringify({
        features: types.map(([id]) => ({
          id,
          wikidataId: "Q1",
          properties: { name: `${city} ${id}` },
        })),
      }),
    );
    for (const [id, typeId, label] of types)
      writeFileSync(
        path.join(directory, city, "generated", "wikidata", `${id}.json`),
        JSON.stringify({ types: [{ id: typeId, label }] }),
      );
    createPoiCategoriesForCity(city, directory).rebuild();
  }
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.close();
  server.resetHandlers();
  rmSync(directory, { recursive: true, force: true });
});

it("uses the selected AI, reuses categories and creates shared categories only for unmapped types", async () => {
  server.use(
    http.post("http://localhost:11434/api/chat", async ({ request }) => {
      const body = (await request.json()) as {
        model: string;
        messages: Array<{ content: string }>;
      };
      expect(body.model).toBe("selected-cloud-model");
      const prompt = JSON.parse(body.messages[1].content);
      expect(prompt.types.map((type: { id: string }) => type.id).sort()).toEqual([
        "Q12518",
        "Q33506",
      ]);
      expect(prompt.categories.some((category: { id: string }) => category.id === "Museum")).toBe(
        true,
      );
      return HttpResponse.json({ message: { content: JSON.stringify({ rules }) } });
    }),
  );
  const repository = createPoiTypeMappings(directory);
  expect(await repository.classify(ai)).toMatchObject({
    classified: 2,
    createdCategories: 1,
    updatedPois: 4,
  });
  for (const city of ["rome", "florence"]) {
    expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual(["Tower"]);
    expect(createPoiCategoriesForCity(city, directory).getAll().museum).toEqual(["Museum"]);
    createPoiCategoriesForCity(city, directory).rebuild();
    expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual(["Tower"]);
  }
  const reloaded = createPoiTypeMappings(directory).getCatalog();
  expect(reloaded.types.find((type) => type.id === "Q12518")).toMatchObject({
    origin: "automatic",
    reason: rules[0].reason,
    categories: ["Tower"],
  });
  expect(reloaded.types.find((type) => type.id === "Q16970")?.categories).toEqual(["Church"]);
  expect(reloaded.types.find((type) => type.id === "Q999")?.categories).toEqual([]);
  expect(reloaded.types.find((type) => type.id === "Q840482")).toMatchObject({
    origin: "manual",
    categories: undefined,
  });
  expect(await repository.classify(ai)).toMatchObject({ classified: 0, createdCategories: 0 });
});

it("renames without changing identities, deletes across cities and protects corrections from regeneration", async () => {
  const repository = createPoiTypeMappings(directory);
  repository.saveCategory(null, "Tower");
  repository.save("Q12518", ["Tower"]);
  repository.saveCategory("Tower", "Observation tower");
  expect(
    repository.getCatalog().categories?.find((category) => category.id === "Tower")?.name,
  ).toBe("Observation tower");
  expect(repository.getCatalog().types.find((type) => type.id === "Q12518")?.categories).toEqual([
    "Tower",
  ]);
  repository.deleteCategory("Tower");
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual([]);
  expect(repository.getCatalog().types.find((type) => type.id === "Q12518")).toMatchObject({
    origin: "manual",
    categories: undefined,
  });
  expect(readPoiCategoryCatalog(directory).deletedNames).toContain("Observation tower");
  repository.save("Q33506", ["Museum"]);
  expect(await repository.classify(ai)).toMatchObject({ classified: 0 });
  expect(() => repository.saveCategory(null, "museum")).toThrow("already exists");
  expect(() => repository.saveCategory(null, " ")).toThrow("category name");
});

it("keeps manual edits made while the AI is responding", async () => {
  const repository = createPoiTypeMappings(directory);
  server.use(
    http.post("http://localhost:11434/api/chat", () => {
      repository.save("Q12518", []);
      return HttpResponse.json({ message: { content: JSON.stringify({ rules }) } });
    }),
  );
  expect(await repository.classify(ai)).toMatchObject({ classified: 1, createdCategories: 0 });
  expect(repository.getCatalog().types.find((type) => type.id === "Q12518")).toMatchObject({
    categories: [],
    origin: "manual",
  });
  expect(repository.getCatalog().categories?.some((category) => category.name === "Tower")).toBe(
    false,
  );
});

it("leaves uncertain types unmapped and lets the AI explicitly ignore a broad type", async () => {
  server.use(
    http.post("http://localhost:11434/api/chat", () =>
      HttpResponse.json({
        message: {
          content: JSON.stringify({
            rules: [
              { ...rules[0], decision: "unmapped", newCategoryNames: [] },
              { ...rules[1], decision: "ignored", categoryIds: [] },
            ],
          }),
        },
      }),
    ),
  );
  const repository = createPoiTypeMappings(directory);
  expect(await repository.classify(ai)).toMatchObject({ classified: 1 });
  expect(
    repository.getCatalog().types.find((type) => type.id === "Q12518")?.categories,
  ).toBeUndefined();
  expect(repository.getCatalog().types.find((type) => type.id === "Q33506")).toMatchObject({
    categories: [],
    origin: "automatic",
  });
});

it("rejects invalid AI output without changing rules or categories", async () => {
  const before = readFileSync(path.join(directory, "poi-type-category-map.json"), "utf-8");
  server.use(
    http.post("http://localhost:11434/api/chat", () =>
      HttpResponse.json({
        message: {
          content: JSON.stringify({ rules: [{ ...rules[0], categoryIds: ["Unknown"] }, rules[1]] }),
        },
      }),
    ),
  );
  await expect(createPoiTypeMappings(directory).classify(ai)).rejects.toThrow("unknown category");
  expect(readFileSync(path.join(directory, "poi-type-category-map.json"), "utf-8")).toBe(before);
  expect(
    readPoiCategoryCatalog(directory).categories.some((category) => category.id === "Tower"),
  ).toBe(false);
});

it("expands AI parent assignments to the same children as manual assignments", async () => {
  server.use(
    http.post("http://localhost:11434/api/chat", () =>
      HttpResponse.json({
        message: {
          content: JSON.stringify({
            rules: [
              {
                id: "Q12518",
                decision: "mapped",
                categoryIds: ["Churches & cathedrals"],
                newCategoryNames: [],
                reason: "Parent category selected.",
              },
            ],
          }),
        },
      }),
    ),
  );
  const repository = createPoiTypeMappings(directory);
  await repository.classify(ai, ["Q12518"]);
  expect(repository.getCatalog().types.find((type) => type.id === "Q12518")?.categories).toEqual([
    "Churches & cathedrals",
    "Cathedral",
    "Basilica",
    "Church",
  ]);
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual([
      "Churches & cathedrals",
      "Cathedral",
      "Basilica",
      "Church",
    ]);
});

it("assigns only the parent and selected child for a leaf-only rule, including AI rules", async () => {
  const repository = createPoiTypeMappings(directory);
  repository.save("Q16970", ["Basilica"]);
  expect(repository.getCatalog().types.find((type) => type.id === "Q16970")?.categories).toEqual([
    "Basilica",
    "Churches & cathedrals",
  ]);
  server.use(
    http.post("http://localhost:11434/api/chat", () =>
      HttpResponse.json({
        message: {
          content: JSON.stringify({
            rules: [
              {
                id: "Q12518",
                decision: "mapped",
                categoryIds: ["Church"],
                newCategoryNames: [],
                reason: "Child category selected.",
              },
            ],
          }),
        },
      }),
    ),
  );
  await repository.classify(ai, ["Q12518"]);
  expect(repository.getCatalog().types.find((type) => type.id === "Q12518")?.categories).toEqual([
    "Church",
    "Churches & cathedrals",
  ]);
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual([
      "Church",
      "Churches & cathedrals",
    ]);
});

it("moves a child between parents and to the top level without losing shared type assignments", () => {
  const repository = createPoiTypeMappings(directory);
  repository.save("Q16970", ["Church"]);
  expect(repository.moveCategory("Church", "Museum")).toMatchObject({ updatedPois: 10 });
  expect(
    repository.getCatalog().categories?.find((category) => category.id === "Church")?.parent,
  ).toBe("Museum");
  expect(repository.getCatalog().types.find((type) => type.id === "Q16970")?.categories).toEqual([
    "Church",
    "Museum",
  ]);
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().church).toEqual([
      "Church",
      "Museum",
    ]);
  expect(repository.getCatalog().types.find((type) => type.id === "Q999")?.categories).toEqual([]);
  repository.moveCategory("Church", null);
  expect(repository.getCatalog().types.find((type) => type.id === "Q16970")?.categories).toEqual([
    "Church",
  ]);
  expect(
    repository.getCatalog().categories?.find((category) => category.id === "Church")?.parent,
  ).toBeUndefined();
});

it("rejects cycles and deeper nesting without writing category or mapping changes", () => {
  const repository = createPoiTypeMappings(directory);
  const before = repository.getCatalog();
  expect(() => repository.moveCategory("Church", "Church")).toThrow("itself");
  expect(() => repository.moveCategory("Museum", "Church")).toThrow("two category levels");
  expect(() => repository.moveCategory("Churches & cathedrals", "Museum")).toThrow(
    "two category levels",
  );
  expect(() => repository.moveCategory("Church", "Missing")).toThrow("Parent category not found");
  expect(repository.getCatalog()).toEqual(before);
});

it("deletes a parent and all its children across shared rules and city POIs", () => {
  const repository = createPoiTypeMappings(directory);
  repository.save("Q12518", ["Churches & cathedrals", "Museum"]);
  repository.deleteCategory("Churches & cathedrals");
  const catalog = repository.getCatalog();
  for (const id of ["Churches & cathedrals", "Church", "Cathedral", "Basilica"]) {
    expect(catalog.categories?.some((category) => category.id === id)).toBe(false);
    expect(readPoiCategoryCatalog(directory).deletedNames).toContain(id);
  }
  expect(readPoiCategoryCatalog(directory).deletedNames).toEqual(
    expect.arrayContaining(["Churches", "Cathedrals", "Basilicas"]),
  );
  expect(catalog.types.find((type) => type.id === "Q16970")).toMatchObject({
    categories: undefined,
    origin: "manual",
  });
  expect(catalog.types.find((type) => type.id === "Q12518")?.categories).toEqual(["Museum"]);
  expect(catalog.types.find((type) => type.id === "Q999")?.categories).toEqual([]);
  for (const city of ["rome", "florence"]) {
    expect(createPoiCategoriesForCity(city, directory).getAll().church).toEqual([]);
    expect(createPoiCategoriesForCity(city, directory).getAll().tower).toEqual(["Museum"]);
  }
});

it("clears an implicit parent when deleting its last assigned child instead of assigning the siblings", () => {
  const repository = createPoiTypeMappings(directory);
  repository.save("Q16970", ["Church"]);
  repository.deleteCategory("Church");
  expect(repository.getCatalog().types.find((type) => type.id === "Q16970")).toMatchObject({
    categories: undefined,
    origin: "manual",
  });
  expect(
    repository.getCatalog().categories?.some((category) => category.id === "Churches & cathedrals"),
  ).toBe(true);
  for (const city of ["rome", "florence"])
    expect(createPoiCategoriesForCity(city, directory).getAll().church).toEqual([]);
});
