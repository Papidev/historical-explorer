// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { StrictMode } from "react";
import { AiProgressDialog } from "./AiProgressDialog";
import { BatchProgressDialog } from "./BatchProgressDialog";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("AI progress dialog", () => {
  // Cover the first portal mount before other dialogs complete Headless UI's handoff.
  it.each(["queue", "single"])(
    "follows new Person log entries in the %s progress dialog",
    async (mode) => {
      vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(900);
      const entries = [
        {
          at: "2026-09-25T00:00:01.000Z",
          message: "Generating Hadrian with Ollama (qwen3.5:9b).",
        },
      ];
      server.use(
        http.get("/api/admin/ai-progress/:runId", () =>
          HttpResponse.json({
            status: "running",
            startedAt: "2026-09-25T00:00:00.000Z",
            entries,
          }),
        ),
      );

      const { rerender } = render(
        mode === "single" ? (
          <AiProgressDialog
            runId="123"
            title="Resolving Related People"
            isFinished={false}
            onClose={() => {}}
          />
        ) : (
          <BatchProgressDialog
            runs={[{ geoPlaceId: "church", progressId: "123", name: "Church", isFinished: false }]}
            error={null}
            onClose={() => {}}
          />
        ),
        { wrapper: StrictMode },
      );
      if (mode === "queue") {
        await waitFor(() =>
          expect(screen.getByRole("region", { name: "Story queue progress" }).scrollTop).toBe(900),
        );
        await userEvent.setup().click(screen.getByRole("button", { name: "Show log for Church" }));
      }

      expect(
        await screen.findByText("Generating Hadrian with Ollama (qwen3.5:9b)."),
      ).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();

      const log = screen.getByRole("log");
      Object.defineProperty(log, "scrollHeight", { value: 600, configurable: true });
      log.scrollTop = 0;
      if (mode === "queue") {
        Object.defineProperty(
          screen.getByRole("region", { name: "Story queue progress" }),
          "scrollHeight",
          { value: 900, configurable: true },
        );
        screen.getByRole("region", { name: "Story queue progress" }).scrollTop = 0;
      }
      entries.push({ at: "2026-09-25T00:00:02.000Z", message: "Resolved Hadrian." });

      expect(
        await screen.findByText("Resolved Hadrian.", {}, { timeout: 2_500 }),
      ).toBeInTheDocument();
      await waitFor(() => expect(log.scrollTop).toBe(600));
      if (mode === "queue") {
        const progressRegion = screen.getByRole("region", { name: "Story queue progress" });
        await waitFor(() => expect(progressRegion.scrollTop).toBe(900));
        Object.defineProperty(progressRegion, "scrollHeight", { value: 1200, configurable: true });
        progressRegion.scrollTop = 0;
        rerender(
          <BatchProgressDialog
            runs={[
              { geoPlaceId: "church", progressId: "123", name: "Church", isFinished: true },
              { geoPlaceId: "museum", progressId: "456", name: "Museum", isFinished: false },
            ]}
            error={null}
            onClose={() => {}}
          />,
        );
        expect(await screen.findByText("Museum")).toBeVisible();
        await waitFor(() => expect(progressRegion.scrollTop).toBe(1200));
      }
    },
  );

  it("reports an unavailable log after generation finishes", async () => {
    server.use(
      http.get("/api/admin/ai-progress/:runId", () => new HttpResponse(null, { status: 500 })),
    );

    render(
      <AiProgressDialog runId="123" title="Generating Draft Story" isFinished onClose={() => {}} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load the generation log.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Retrying automatically");
  });

  it("waits without an error when the progress log has not been created yet", async () => {
    server.use(
      http.get("/api/admin/ai-progress/:runId", () => new HttpResponse(null, { status: 404 })),
    );

    render(
      <AiProgressDialog
        runId="123"
        title="Generating Draft Story"
        isFinished={false}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("Starting generation...")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["HTTP", "network"])(
    "reports a %s error and recovers while generation is running",
    async (error) => {
      server.use(
        http.get("/api/admin/ai-progress/:runId", () =>
          error === "HTTP" ? new HttpResponse(null, { status: 500 }) : HttpResponse.error(),
        ),
      );

      render(
        <AiProgressDialog
          runId="123"
          title="Generating Draft Story"
          isFinished={false}
          onClose={() => {}}
        />,
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unable to load generation progress. Retrying automatically.",
      );
      expect(screen.queryByText("Starting generation...")).not.toBeInTheDocument();

      server.use(
        http.get("/api/admin/ai-progress/:runId", () =>
          HttpResponse.json({
            status: "running",
            startedAt: new Date().toISOString(),
            entries: [{ at: new Date().toISOString(), message: "Fetching the Wikipedia Source." }],
          }),
        ),
      );

      expect(
        await screen.findByText("Fetching the Wikipedia Source.", {}, { timeout: 2_500 }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it.each(["single", "queue"])(
    "shows source-only warnings as notes in the %s dialog",
    async (mode) => {
      server.use(
        http.get("/api/admin/ai-progress/:runId", () =>
          HttpResponse.json({
            status: "partial",
            startedAt: "2026-09-25T00:00:00.000Z",
            failedSteps: [],
            entries: [
              {
                at: "2026-09-25T00:00:01.000Z",
                message: "No en Wikipedia article is linked to this entity.",
              },
              {
                at: "2026-09-25T00:00:02.000Z",
                message: "Content generated using available Wikipedia sources",
              },
            ],
          }),
        ),
      );
      render(
        mode === "single" ? (
          <AiProgressDialog
            runId="123"
            title="Generating Story Content"
            isFinished
            onClose={() => {}}
          />
        ) : (
          <BatchProgressDialog
            runs={[{ geoPlaceId: "church", progressId: "123", name: "Church", isFinished: true }]}
            error={null}
            onClose={() => {}}
          />
        ),
      );
      expect(await screen.findByText("Completed with notes")).toBeVisible();
      if (mode === "queue") {
        await userEvent.setup().click(screen.getByRole("button", { name: "Show log for Church" }));
      }
      expect(await screen.findByRole("status")).toHaveTextContent("Completed with notes");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Content generated using available Wikipedia sources",
      );
      expect(screen.getByRole("log")).toHaveTextContent(
        "No en Wikipedia article is linked to this entity.",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("Completed with issues")).not.toBeInTheDocument();
    },
  );

  it("lists every failed step in a partial generation", async () => {
    server.use(
      http.get("/api/admin/ai-progress/:runId", () =>
        HttpResponse.json({
          status: "partial",
          startedAt: "2026-09-25T00:00:00.000Z",
          failedSteps: ["Main Image Candidates", "Related People"],
          entries: [
            {
              at: "2026-09-25T00:00:01.000Z",
              message: "Draft generated with issues",
            },
          ],
        }),
      ),
    );

    render(
      <AiProgressDialog runId="123" title="Generating Draft Story" isFinished onClose={() => {}} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Main Image Candidates");
    expect(screen.getByRole("alert")).toHaveTextContent("Completed with issues");
    expect(screen.getByRole("alert")).toHaveTextContent("Related People");
  });

  it.each([false, true])("keeps waiting consistent (delayed: %s)", async (delayed) => {
    server.use(
      http.get("/api/admin/ai-progress/:runId", () =>
        HttpResponse.json({
          status: "waiting",
          startedAt: "2026-09-25T00:00:00.000Z",
          failedSteps: ["Wikipedia Source"],
          entries: [],
        }),
      ),
    );

    render(
      <AiProgressDialog runId="123" title="Refreshing Draft Story" isFinished onClose={() => {}} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Waiting for a source");
    expect(screen.getByRole("alert")).toHaveTextContent("Wikipedia Source");

    cleanup();
    let requests = 0;
    server.use(
      http.get("/api/admin/ai-progress/:runId", () => {
        requests += 1;
        return HttpResponse.json({
          status: delayed && requests === 1 ? "running" : "waiting",
          startedAt: "2026-09-25T00:00:00.000Z",
          failedSteps: ["Wikipedia Source"],
          entries: [],
        });
      }),
    );
    render(
      <BatchProgressDialog
        runs={[
          {
            geoPlaceId: "church",
            progressId: "123",
            name: "Church",
            isFinished: true,
            error: "No Wikipedia Source found",
          },
        ]}
        error={null}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText("Waiting for a source", {}, { timeout: 2_500 })).toBeVisible();
    expect(screen.queryByText("Failed", { exact: true })).not.toBeInTheDocument();
    const finalRequests = requests;
    await userEvent.setup().click(screen.getByRole("button", { name: "Show log for Church" }));
    expect(within(screen.getByRole("alert")).getByText("Waiting for a source")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Wikipedia Source");
    expect(screen.getAllByText("Waiting for a source")).toHaveLength(2);
    expect(requests).toBe(finalRequests);
  });

  it("keeps checking server progress after a lost action response and shows the actual outcome", async () => {
    let requests = 0;
    server.use(
      http.get("/api/admin/ai-progress/:runId", () => {
        requests += 1;
        if (requests === 1) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json({
          status: requests < 5 ? "running" : "succeeded",
          startedAt: "2026-10-10T17:31:00.000Z",
          entries: [
            {
              at: "2026-10-10T17:33:36.458Z",
              message:
                requests < 5
                  ? "Generating Pope Alexander I with Ollama (gpt-oss:20b-cloud)."
                  : "AI generation completed.",
            },
          ],
        });
      }),
    );
    render(
      <BatchProgressDialog
        runs={[
          {
            geoPlaceId: "church",
            progressId: "123",
            name: "Church",
            isFinished: true,
            error: "Failed to fetch",
          },
        ]}
        error={null}
        onClose={() => {}}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Show log for Church" }));
    expect(
      await screen.findByText(
        "Connection lost. Checking server progress; generation may still be running.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Generation failed")).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        "Generating Pope Alexander I with Ollama (gpt-oss:20b-cloud).",
        {},
        { timeout: 2500 },
      ),
    ).toBeVisible();
    expect(screen.queryByText("Failed", { exact: true })).not.toBeInTheDocument();
    expect(await screen.findByText("Generation completed.", {}, { timeout: 5000 })).toBeVisible();
    expect(screen.getByText("Completed", { exact: true })).toBeVisible();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Connection lost. Checking server progress; generation may still be running.",
      ),
    ).not.toBeInTheDocument();
  });
});
