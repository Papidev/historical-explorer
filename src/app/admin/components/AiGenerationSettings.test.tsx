// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getInitialAiSelection, loadAiModeOptions, resolveAiSelection } from "../lib/aiModels";
import { AiGenerationSettings } from "./AiGenerationSettings";

const server = setupServer(
  http.get("http://localhost:11434/api/tags", () =>
    HttpResponse.json({ models: [{ name: "qwen3:8b" }] }),
  ),
);

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
  vi.unstubAllEnvs();
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

describe("AI Generation settings", () => {
  it.each(["gpt-oss:20b-cloud", "gpt-oss:120b-cloud", "custom-cloud-model"])(
    "offers both Ollama Cloud models and preserves the configured default %s",
    async (defaultModel) => {
      vi.stubEnv("AI_MODE", "cloud");
      vi.stubEnv("CLOUD_AI_PROVIDER", "ollama");
      vi.stubEnv("CLOUD_AI_MODEL", defaultModel);
      vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
      const selectionRef = { current: { mode: "cloud" as "cloud" | "local", model: defaultModel } };
      render(
        <AiGenerationSettings
          aiModeOptions={await loadAiModeOptions()}
          initialAiSelection={await getInitialAiSelection()}
          selectionRef={selectionRef}
        />,
      );

      const user = userEvent.setup();
      expect(screen.getByText(defaultModel)).toBeVisible();
      expect(screen.queryByText("People model · Local")).not.toBeInTheDocument();
      for (const model of ["gpt-oss:120b-cloud", "gpt-oss:20b-cloud"]) {
        await user.click(screen.getByRole("button", { name: /Story and People model/ }));
        expect(screen.getByRole("option", { name: "gpt-oss:20b-cloud" })).toBeVisible();
        expect(screen.getByRole("option", { name: "gpt-oss:120b-cloud" })).toBeVisible();
        await user.click(screen.getByRole("option", { name: model }));
        expect(selectionRef.current).toEqual({ mode: "cloud", model });
        const input = new FormData();
        input.set("aiMode", selectionRef.current.mode);
        input.set("aiModel", selectionRef.current.model);
        expect(await resolveAiSelection(input)).toEqual({
          mode: "cloud",
          provider: "ollama",
          model,
        });
      }
      vi.stubEnv("CLOUD_AI_PROVIDER", "gemini");
      vi.stubEnv("CLOUD_AI_MODEL", "gemini-2.5-flash");
      expect(
        (await loadAiModeOptions()).find(({ mode }) => mode === "cloud")?.modelOptions,
      ).toEqual([{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }]);
    },
  );
});
