// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiGenerationSettings } from "./AiGenerationSettings";

afterEach(cleanup);

describe("AI Generation settings", () => {
  it("shows the Cloud Story model and Local People model together in Cloud mode", () => {
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

    expect(screen.getByText("Story model · Cloud")).toBeInTheDocument();
    expect(screen.getByText("gpt-oss:20b-cloud")).toBeInTheDocument();
    expect(screen.getByText("People model · Local")).toBeInTheDocument();
    expect(screen.getByText("Qwen3 8B")).toBeInTheDocument();
    expect(screen.getByText("Ollama · free")).toBeInTheDocument();
  });
});
