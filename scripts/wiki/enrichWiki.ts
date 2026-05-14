type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

const getOllamaBaseUrl = () =>
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const getOllamaModel = () => process.env.OLLAMA_MODEL ?? "qwen3:8b";

export const enrichWikiText = async (content: string) => {
  const startedAt = Date.now();
  console.info(
    `[wiki-ai] Starting Ollama enrichment with ${getOllamaModel()}. Input: ${content.length} chars.`,
  );

  const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getOllamaModel(),
      stream: false,
      options: {
        temperature: 0.2,
      },
      messages: [
        {
          role: "system",
          content:
            "Rewrite historical POI content for a map detail panel. Keep it concise and readable for visitors. Preserve facts, dates, names, and source meaning. Do not invent information. Prefer short paragraphs. Engaging style but sober. Return plain text only.",
        },
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  const enrichedContent = data.message?.content?.trim();
  if (!enrichedContent) {
    throw new Error("Ollama returned empty content.");
  }

  console.info(
    `[wiki-ai] Completed Ollama enrichment in ${Math.round((Date.now() - startedAt) / 1000)}s. Output: ${enrichedContent.length} chars.`,
  );

  return `${enrichedContent}\n`;
};
