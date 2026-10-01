// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { AdminActionResult } from "../../lib/types";
import { PoiRowsTable } from "./index";
import { RelatedPeopleDrawer } from "./RelatedPeopleDrawer";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("POI actions", () => {
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
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );

    const incomplete = within(screen.getByRole("row", { name: /Incomplete POI/ }));
    expect(incomplete.getByText("Wikidata types not generated")).toBeVisible();
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

  it("searches POI names across pages and combines search with status filters", async () => {
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
                  transformedPoi: { id: "pending-99", name: "Renamed location", featureIndex: 102 },
                }
              : {}),
          })),
        ]}
        globalArtifacts={[]}
        aiSelectionRef={{ current: { mode: "local", model: "qwen3.5:9b" } }}
        generateDraftStoryAction={async () => {}}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );

    const user = userEvent.setup();
    expect(screen.getByText("Showing 1–50 of 103 POIs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.queryByText("Pending 99", { exact: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 51–100 of 103 POIs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 101–103 of 103 POIs")).toBeInTheDocument();
    expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Showing 51–100 of 103 POIs")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search POIs by name" });
    await user.type(search, "  pEnDiNg 99  ");
    expect(screen.getByText("Showing 1–1 of 1 POIs")).toBeInTheDocument();
    expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Failed POI")).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "renamed");
    expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Needs attention" }));
    expect(screen.getByText("No POIs match the search and selected statuses.")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Needs attention" }));
    expect(screen.getByText("Pending 99", { exact: true })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "pending-99");
    expect(screen.getByText("No POIs match the search and selected statuses.")).toBeInTheDocument();
    await user.clear(search);
    expect(screen.getByText("Showing 1–50 of 103 POIs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));

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
  });

  it.each(["success", "warning"])(
    "reopens the same log while running and after %s",
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
      await user.click(screen.getByRole("button", { name: "Show generation log" }));
      expect(
        await screen.findByText("Generating Titus with Ollama (qwen3.5:9b)."),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Hide" }));

      await act(async () => {
        finishResolution(
          outcome === "warning"
            ? { warning: { title: "Some Related People remain unresolved" } }
            : {},
        );
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show generation log" }));
      expect(
        await screen.findByText("Generating Titus with Ollama (qwen3.5:9b)."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      expect(requestedRunIds.length).toBeGreaterThanOrEqual(3);
      expect(new Set(requestedRunIds).size).toBe(1);
    },
  );
});
