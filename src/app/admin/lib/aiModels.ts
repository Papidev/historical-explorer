export const defaultAiModel = "qwen3:8b";
const defaultGeminiModel = "gemini-2.5-flash";

export type AiModel = string;

export type AiModelOption = {
  value: AiModel;
  label: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
  }>;
};

const aiModelLabels: Record<string, string> = {
  "qwen3:8b": "Qwen3 8B",
  "qwen3:14b": "Qwen3 14B",
  "qwen3:32b": "Qwen3 32B",
  "mistral-nemo:12b": "Mistral NeMo 12B",
  "gemma3:12b": "Gemma 3 12B",
  "gemma3:27b": "Gemma 3 27B",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "llama3.1:8b": "Llama 3.1 8B",
};

const getOllamaBaseUrl = () =>
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const getAiProvider = () =>
  process.env.AI_PROVIDER?.trim().toLowerCase() || "ollama";

const getGeminiModel = () => process.env.AI_MODEL?.trim() || defaultGeminiModel;

const getConfiguredGeminiModelOptions = () => {
  if (getAiProvider() !== "gemini") {
    return [] as AiModelOption[];
  }

  const model = getGeminiModel();
  return [
    {
      value: model,
      label: aiModelLabels[model] ?? model,
    },
  ];
};

export const loadInstalledAiModelOptions = async () => {
  const geminiModelOptions = getConfiguredGeminiModelOptions();
  if (getAiProvider() === "gemini") {
    return geminiModelOptions;
  }

  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[wiki-ai] Failed to load Ollama models: HTTP ${response.status}`);
      return [] as AiModelOption[];
    }

    const data = (await response.json()) as OllamaTagsResponse;

    const ollamaModelOptions = (data.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort()
      .map((name) => ({
        value: name,
        label: aiModelLabels[name] ?? name,
      }));

    return ollamaModelOptions;
  } catch (error) {
    console.warn(
      `[wiki-ai] Failed to load Ollama models: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    return [] as AiModelOption[];
  }
};
