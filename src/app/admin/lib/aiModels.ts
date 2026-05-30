export type AiMode = "local" | "cloud";
export type AiProvider = "ollama" | "gemini";
export type AiModel = string;

export const defaultAiMode: AiMode = "local";
export const defaultLocalAiModel = "qwen3:8b";
const defaultGeminiModel = "gemini-2.5-flash";

export type AiModelOption = {
  value: AiModel;
  label: string;
};

export type AiModeOption = {
  mode: AiMode;
  label: string;
  provider: AiProvider;
  providerLabel: string;
  modelOptions: AiModelOption[];
  defaultModel: AiModel;
};

export type AiSelection = {
  mode: AiMode;
  provider: AiProvider;
  model: AiModel;
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

const aiProviderLabels: Record<AiProvider, string> = {
  gemini: "Gemini",
  ollama: "Ollama",
};

const getOllamaBaseUrl = () =>
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const pickAiMode = (value: string | undefined): AiMode =>
  value?.trim().toLowerCase() === "cloud" ? "cloud" : defaultAiMode;

const pickAiProvider = (
  value: string | undefined,
  fallback: AiProvider,
): AiProvider => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "gemini" || normalized === "ollama") {
    return normalized;
  }

  return fallback;
};

const getConfiguredAiMode = () => pickAiMode(process.env.AI_MODE);

const getLocalAiProvider = () =>
  pickAiProvider(process.env.LOCAL_AI_PROVIDER, "ollama");

const getCloudAiProvider = () =>
  pickAiProvider(process.env.CLOUD_AI_PROVIDER, "gemini");

const getLocalAiModel = () =>
  process.env.LOCAL_AI_MODEL?.trim() || defaultLocalAiModel;

const getCloudAiModel = () =>
  process.env.CLOUD_AI_MODEL?.trim() || defaultGeminiModel;

const toAiModelOption = (name: string) => ({
  value: name,
  label: aiModelLabels[name] ?? name,
});

const ensureModelOption = (
  options: AiModelOption[],
  configuredModel: AiModel,
) =>
  options.some((option) => option.value === configuredModel)
    ? options
    : [toAiModelOption(configuredModel), ...options];

const loadLocalAiModelOptions = async () => {
  const configuredModel = getLocalAiModel();
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[wiki-ai] Failed to load Ollama models: HTTP ${response.status}`);
      return [toAiModelOption(configuredModel)];
    }

    const data = (await response.json()) as OllamaTagsResponse;

    const ollamaModelOptions = (data.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort()
      .map(toAiModelOption);

    return ensureModelOption(ollamaModelOptions, configuredModel);
  } catch (error) {
    console.warn(
      `[wiki-ai] Failed to load Ollama models: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    return [toAiModelOption(configuredModel)];
  }
};

const loadCloudAiModelOptions = () => [toAiModelOption(getCloudAiModel())];

export const loadAiModeOptions = async () =>
  [
    {
      mode: "local",
      label: "Local",
      provider: getLocalAiProvider(),
      providerLabel: aiProviderLabels[getLocalAiProvider()],
      modelOptions: await loadLocalAiModelOptions(),
      defaultModel: getLocalAiModel(),
    },
    {
      mode: "cloud",
      label: "Cloud",
      provider: getCloudAiProvider(),
      providerLabel: aiProviderLabels[getCloudAiProvider()],
      modelOptions: loadCloudAiModelOptions(),
      defaultModel: getCloudAiModel(),
    },
  ] satisfies AiModeOption[];

export const getInitialAiSelection = async () => {
  const mode = getConfiguredAiMode();
  const options = await loadAiModeOptions();
  const option = options.find((item) => item.mode === mode) ?? options[0];

  return {
    mode: option.mode,
    provider: option.provider,
    model: option.defaultModel,
  } satisfies AiSelection;
};

export const resolveAiSelection = async (formData: FormData) => {
  const options = await loadAiModeOptions();
  const modeValue = formData.get("aiMode");
  const modelValue = formData.get("aiModel");
  const mode =
    typeof modeValue === "string" ? pickAiMode(modeValue) : getConfiguredAiMode();
  const option = options.find((item) => item.mode === mode);
  if (!option) {
    throw new Error("Invalid AI mode.");
  }

  const model =
    typeof modelValue === "string" && modelValue.trim().length > 0
      ? modelValue.trim()
      : option.defaultModel;
  if (!option.modelOptions.some((item) => item.value === model)) {
    throw new Error("Invalid AI model.");
  }

  return {
    mode: option.mode,
    provider: option.provider,
    model,
  } satisfies AiSelection;
};
