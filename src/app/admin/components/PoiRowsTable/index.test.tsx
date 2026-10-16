// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { AdminActionResult } from "../../lib/types";
import { PoiRowsTable } from "./index";
import { RelatedPeopleDrawer } from "./RelatedPeopleDrawer";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  // jsdom has no layout observer for Headless UI's option selection.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = () => {};
      unobserve = () => {};
      disconnect = () => {};
    },
  );
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

describe("POI actions", () => {
  it("sorts generation dates across pages and keeps undated POIs last", async () => {
    const user = userEvent.setup();
    render(
      <PoiRowsTable
        rows={Array.from({ length: 51 }, (_, index) => ({
          id: `poi-${index}`,
          rawPoi: { id: `poi-${index}`, name: `Place ${index}`, featureIndex: index },
          lastGenerationAt:
            index === 0 ? undefined : new Date(Date.UTC(2026, 8, index)).toISOString(),
        }))}
        globalArtifacts={[]}
        aiSelectionRef={{ current: { mode: "local", model: "test-model" } }}
        generateDraftStoryAction={async () => {}}
        generateDraftStoriesAction={async () => []}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );
    expect(within(screen.getAllByRole("row")[1]).getByText("Place 0")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 51–51 of 51 POIs")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Sort POIs/ }));
    await user.click(screen.getByRole("option", { name: "Newest generation first" }));
    expect(screen.getByText("Showing 1–50 of 51 POIs")).toBeVisible();
    expect(within(screen.getAllByRole("row")[1]).getByText("Place 50")).toBeVisible();
    expect(screen.queryByText("Place 0", { exact: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(within(screen.getAllByRole("row")[1]).getByText("Place 0")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Sort POIs/ }));
    await user.click(screen.getByRole("option", { name: "Oldest generation first" }));
    expect(within(screen.getAllByRole("row")[1]).getByText("Place 1")).toBeVisible();
    expect(screen.queryByText("Place 0", { exact: true })).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search POIs by name" }), "Place 50");
    expect(screen.getByText("Showing 1–1 of 1 POIs")).toBeVisible();
    expect(within(screen.getAllByRole("row")[1]).getByText("Place 50")).toBeVisible();
    await user.clear(screen.getByRole("searchbox", { name: "Search POIs by name" }));
    await user.click(screen.getByRole("button", { name: /Sort POIs/ }));
    await user.click(screen.getByRole("option", { name: "Status and name" }));
    expect(within(screen.getAllByRole("row")[1]).getByText("Place 0")).toBeVisible();
  });

  it("keeps search, status filters and generation controls available together", async () => {
    const user = userEvent.setup();
    render(
      <PoiRowsTable
        rows={[]}
        globalArtifacts={[]}
        aiSelectionRef={{ current: { mode: "local", model: "test-model" } }}
        generateDraftStoryAction={async () => {}}
        generateDraftStoriesAction={async () => []}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );

    await user.type(screen.getByRole("searchbox", { name: "Search POIs by name" }), "Aqueduct");
    expect(screen.getByRole("searchbox", { name: "Search POIs by name" })).toHaveValue("Aqueduct");
    expect(screen.getByRole("group", { name: "Show status" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start automatic generation" })).toBeVisible();
  });

  it("generates a single row without starting automatic generation", async () => {
    const submitted: FormData[] = [];
    server.use(
      http.get("/api/admin/ai-progress/:runId", () => new HttpResponse(null, { status: 404 })),
    );
    render(
      <PoiRowsTable
        rows={[{ id: "aqueduct", rawPoi: { id: "aqueduct", name: "Aqueduct", featureIndex: 0 } }]}
        globalArtifacts={[]}
        aiSelectionRef={{ current: { mode: "cloud", model: "test-model" } }}
        generateDraftStoryAction={async (data) => {
          submitted.push(data);
        }}
        generateDraftStoriesAction={async () => {
          throw new Error("Automatic generation must not run");
        }}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(submitted).toHaveLength(1);
    expect(submitted[0].get("geoPlaceId")).toBe("aqueduct");
    expect(submitted[0].get("aiModel")).toBe("test-model");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start automatic generation" })).toBeEnabled(),
    );
  });

  it.each([true, false])(
    "keeps a missing Wikipedia source error in its Wikipedia cell (log available: %s)",
    async (hasLog) => {
      render(
        <PoiRowsTable
          rows={[
            {
              id: "aqueduct",
              rawPoi: { id: "way/997532432", name: "Acquedotto dei Sette Bassi", featureIndex: 0 },
              transformedPoi: {
                id: "aqueduct",
                name: "Acquedotto dei Sette Bassi",
                featureIndex: 0,
              },
              transformedJson: '{"id":"aqueduct"}',
              sourcePending: true,
              generationErrors: hasLog
                ? [
                    {
                      stage: "sources",
                      message:
                        "No unambiguous English or Italian Wikipedia page was found for this POI.",
                      at: "Today",
                      operation: "draftStory.generate",
                    },
                  ]
                : [],
            },
          ]}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "local", model: "test-model" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async () => []}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={async () => {}}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );
      const cells = within(
        screen.getByRole("row", { name: /Acquedotto dei Sette Bassi/ }),
      ).getAllByRole("cell");
      expect(within(cells[2]).getByRole("status")).toHaveTextContent(
        "No unambiguous English or Italian Wikipedia page was found for this POI.",
      );
      expect(within(cells[2]).getByRole("status")).toBeVisible();
      expect(Boolean(within(cells[2]).queryByText("Latest error"))).toBe(hasLog);
      expect(within(cells[2]).getByText("Wikipedia source not acquired")).toBeVisible();
      expect(within(cells[0]).queryByText("Latest error")).not.toBeInTheDocument();
      expect(cells).toHaveLength(6);
      expect(within(cells[3]).getByText("Wikidata types not generated")).toBeVisible();
      expect(within(cells[3]).queryByRole("button")).not.toBeInTheDocument();

      ["Geo Place", "POI", "Wikipedia Text", "Wikidata Types", "Story", "Main Image"].forEach(
        (label, index) =>
          expect(within(screen.getAllByRole("columnheader")[index]).getByText(label)).toBeVisible(),
      );
      expect(within(cells[1]).getByRole("button", { name: "View POI JSON" })).toBeVisible();
      expect(within(cells[1]).getByText("aqueduct")).toBeVisible();
      expect(within(cells[4]).getByText("Story Content not generated")).toBeVisible();
      expect(within(cells[5]).getByText("Image candidates not generated")).toBeVisible();
      for (const index of [4, 5])
        expect(within(cells[index]).queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("shows resolution errors only for unresolved People", () => {
    render(
      <RelatedPeopleDrawer
        poiName="Piazza Navona"
        people={[
          {
            name: "Pope Innocent X",
            personId: "pope-innocent-x",
            resolutionError: "Old checkpoint failure",
            artifacts: [],
          },
          { name: "Unresolved Person", artifacts: [] },
        ]}
        errors={[
          {
            name: "Pope Innocent X",
            at: "Previous attempt",
            operation: "relatedPeople.resolve",
            stage: "relatedPeople",
            message: "Old logged failure",
          },
          {
            name: "Unresolved Person",
            at: "Latest attempt",
            operation: "relatedPeople.resolve",
            stage: "relatedPeople",
            message: "Current failure",
          },
        ]}
        onClose={() => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );

    expect(screen.getByText("Resolved", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Old logged failure")).not.toBeInTheDocument();
    expect(screen.queryByText("Old checkpoint failure")).not.toBeInTheDocument();
    expect(screen.getByText("Current failure")).toBeInTheDocument();
    expect(screen.getAllByText("Resolution errors (1) · View details")).toHaveLength(1);
  });

  it.each([
    ["resolved People", "person-1", "Person"],
    ["errors belonging to a removed Person", undefined, "Removed Person"],
    ["errors belonging to an unresolved Person", undefined, "Person"],
    ["general errors with unresolved People", undefined, undefined],
    ["general errors with all People resolved", "person-1", undefined],
  ])(
    "uses the unresolved count without a duplicate Errors badge: %s",
    (_label, personId, errorName) => {
      render(
        <PoiRowsTable
          rows={[
            {
              id: "poi",
              storyContent: {
                introduction: { text: "A Story", sourceIds: ["wikipedia"] },
                topics: { history: [], design: [], art: [] },
                relatedPeople: [{ name: "Person", personId, sourceIds: ["wikipedia"] }],
              },
              generationErrors: [
                {
                  at: "Previous attempt",
                  operation: "relatedPeople.resolve",
                  stage: "relatedPeople",
                  name: errorName,
                  message: "A resolution error",
                },
              ],
            },
          ]}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "local", model: "test-model" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async () => []}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={async () => {}}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );
      const control = within(screen.getByRole("button", { name: /Related People/ }));
      expect(control.queryByText("Errors")).not.toBeInTheDocument();
      expect(Boolean(control.queryByText("1 unresolved"))).toBe(!personId);
    },
  );

  it("shows missing data directly in the cells and ignores resolved People errors", () => {
    render(
      <PoiRowsTable
        rows={["Incomplete POI", "Complete POI", "No candidates POI"].map((name) => ({
          id: name,
          wikidataId: "Q100",
          rawPoi: { id: name, name, featureIndex: 0 },
          transformedPoi: { id: name, name, featureIndex: 0 },
          wikiPoi: { id: name, name, featureIndex: 0 },
          wikiText: name === "Complete POI" ? "Wikipedia source text" : "",
          transformedJson: name === "Complete POI" ? "{}" : " ",
          lastGenerationRun: {
            operation: "relatedPeople.resolve",
            status: "success" as const,
            at: "Today",
          },
          poiTypes:
            name === "Complete POI" ? { types: [{ id: "Q1", label: "Monument" }] } : undefined,
          storyContent: {
            introduction: { text: "A complete Story", sourceIds: ["wikipedia"] },
            topics: { history: [], design: [], art: [] },
            relatedPeople: [{ name: "Person", personId: "person", sourceIds: ["wikipedia"] }],
          },
          generationErrors: [
            {
              stage: "relatedPeople",
              name: "Person",
              message: "Old error",
              operation: "relatedPeople.resolve",
              at: "Yesterday",
            },
          ],
          mainImageArtifact: {
            selectedCommonsFileName: "Example.jpg",
            candidates:
              name === "No candidates POI"
                ? []
                : [
                    {
                      commonsFileName: "Example.jpg",
                      commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
                      thumbnailUrl: "https://upload.wikimedia.org/Example.jpg",
                      originalImageUrl: "https://upload.wikimedia.org/Example.jpg",
                      attribution: "Example artist",
                      license: name === "Complete POI" ? "CC BY-SA 4.0" : undefined,
                      discoveredVia: "wikidata-p18" as const,
                      isProposed: true,
                    },
                  ],
          },
        }))}
        globalArtifacts={[]}
        aiSelectionRef={{ current: { mode: "local", model: "test-model" } }}
        generateDraftStoryAction={async () => {}}
        generateDraftStoriesAction={async () => []}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );

    const incomplete = within(screen.getByRole("row", { name: /Incomplete POI/ }));
    expect(incomplete.getByText("Wikidata types not generated")).toBeVisible();
    expect(incomplete.getByRole("button", { name: "Refresh types" })).toBeEnabled();
    expect(incomplete.getByText("Missing license")).toBeVisible();
    expect(incomplete.getByRole("cell", { name: /Wikidata types not generated/ })).toHaveClass(
      "bg-rose-100/80",
    );
    expect(incomplete.getByRole("cell", { name: /Missing license/ })).toHaveClass("bg-rose-100/80");
    expect(
      incomplete.getAllByRole("cell").filter((cell) => cell.classList.contains("bg-rose-100/80")),
    ).toHaveLength(2);
    const complete = within(screen.getByRole("row", { name: /Complete POI/ }));
    expect(complete.queryByText("Wikidata types not generated")).not.toBeInTheDocument();
    expect(complete.queryByText("Missing license")).not.toBeInTheDocument();
    for (const cell of complete.getAllByRole("cell")) {
      expect(cell).not.toHaveClass("bg-rose-100/80");
    }
    expect(
      incomplete.queryByRole("button", { name: "View Wikipedia Text" }),
    ).not.toBeInTheDocument();
    expect(incomplete.queryByRole("button", { name: "View POI JSON" })).not.toBeInTheDocument();
    expect(complete.getByRole("button", { name: "View Wikipedia Text" })).toBeInTheDocument();
    expect(complete.getByRole("button", { name: "View POI JSON" })).toBeInTheDocument();
    const emptyImages = within(
      within(screen.getByRole("row", { name: /No candidates POI/ })).getByRole("cell", {
        name: /^No candidates 0 candidates/,
      }),
    );
    expect(
      emptyImages.queryByRole("button", { name: "View Main Image Candidates" }),
    ).not.toBeInTheDocument();
    expect(emptyImages.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.queryByText("Errors", { exact: true })).not.toBeInTheDocument();
  });

  it.each(["pagination", "search", "status filters", "status name selection", "all statuses"])(
    "handles POI %s across pages",
    async (scenario) => {
      render(
        <PoiRowsTable
          rows={[
            {
              id: "failed-poi",
              rawPoi: { id: "failed-poi", name: "Failed POI", featureIndex: 0 },
              storyContent: {
                introduction: { text: "An incomplete Story", sourceIds: ["wikipedia"] },
                topics: { history: [], design: [], art: [] },
                relatedPeople: [{ name: "Titus", sourceIds: ["wikipedia"] }],
              },
              generationErrors: [
                {
                  at: "2026-09-25",
                  operation: "relatedPeople.resolve",
                  stage: "relatedPeople",
                  name: "Titus",
                  message: "Could not resolve Titus",
                },
              ],
            },
            {
              id: "pending-poi",
              rawPoi: { id: "pending-poi", name: "Pending POI", featureIndex: 1 },
            },
            {
              id: "source-poi",
              rawPoi: { id: "source-poi", name: "Source POI", featureIndex: 2 },
              sourcePending: true,
            },
            ...Array.from({ length: 100 }, (_, index) => ({
              id: `pending-${index}`,
              rawPoi: { id: `pending-${index}`, name: `Pending ${index}`, featureIndex: index + 3 },
              ...(index === 99
                ? {
                    transformedPoi: {
                      id: "pending-99",
                      name: "Renamed location",
                      featureIndex: 102,
                    },
                  }
                : {}),
            })),
          ]}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "local", model: "qwen3.5:9b" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async () => []}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={async () => {}}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );

      const user = userEvent.setup();
      expect(screen.getByText("Showing 1–50 of 103 POIs")).toBeInTheDocument();
      expect(
        within(screen.getByRole("navigation", { name: "POI pagination" })).getByRole("button", {
          name: "Previous page",
        }),
      ).toBeDisabled();
      expect(screen.queryByText("Pending 99", { exact: true })).not.toBeInTheDocument();
      if (scenario === "all statuses") {
        expect(screen.getByRole("checkbox", { name: "All" })).toBeChecked();
        await user.click(screen.getByRole("button", { name: "Needs source" }));
        expect(screen.getByRole("checkbox", { name: "All" })).not.toBeChecked();
        expect(screen.queryByText("Pending POI")).not.toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "All" }));
        expect(screen.getByText("Showing 1–50 of 103 POIs")).toBeInTheDocument();
        expect(screen.getByText("Failed POI")).toBeInTheDocument();
        expect(screen.getByText("Pending POI")).toBeInTheDocument();
        expect(screen.getByText("Source POI")).toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "All" }));
        expect(screen.getByText("No POIs match the selected statuses.")).toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "All" }));
        await user.click(screen.getByRole("checkbox", { name: "Complete" }));
        expect(screen.getByRole("checkbox", { name: "All" })).not.toBeChecked();
        await user.click(screen.getByRole("checkbox", { name: "Complete" }));
        expect(screen.getByRole("checkbox", { name: "All" })).toBeChecked();

        return;
      }
      if (scenario === "pagination") {
        await user.click(
          within(screen.getByRole("navigation", { name: "POI pagination" })).getByRole("button", {
            name: "Next page",
          }),
        );
        expect(screen.getByText("Showing 51–100 of 103 POIs")).toBeInTheDocument();
        await user.click(
          within(screen.getByRole("navigation", { name: "POI pagination" })).getByRole("button", {
            name: "Next page",
          }),
        );
        expect(screen.getByText("Showing 101–103 of 103 POIs")).toBeInTheDocument();
        expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
        expect(
          within(screen.getByRole("navigation", { name: "POI pagination" })).getByRole("button", {
            name: "Next page",
          }),
        ).toBeDisabled();
        await user.click(
          within(screen.getByRole("navigation", { name: "POI pagination" })).getByRole("button", {
            name: "Previous page",
          }),
        );
        expect(screen.getByText("Showing 51–100 of 103 POIs")).toBeInTheDocument();

        return;
      }

      await user.click(
        within(screen.getByRole("navigation", { name: "POI pagination" })).getByRole("button", {
          name: "Next page",
        }),
      );

      if (scenario === "search") {
        const search = screen.getByRole("searchbox", { name: "Search POIs by name" });
        await user.click(search);
        await user.paste("  pEnDiNg 99  ");
        expect(screen.getByText("Showing 1–1 of 1 POIs")).toBeInTheDocument();
        expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
        expect(screen.queryByText("Failed POI")).not.toBeInTheDocument();
        await user.clear(search);
        await user.paste("renamed");
        expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "Needs attention" }));
        expect(
          screen.getByText("No POIs match the search and selected statuses."),
        ).toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "Needs attention" }));
        expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
        await user.clear(search);
        await user.paste("pending-99");
        expect(
          screen.getByText("No POIs match the search and selected statuses."),
        ).toBeInTheDocument();
        await user.clear(search);
        expect(screen.getByText("Showing 1–50 of 103 POIs")).toBeInTheDocument();

        return;
      }

      if (scenario === "status name selection") {
        await user.click(screen.getByRole("button", { name: "Needs source" }));
        expect(screen.getByText("Showing 1–1 of 1 POIs")).toBeInTheDocument();
        expect(screen.getByText("Source POI")).toBeInTheDocument();
        expect(screen.queryByText("Failed POI")).not.toBeInTheDocument();
        expect(screen.queryByText("Pending POI")).not.toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Needs source" })).toBeChecked();
        for (const name of ["Needs attention", "To do", "Complete"]) {
          expect(screen.getByRole("checkbox", { name })).not.toBeChecked();
        }
        await user.click(screen.getByRole("button", { name: "Needs source" }));
        expect(screen.getByText("Source POI")).toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "To do" }));
        expect(screen.getByText("Showing 1–50 of 101 POIs")).toBeInTheDocument();
        expect(screen.getByText("Pending POI")).toBeInTheDocument();
        expect(screen.getByText("Source POI")).toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "Needs source" }));
        expect(screen.queryByText("Source POI")).not.toBeInTheDocument();

        return;
      }

      await user.click(screen.getByRole("checkbox", { name: "Needs attention" }));
      expect(screen.getByText("Showing 1–50 of 101 POIs")).toBeInTheDocument();
      expect(screen.queryByText("Failed POI")).not.toBeInTheDocument();
      expect(screen.getByText("Pending POI")).toBeInTheDocument();
      expect(screen.getByText("Source POI")).toBeInTheDocument();

      await user.click(screen.getByRole("checkbox", { name: "Needs source" }));
      expect(screen.queryByText("Source POI")).not.toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: "To do" }));
      expect(screen.getByText("No POIs match the selected statuses.")).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "POI pagination" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: "To do" }));
      expect(screen.getByText("Showing 1–50 of 100 POIs")).toBeInTheDocument();
      expect(screen.getByText("Pending POI")).toBeInTheDocument();
    },
  );

  it.each(["success", "warning"])(
    "shows and hides the action log without a toolbar shortcut after %s",
    async (outcome) => {
      let finishResolution: (value: AdminActionResult) => void = () => {};
      const resolution = new Promise<AdminActionResult>((resolve) => {
        finishResolution = resolve;
      });

      const requestedRunIds: unknown[] = [];
      server.use(
        http.get("/api/admin/ai-progress/:runId", ({ params }) => {
          requestedRunIds.push(params.runId);
          return HttpResponse.json({
            status: "running",
            startedAt: "2026-09-25T00:00:00.000Z",
            entries: [
              {
                at: "2026-09-25T00:00:01.000Z",
                message: "Generating Titus with Ollama (qwen3.5:9b).",
              },
            ],
          });
        }),
      );

      render(
        <PoiRowsTable
          rows={[
            {
              id: "arch-of-titus",
              storyContent: {
                introduction: { text: "The arch", sourceIds: ["source-1"] },
                topics: { history: [], design: [], art: [] },
                relatedPeople: [{ name: "Titus", sourceIds: ["source-1"] }],
              },
            },
          ]}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "local", model: "qwen3.5:9b" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async () => []}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={() => resolution}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Retry unresolved People" }));
      await user.click(screen.getByRole("button", { name: "Confirm" }));

      expect(
        await screen.findByRole("dialog", { name: "Resolving Related People" }),
      ).toBeInTheDocument();
      expect(
        await screen.findByText("Generating Titus with Ollama (qwen3.5:9b)."),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Hide" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Show generation log" })).not.toBeInTheDocument();

      await act(async () => {
        finishResolution(
          outcome === "warning"
            ? { warning: { title: "Some Related People remain unresolved" } }
            : {},
        );
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Show generation log" })).not.toBeInTheDocument();
      expect(requestedRunIds.length).toBeGreaterThanOrEqual(1);
      expect(new Set(requestedRunIds).size).toBe(1);
    },
  );
});
