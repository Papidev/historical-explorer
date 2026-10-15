import { generateDraftStories } from "../../lib/generateDraftStories";
import { storyQueueStorageKey } from "./storyQueueStorage";
// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  localStorage.clear();
});
afterAll(() => server.close());

describe("POI actions", () => {
  it("keeps search available when expanding the table and restores generation controls", async () => {
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
    await user.click(screen.getByRole("button", { name: "Expand table" }));
    expect(screen.getByRole("button", { name: "Restore layout" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("searchbox", { name: "Search POIs by name" })).toHaveValue("Aqueduct");
    expect(screen.getByRole("group", { name: "Show status" })).toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: "Stories per run" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore layout" }));
    expect(screen.getByRole("spinbutton", { name: "Stories per run" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search POIs by name" })).toHaveValue("Aqueduct");
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

  it("processes at most 20 missing stories sequentially, stops queued work, and continues after POI errors", async () => {
    server.use(
      http.get("/api/admin/ai-progress/:runId", () => new HttpResponse(null, { status: 404 })),
      http.post("/api/admin/ai-progress/:runId/stop", () => HttpResponse.json({ requested: true })),
    );
    const submitted: FormData[] = [];
    let finish = () => {};
    const firstResponse = new Promise<void>((resolve) => {
      finish = resolve;
    });
    server.use(
      http.post("/api/admin/story-generations", async ({ request }) => {
        const formData = await request.formData();
        submitted.push(formData);
        if (submitted.length === 1) await firstResponse;
        if (submitted.length === 2)
          return HttpResponse.json({ error: "Provider unavailable" }, { status: 400 });
        return HttpResponse.json([
          {
            geoPlaceId: String(formData.get("geoPlaceId")),
            progressId: String(formData.get("progressId")),
            ...(submitted.length === 3
              ? { error: "sources-unavailable: HTTP 429" }
              : submitted.length === 4
                ? { result: { warning: { title: "Missing image" } } }
                : { result: {} }),
          },
        ]);
      }),
    );
    const aiSelectionRef = { current: { mode: "cloud" as const, model: "cloud-model" } };
    render(
      <PoiRowsTable
        rows={Array.from({ length: 22 }, (_, index) => ({
          id: `Place ${index}`,
          rawPoi: { id: `Place ${index}`, name: `Place ${index}`, featureIndex: index },
        }))}
        globalArtifacts={[]}
        aiSelectionRef={aiSelectionRef}
        generateDraftStoryAction={async () => {
          throw new Error("Use the queue action");
        }}
        generateDraftStoriesAction={generateDraftStories}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );
    const user = userEvent.setup();
    expect(screen.getByRole("spinbutton", { name: "Stories per run" })).toHaveValue(20);
    await user.click(screen.getByRole("button", { name: "Generate missing stories" }));
    expect(screen.getByRole("dialog", { name: "Story queue" })).toBeVisible();
    expect(submitted).toHaveLength(1);
    expect(
      within(screen.getByRole("dialog", { name: "Story queue" })).queryByText("Place 1", {
        exact: true,
      }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show log for Place 0" }));
    expect(await screen.findByRole("log")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Pause queue" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stop current POI" }));
    expect(screen.getByRole("button", { name: "Stopping current POI..." })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Hide" }));
    await act(async () => {
      finish();
    });
    expect(submitted).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 of 20 Story generations completed · Paused",
    );
    expect(screen.getByRole("spinbutton", { name: "Stories per run" })).toBeDisabled();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(submitted).toHaveLength(1);
    aiSelectionRef.current.model = "changed-model";
    await user.click(screen.getByRole("button", { name: "Resume queue" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "20 of 20 Story generations completed · Finished",
      ),
    );
    expect(submitted).toHaveLength(20);
    expect(
      submitted.every(
        (data) => data.getAll("geoPlaceId").length === 1 && data.get("aiModel") === "cloud-model",
      ),
    ).toBe(true);
    expect(submitted.map((data) => data.get("geoPlaceId"))).toEqual(
      Array.from({ length: 20 }, (_, index) => `Place ${index}`),
    );
    expect(new Set(submitted.map((data) => data.get("progressId"))).size).toBe(20);
    await user.click(screen.getByRole("button", { name: "Show queue progress" }));
    expect(screen.getByText("Provider unavailable")).toBeVisible();
    expect(screen.getByText("sources-unavailable: HTTP 429")).toBeVisible();
    expect(screen.getByText("Completed with issues", { exact: true })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show log for Place 1" }));
    expect(await screen.findByText("Generation failed")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Generate missing stories" })).toBeEnabled();
  });

  it.each([false, true])(
    "stops the active POI and resumes it without exceeding the story limit (started: %s)",
    async (storyStarted) => {
      server.use(
        http.get("/api/admin/ai-progress/:runId", () => new HttpResponse(null, { status: 404 })),
      );
      let finish = () => {};
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const submitted: FormData[] = [];
      server.use(
        http.post("/api/admin/ai-progress/:runId/stop", ({ params }) => {
          expect(params.runId).toBe(submitted[0].get("progressId"));
          finish();
          return HttpResponse.json({ requested: true });
        }),
      );
      render(
        <PoiRowsTable
          rows={["Q1", "Q2"].map((id, featureIndex) => ({
            id,
            rawPoi: { id, name: id, featureIndex },
          }))}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "cloud", model: "cloud-model" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async (formData) => {
            submitted.push(formData);
            const attempt = submitted.length;
            if (attempt === 1) await pending;
            return [
              {
                geoPlaceId: String(formData.get("geoPlaceId")),
                progressId: String(formData.get("progressId")),
                cancelled: attempt === 1,
                storyGenerationStarted: attempt === 1 ? storyStarted : true,
                ...(attempt === 1 ? { error: "Generation stopped by user." } : { result: {} }),
              },
            ];
          }}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={async () => {}}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );
      const user = userEvent.setup();
      await user.clear(screen.getByRole("spinbutton", { name: "Stories per run" }));
      await user.type(screen.getByRole("spinbutton", { name: "Stories per run" }), "1");
      await user.click(screen.getByRole("button", { name: "Generate missing stories" }));
      await user.click(
        within(screen.getByRole("dialog", { name: "Story queue" })).getByRole("button", {
          name: "Stop current POI",
        }),
      );
      expect(
        await within(screen.getByRole("dialog", { name: "Story queue" })).findByText("Stopped", {
          exact: true,
        }),
      ).toBeVisible();
      expect(submitted).toHaveLength(1);
      await user.click(screen.getByRole("button", { name: "Show log for Q1" }));
      expect(
        await screen.findByText("Generation stopped. Resume the queue to continue this POI."),
      ).toBeVisible();
      await user.click(
        within(screen.getByRole("dialog", { name: "Story queue" })).getByRole("button", {
          name: "Resume queue",
        }),
      );
      await waitFor(() => expect(screen.getByRole("button", { name: "Close" })).toBeVisible());
      expect(submitted).toHaveLength(2);
      expect(submitted.map((data) => data.get("geoPlaceId"))).toEqual(["Q1", "Q1"]);
      expect(submitted[1].get("resume")).toBe("true");
      expect(submitted[1].get("progressId")).not.toBe(submitted[0].get("progressId"));
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByRole("status")).toHaveTextContent(
        "1 of 1 Story generations completed · Finished",
      );
    },
  );

  it.each([
    "success",
    "quota",
    "partial-quota",
    "connection",
    "connection-online",
    "connection-visibility",
    "connection-delayed",
    "connection-quota",
    "connection-running",
    "connection-retry",
    "unmount",
    "not-started",
    "all-not-started",
  ])(
    "uses a custom limit across pages and filters, skips saved Story Content, and handles %s",
    async (outcome) => {
      server.use(
        http.get("/api/admin/ai-progress/:runId", () => new HttpResponse(null, { status: 404 })),
      );
      let recoveryUnavailable = outcome === "connection-retry";
      let progressReads = 0;
      if (outcome.startsWith("connection"))
        server.use(
          http.get("/api/admin/ai-progress/:runId", () => {
            if (recoveryUnavailable) return HttpResponse.error();
            progressReads += 1;
            return HttpResponse.json({
              status:
                outcome === "connection-quota"
                  ? "partial"
                  : outcome === "connection-running" && progressReads < 4
                    ? "running"
                    : "succeeded",
              ...(outcome === "connection-quota"
                ? { warning: { title: "People incomplete", details: "Ollama failed: HTTP 429" } }
                : {}),
              storyContentStarted: true,
              startedAt: "2026-10-10T00:00:00.000Z",
              entries: [],
            });
          }),
        );
      const submitted: FormData[] = [];
      let finish = () => {};
      const firstResponse = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const { unmount } = render(
        <PoiRowsTable
          rows={Array.from({ length: 55 }, (_, index) => ({
            id: `Q${index}`,
            rawPoi: { id: `Q${index}`, name: `Place ${index}`, featureIndex: index },
            ...(index === 0
              ? {
                  storyContent: {
                    introduction: { text: "A Story", sourceIds: ["wikipedia"] },
                    topics: { history: [], design: [], art: [] },
                    relatedPeople: [],
                  },
                }
              : {}),
            ...(index === 1
              ? {
                  sourcePending: true,
                  transformedPoi: { id: "generated-1", name: "Place 1", featureIndex: index },
                }
              : {}),
          }))}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "cloud", model: "cloud-model" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async (formData) => {
            submitted.push(formData);
            if (submitted.length === 1) {
              await firstResponse;
              if (outcome === "quota") throw new Error("Ollama failed: HTTP 429");
              if (outcome.startsWith("connection")) throw new TypeError("Failed to fetch");
            }
            return [
              {
                geoPlaceId: String(formData.get("geoPlaceId")),
                progressId: String(formData.get("progressId")),
                ...(outcome === "all-not-started" ||
                (outcome === "not-started" && submitted.length === 1)
                  ? { storyGenerationStarted: false, error: "source-not-found" }
                  : { storyGenerationStarted: true }),
                result:
                  outcome === "partial-quota" && submitted.length === 1
                    ? {
                        warning: {
                          title: "Some Related People remain unresolved",
                          details: "Ollama failed: HTTP 402",
                        },
                      }
                    : {},
              },
            ];
          }}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={async () => {}}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await user.type(
        screen.getByRole("searchbox", { name: "Search POIs by name" }),
        "Missing POI",
      );
      await user.click(screen.getByRole("checkbox", { name: "To do" }));
      await user.clear(screen.getByRole("spinbutton", { name: "Stories per run" }));
      await user.type(screen.getByRole("spinbutton", { name: "Stories per run" }), "2");
      await user.click(screen.getByRole("button", { name: "Generate missing stories" }));
      expect(submitted[0].getAll("geoPlaceId")).toEqual(["Q1"]);
      if (outcome === "unmount") unmount();
      await act(async () => {
        finish();
      });
      if (outcome === "unmount") {
        expect(submitted).toHaveLength(1);
        return;
      }
      if (outcome === "quota" || outcome === "partial-quota" || outcome.startsWith("connection")) {
        expect(submitted).toHaveLength(1);
        expect(screen.getByRole("alert")).toHaveTextContent(
          outcome.startsWith("connection")
            ? "Connection to the server was lost"
            : "Ollama reported a usage or request limit",
        );
        await act(async () => {
          if (outcome === "connection-delayed") return;
          if (outcome === "connection-visibility")
            document.dispatchEvent(new Event("visibilitychange"));
          else
            window.dispatchEvent(new Event(outcome === "connection-online" ? "online" : "focus"));
        });
        if (outcome === "connection-retry") {
          await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("nothing has been resubmitted"),
          );
          expect(submitted).toHaveLength(1);
          recoveryUnavailable = false;
          await act(async () => {
            window.dispatchEvent(new Event("online"));
          });
        }
        if (outcome === "connection-quota") {
          expect(await screen.findByRole("alert")).toHaveTextContent(
            "Ollama reported a usage or request limit",
          );
          await act(async () => {
            window.dispatchEvent(new Event("focus"));
          });
          expect(submitted).toHaveLength(1);
        }
        if (!outcome.startsWith("connection") || outcome === "connection-quota") {
          expect(submitted).toHaveLength(1);
          await user.click(
            within(screen.getByRole("dialog", { name: "Story queue" })).getByRole("button", {
              name: "Resume queue",
            }),
          );
        }
      }
      const expectedAttempts =
        outcome === "all-not-started" ? 54 : outcome === "not-started" ? 3 : 2;
      await waitFor(() => expect(submitted).toHaveLength(expectedAttempts), { timeout: 7_000 });
      expect(submitted[1].getAll("geoPlaceId")).toEqual(["Q2"]);
      if (outcome === "not-started") expect(submitted[2].getAll("geoPlaceId")).toEqual(["Q3"]);
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByRole("status")).toHaveTextContent(
        `${outcome === "all-not-started" ? 0 : 2} of 2 Story generations completed · Finished`,
      );
      expect(screen.getByRole("status")).toHaveTextContent(`${expectedAttempts} POIs processed`);
    },
    15_000,
  );

  it.each(["finished", "running", "restarted", "not-sent", "offline", "quota"])(
    "restores a saved queue and reconciles the previous POI (%s)",
    async (outcome) => {
      server.use(
        http.get("/api/admin/ai-progress/:runId", () => new HttpResponse(null, { status: 404 })),
      );
      const rows = ["Q1", "Q2", "Q3"].map((id, featureIndex) => ({
        id,
        rawPoi: { id, name: id, featureIndex },
      }));
      let finish = () => {};
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const first = render(
        <PoiRowsTable
          rows={rows}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "cloud", model: "saved-model" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async (data) => {
            await pending;
            return [
              {
                geoPlaceId: String(data.get("geoPlaceId")),
                progressId: String(data.get("progressId")),
                storyGenerationStarted: true,
              },
            ];
          }}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={async () => {}}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );
      const user = userEvent.setup();
      await user.clear(screen.getByRole("spinbutton", { name: "Stories per run" }));
      await user.type(screen.getByRole("spinbutton", { name: "Stories per run" }), "2");
      await user.click(screen.getByRole("button", { name: "Generate missing stories" }));
      const saved = JSON.parse(localStorage.getItem(storyQueueStorageKey)!);
      expect(saved.pendingId).toBe(saved.runs[0].progressId);
      first.unmount();
      await act(async () => {
        finish();
      });
      // A detached page must not overwrite the durable pending record.
      expect(JSON.parse(localStorage.getItem(storyQueueStorageKey)!).pendingId).toBe(
        saved.pendingId,
      );
      let reads = 0;
      let unavailable = outcome === "offline";
      server.use(
        http.get("/api/admin/ai-progress/:runId", ({ params }) => {
          if (params.runId !== saved.pendingId || outcome === "not-sent")
            return new HttpResponse(null, { status: 404 });
          if (unavailable) return HttpResponse.error();
          reads += 1;
          return HttpResponse.json({
            status:
              outcome === "quota"
                ? "partial"
                : outcome === "restarted"
                  ? "cancelled"
                  : outcome === "running" && reads < 3
                    ? "running"
                    : "succeeded",
            startedAt: "2026-10-10T00:00:00.000Z",
            storyContentStarted: true,
            entries: [],
            ...(outcome === "quota"
              ? {
                  warning: {
                    title: "Related People incomplete",
                    details: "Ollama failed: HTTP 402",
                  },
                }
              : {}),
          });
        }),
      );
      const submitted: FormData[] = [];
      render(
        <PoiRowsTable
          rows={rows}
          globalArtifacts={[]}
          aiSelectionRef={{ current: { mode: "local", model: "different-model" } }}
          generateDraftStoryAction={async () => {}}
          generateDraftStoriesAction={async (data) => {
            submitted.push(data);
            return [
              {
                geoPlaceId: String(data.get("geoPlaceId")),
                progressId: String(data.get("progressId")),
                storyGenerationStarted: !(
                  outcome === "restarted" && data.get("geoPlaceId") === "Q1"
                ),
              },
            ];
          }}
          refreshStoryContentAction={async () => {}}
          resolveRelatedPeopleAction={async () => {}}
          refreshMainImageCandidatesAction={async () => {}}
          refreshPoiTypesAction={async () => {}}
          selectMainImageCandidateAction={async () => {}}
        />,
      );
      expect(screen.getByRole("spinbutton", { name: "Stories per run" })).toHaveValue(2);
      expect(screen.getByRole("status")).toHaveTextContent(
        "0 of 2 Story generations completed · Paused",
      );
      expect(submitted).toHaveLength(0);
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("online"));
      });
      expect(submitted).toHaveLength(0);
      await user.click(screen.getByRole("button", { name: "Resume queue" }));
      if (outcome === "running") expect(submitted).toHaveLength(0);
      if (outcome === "quota") {
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Ollama reported a usage or request limit",
        );
        expect(submitted).toHaveLength(0);
        await user.click(screen.getByRole("button", { name: "Resume queue" }));
      }
      if (outcome === "offline") {
        expect(await screen.findByRole("alert")).toHaveTextContent("nothing has been resubmitted");
        expect(submitted).toHaveLength(0);
        unavailable = false;
        await user.click(screen.getByRole("button", { name: "Resume queue" }));
      }
      await waitFor(
        () =>
          expect(screen.getByRole("status")).toHaveTextContent(
            "2 of 2 Story generations completed · Finished",
          ),
        { timeout: 4000 },
      );
      expect(submitted.map((data) => data.get("geoPlaceId"))).toEqual(
        outcome === "restarted" || outcome === "not-sent" ? ["Q1", "Q2"] : ["Q2"],
      );
      expect(
        submitted.every(
          (data) => data.get("aiModel") === "saved-model" && data.get("aiMode") === "cloud",
        ),
      ).toBe(true);
      if (outcome === "restarted") {
        expect(submitted[0].get("resume")).toBe("true");
        expect(submitted[0].get("progressId")).not.toBe(saved.pendingId);
      }
      if (outcome === "not-sent") expect(submitted[0].get("progressId")).toBe(saved.pendingId);
      expect(JSON.parse(localStorage.getItem(storyQueueStorageKey)!).pendingId).toBeUndefined();
    },
  );

  it("restores a queue created in another tab instead of overwriting it", async () => {
    let submissions = 0;
    render(
      <PoiRowsTable
        rows={[{ id: "Q1", rawPoi: { id: "Q1", name: "Q1", featureIndex: 0 } }]}
        globalArtifacts={[]}
        aiSelectionRef={{ current: { mode: "cloud", model: "different-model" } }}
        generateDraftStoryAction={async () => {}}
        generateDraftStoriesAction={async () => {
          submissions += 1;
          return [];
        }}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );
    const saved = JSON.stringify({
      version: 1,
      runs: [{ geoPlaceId: "Q1", name: "Q1", progressId: crypto.randomUUID() }],
      history: [],
      index: 0,
      started: 0,
      counted: [],
      completed: [],
      limit: 7,
      ai: { mode: "cloud", model: "saved-model" },
    });
    // This tab mounted before the other tab saved its queue.
    localStorage.setItem(storyQueueStorageKey, saved);
    await userEvent.setup().click(screen.getByRole("button", { name: "Generate missing stories" }));
    expect(submissions).toBe(0);
    expect(localStorage.getItem(storyQueueStorageKey)).toBe(saved);
    expect(screen.getByRole("spinbutton", { name: "Stories per run" })).toHaveValue(7);
    expect(screen.getByRole("button", { name: "Resume queue" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("existing queue was restored");
  });

  it("does not submit generations when browser storage cannot save the queue", async () => {
    localStorage.setItem("occupied", "x".repeat(4_999_900));
    let submissions = 0;
    render(
      <PoiRowsTable
        rows={Array.from({ length: 20 }, (_, index) => ({
          id: `Q${index}`,
          rawPoi: { id: `Q${index}`, name: `Place ${index}`, featureIndex: index },
        }))}
        globalArtifacts={[]}
        aiSelectionRef={{ current: { mode: "cloud", model: "test-model" } }}
        generateDraftStoryAction={async () => {}}
        generateDraftStoriesAction={async () => {
          submissions += 1;
          return [];
        }}
        refreshStoryContentAction={async () => {}}
        resolveRelatedPeopleAction={async () => {}}
        refreshMainImageCandidatesAction={async () => {}}
        refreshPoiTypesAction={async () => {}}
        selectMainImageCandidateAction={async () => {}}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Generate missing stories" }));
    expect(screen.getByRole("alert")).toHaveTextContent("queue could not be saved");
    expect(submissions).toBe(0);
    await userEvent.setup().click(screen.getByRole("button", { name: "Discard saved queue" }));
    expect(screen.getByRole("button", { name: "Generate missing stories" })).toBeEnabled();
    expect(localStorage.getItem("occupied")).not.toBeNull();
  });

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

  it.each(["pagination", "search", "status filters", "status name selection"])(
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
