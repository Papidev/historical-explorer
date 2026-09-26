// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiGenerationSettings } from "./AiGenerationSettings";

afterEach(cleanup);

describe("AI Generation settings", () => {
  it("shows one Cloud model for Story and People", () => {
    render(
      <AiGenerationSettings
        aiModeOptions={[
          {
            mode: "local",
            label: "Local",
            provider: "ollama",
            providerLabel: "Ollama",
            modelOptions: [{ value: "qwen3:8b", label: "Qwen3 8B" }],
            defaultModel: "qwen3:8b",
          },
          {
            mode: "cloud",
            label: "Cloud",
            provider: "ollama",
            providerLabel: "Ollama",
            modelOptions: [{ value: "gpt-oss:20b-cloud", label: "gpt-oss:20b-cloud" }],
            defaultModel: "gpt-oss:20b-cloud",
          },
        ]}
        initialAiSelection={{
          mode: "cloud",
          provider: "ollama",
          model: "gpt-oss:20b-cloud",
        }}
        selectionRef={{ current: { mode: "cloud", model: "gpt-oss:20b-cloud" } }}
      />,
    );

    expect(screen.getByText("Story and People model · Cloud")).toBeInTheDocument();
    expect(screen.getByText("gpt-oss:20b-cloud")).toBeInTheDocument();
    expect(screen.queryByText("People model · Local")).not.toBeInTheDocument();
  });
});
