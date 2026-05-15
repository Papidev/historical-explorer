type OllamaChatChunk = {
  message?: {
    content?: string;
  };
  done?: boolean;
  eval_count?: number;
};

const getOllamaBaseUrl = () =>
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const getOllamaModel = (model?: string) =>
  model?.trim() || process.env.OLLAMA_MODEL || "qwen3:8b";

export const enrichWikiText = async (content: string, model?: string) => {
  const startedAt = Date.now();
  const ollamaModel = getOllamaModel(model);
  console.info(
    `[wiki-ai] Starting Ollama enrichment with ${ollamaModel}. Input: ${content.length} chars.`,
  );

  const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      stream: true,
      options: {
        temperature: 0.2,
      },
      messages: [
        {
          role: "system",
          content:
            "Rewrite historical POI content as an engaging tourist-guide article for a map detail panel. Write for someone who is deciding whether to visit the spot or is standing there now. Preserve facts, dates, names, and source meaning. Do not invent information. Use flowing short paragraphs with concrete visual cues, visitor-facing context, and a sense of why the place is worth pausing for. Avoid schematic label/value writing such as 'Design:', 'Material:', or 'Symbolism:'. Avoid bullet lists unless the source is only a compact inventory that cannot be made readable as prose. Use few section headings, only when they improve navigation. Keep it concise, readable, engaging, and sober. Return plain text only.",
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

  if (!response.body) {
    throw new Error("Ollama returned an empty response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferedContent = "";
  let enrichedContent = "";
  let lastLogAt = startedAt;
  let lastLoggedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    bufferedContent += decoder.decode(value, { stream: !done });

    const lines = bufferedContent.split("\n");
    bufferedContent = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const chunk = JSON.parse(line) as OllamaChatChunk;
      const chunkContent = chunk.message?.content;
      if (chunkContent) {
        enrichedContent += chunkContent;
      }

      if (
        chunkContent &&
        (lastLoggedLength === 0 ||
          Date.now() - lastLogAt >= 2000 ||
          enrichedContent.length - lastLoggedLength >= 1000)
      ) {
        console.info(
          `[wiki-ai] Ollama generated ${enrichedContent.length} chars so far...`,
        );
        lastLogAt = Date.now();
        lastLoggedLength = enrichedContent.length;
      }

      if (chunk.done && chunk.eval_count) {
        console.info(`[wiki-ai] Ollama generated ${chunk.eval_count} tokens.`);
      }
    }

    if (done) {
      break;
    }
  }

  const trimmedContent = enrichedContent.trim();
  if (!trimmedContent) {
    throw new Error("Ollama returned empty content.");
  }

  console.info(
    `[wiki-ai] Completed Ollama enrichment in ${Math.round((Date.now() - startedAt) / 1000)}s. Output: ${trimmedContent.length} chars.`,
  );

  return `${trimmedContent}\n`;
};
