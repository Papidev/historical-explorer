import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fetchOllamaResponse } from "./fetchOllamaResponse";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Ollama transport retries", () => {
  it.each([502, 503, 504, 429, 400])("limits retries for HTTP %s", async (status) => {
    let requests = 0;
    server.use(
      http.post("http://localhost:11434/api/chat", () => {
        requests += 1;
        return HttpResponse.json({ error: "Provider failure" }, { status });
      }),
    );
    const response = await fetchOllamaResponse("http://localhost:11434/api/chat", {
      method: "POST",
      body: JSON.stringify({ model: "test-model" }),
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Provider failure" });
    expect(requests).toBe([502, 503, 504].includes(status) ? 3 : 1);
  });

  it("does not send another request after cancellation during the retry wait", async () => {
    const controller = new AbortController();
    let requests = 0;
    server.use(
      http.post("http://localhost:11434/api/chat", () => {
        requests += 1;
        setTimeout(() => controller.abort(), 50);
        return new HttpResponse(null, { status: 502 });
      }),
    );
    await expect(
      fetchOllamaResponse("http://localhost:11434/api/chat", {
        method: "POST",
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(requests).toBe(1);
  });
});
