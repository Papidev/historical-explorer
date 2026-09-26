// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { AiProgressDialog } from "./AiProgressDialog";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("AI progress dialog", () => {
  it("shows a Person generation event while the action is running", async () => {
    server.use(
      http.get("/api/admin/ai-progress/:runId", () =>
        HttpResponse.json({
          status: "running",
          startedAt: "2026-09-25T00:00:00.000Z",
          entries: [
            {
              at: "2026-09-25T00:00:01.000Z",
              message: "Generating Hadrian with Ollama (qwen3.5:9b).",
            },
          ],
        }),
      ),
    );

    render(
      <AiProgressDialog
        runId="123"
        title="Resolving Related People"
        isFinished={false}
        onClose={() => {}}
      />,
    );

    expect(
      await screen.findByText("Generating Hadrian with Ollama (qwen3.5:9b)."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
  });
});
