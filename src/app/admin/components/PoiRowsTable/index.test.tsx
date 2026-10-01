// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
    ["resolved People", "person-1", "Person", false],
    ["errors belonging to a removed Person", undefined, "Removed Person", false],
    ["errors belonging to an unresolved Person", undefined, "Person", true],
    ["general errors with unresolved People", undefined, undefined, true],
    ["general errors with all People resolved", "person-1", undefined, false],
  ])(
    "shows the Errors badge only for active problems: %s",
    (_label, personId, errorName, hasErrors) => {
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
      expect(
        Boolean(
          within(screen.getByRole("button", { name: /Related People/ })).queryByText("Errors"),
        ),
      ).toBe(hasErrors);
    },
  );

  it("paginates rows and resets the page when filtering by status", async () => {
    render(
      <PoiRowsTable
        rows={[
          {
            id: "failed-poi",
            rawPoi: { id: "failed-poi", name: "Failed POI", featureIndex: 0 },
            lastGenerationRun: {
              operation: "draftStory.generate",
              status: "failed",
              at: "2026-09-25",
            },
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

    await user.click(screen.getByRole("checkbox", { name: "Needs attention" }));
    expect(screen.getByText("Showing 1–50 of 102 POIs")).toBeInTheDocument();
    expect(screen.queryByText("Failed POI")).not.toBeInTheDocument();
    expect(screen.getByText("Pending POI")).toBeInTheDocument();
    expect(screen.getByText("Source POI")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Needs source" }));
    expect(screen.queryByText("Source POI")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "To do" }));
    expect(screen.getByText("No POIs match the selected statuses.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "POI pagination" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "To do" }));
    expect(screen.getByText("Showing 1–50 of 101 POIs")).toBeInTheDocument();
    expect(screen.getByText("Pending POI")).toBeInTheDocument();
  });

  it("shows AI progress while Related People resolution is still running", async () => {
    let finishResolution: (value: AdminActionResult) => void = () => {};
    const resolution = new Promise<AdminActionResult>((resolve) => {
      finishResolution = resolve;
    });

    server.use(
      http.get("/api/admin/ai-progress/:runId", () =>
        HttpResponse.json({
          status: "running",
          startedAt: "2026-09-25T00:00:00.000Z",
          entries: [
            {
              at: "2026-09-25T00:00:01.000Z",
              message: "Generating Titus with Ollama (qwen3.5:9b).",
            },
          ],
        }),
      ),
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

    finishResolution({ warning: { title: "Some Related People remain unresolved" } });
  });
});
