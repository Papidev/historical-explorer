// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { AdminActionResult } from "../../lib/types";
import { PoiRowsTable } from "./index";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("POI actions", () => {
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
