// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { generateDraftStories } from "../../lib/generateDraftStories";
import { BatchGeneration } from "./BatchGeneration";

const server = setupServer();
const rows = Array.from({ length: 22 }, (_, featureIndex) => ({
  id: `place-${featureIndex}`,
  rawPoi: { id: `place-${featureIndex}`, name: `Place ${featureIndex}`, featureIndex },
}));
const props = {
  rows,
  aiSelectionRef: { current: { mode: "cloud" as const, model: "test-model" } },
  action: generateDraftStories,
  disabled: false,
  onRunningChange: () => {},
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

describe("Automatic Story generation", () => {
  it("processes more than 20 POIs sequentially and continues after individual errors", async () => {
    const submitted: FormData[] = [];
    let active = 0;
    server.use(
      http.post("/api/admin/story-generations", async ({ request }) => {
        active += 1;
        expect(active).toBe(1);
        const data = await request.formData();
        submitted.push(data);
        active -= 1;
        return HttpResponse.json([
          {
            geoPlaceId: data.get("geoPlaceId"),
            progressId: data.get("progressId"),
            ...(submitted.length === 2
              ? { error: "No Wikipedia source", storyGenerationStarted: false }
              : {}),
          },
        ]);
      }),
    );
    render(<BatchGeneration {...props} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Start automatic generation" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("22 of 22 POIs processed · Finished"),
    );
    expect(submitted.map((data) => data.get("geoPlaceId"))).toEqual(rows.map((row) => row.id));
    expect(new Set(submitted.map((data) => data.get("progressId"))).size).toBe(22);
    expect(submitted.every((data) => data.get("aiModel") === "test-model")).toBe(true);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("finishes the active POI before pausing and starts the next POI on resume", async () => {
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const submitted: string[] = [];
    server.use(
      http.post("/api/admin/story-generations", async ({ request }) => {
        const data = await request.formData();
        submitted.push(String(data.get("geoPlaceId")));
        if (submitted.length === 1) await pending;
        return HttpResponse.json([
          { geoPlaceId: data.get("geoPlaceId"), progressId: data.get("progressId") },
        ]);
      }),
    );
    render(<BatchGeneration {...props} rows={rows.slice(0, 2)} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Start automatic generation" }));
    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent("Generating Place 0");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Pausing after current POI..." })).toBeDisabled();
    expect(submitted).toEqual(["place-0"]);
    await act(async () => {
      finish();
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("1 of 2 POIs processed · Paused"),
    );
    await user.click(screen.getByRole("button", { name: "Start automatic generation" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("2 of 2 POIs processed · Finished"),
    );
    expect(submitted).toEqual(["place-0", "place-1"]);
  });

  it("stops submitting after the page unmounts and ignores old browser queue state", async () => {
    localStorage.setItem("historical-explorer:rome:story-queue:v1", "old queue");
    let finish = () => {};
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const submitted: string[] = [];
    server.use(
      http.post("/api/admin/story-generations", async ({ request }) => {
        const data = await request.formData();
        submitted.push(String(data.get("geoPlaceId")));
        await pending;
        return HttpResponse.json([
          { geoPlaceId: data.get("geoPlaceId"), progressId: data.get("progressId") },
        ]);
      }),
    );
    const { unmount } = render(<BatchGeneration {...props} />);
    const user = userEvent.setup();
    expect(screen.getByRole("status")).toHaveTextContent("22 POIs without Story Content");
    await user.click(screen.getByRole("button", { name: "Start automatic generation" }));
    await waitFor(() => expect(submitted).toHaveLength(1));
    unmount();
    await act(async () => {
      finish();
      await pending;
    });
    expect(submitted).toEqual(["place-0"]);
    render(<BatchGeneration {...props} />);
    expect(screen.getByRole("button", { name: "Start automatic generation" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("22 POIs without Story Content");
    expect(submitted).toHaveLength(1);
    expect(localStorage.getItem("historical-explorer:rome:story-queue:v1")).toBe("old queue");
  });

  it.each(["Ollama HTTP 429: quota", "partial quota", "Failed to fetch"])(
    "pauses after %s and preserves the diagnostic log",
    async (failure) => {
      let count = 0;
      server.use(
        http.post("/api/admin/story-generations", async ({ request }) => {
          const data = await request.formData();
          count += 1;
          return HttpResponse.json([
            {
              geoPlaceId: data.get("geoPlaceId"),
              progressId: data.get("progressId"),
              ...(failure === "partial quota"
                ? {
                    result: { warning: { title: "People incomplete", details: "Ollama HTTP 402" } },
                  }
                : { error: failure }),
            },
          ]);
        }),
        http.get("/api/admin/ai-progress/:runId", () =>
          HttpResponse.json({
            status: "failed",
            startedAt: "2026-10-16T00:00:00.000Z",
            error: "Provider quota exceeded",
            entries: [
              { at: "2026-10-16T00:00:01.000Z", message: "Diagnostic details from saved log" },
            ],
          }),
        ),
      );
      render(<BatchGeneration {...props} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Start automatic generation" }));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("1 of 22 POIs processed · Paused"),
      );
      expect(count).toBe(1);
      expect(screen.getByRole("alert")).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Show generation logs" }));
      await user.click(screen.getByRole("button", { name: "Show log for Place 0" }));
      expect(
        await within(screen.getByRole("log")).findByText("Diagnostic details from saved log"),
      ).toBeVisible();
    },
  );
});
