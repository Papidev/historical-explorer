export const defaultAiModel = "qwen3:8b";

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
  "llama3.1:8b": "Llama 3.1 8B",
};

const getOllamaBaseUrl = () =>
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

export const loadInstalledAiModelOptions = async () => {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[wiki-ai] Failed to load Ollama models: HTTP ${response.status}`);
      return [] as AiModelOption[];
    }

    const data = (await response.json()) as OllamaTagsResponse;

    return (data.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort()
      .map((name) => ({
        value: name,
        label: aiModelLabels[name] ?? name,
      }));
  } catch (error) {
    console.warn(
      `[wiki-ai] Failed to load Ollama models: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    return [] as AiModelOption[];
  }
};
