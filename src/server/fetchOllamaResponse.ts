import {
  fetchWithGenerationCancellation,
  throwIfGenerationCancelled,
} from "./generationCancellation";

export const fetchOllamaResponse = async (url: string, init: RequestInit): Promise<Response> => {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetchWithGenerationCancellation(url, init);
    if (![502, 503, 504].includes(response.status) || attempt === 3) return response;

    await response.text();
    console.warn(`[ollama] HTTP ${response.status}; retrying request (${attempt}/2).`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    throwIfGenerationCancelled();
    init.signal?.throwIfAborted();
  }
};
