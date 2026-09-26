const userAgent = "CulturalAtlas/0.1 (https://github.com/Papidev/historical-explorer)";

export const fetchWikimediaJson = async <T>(url: URL): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let retryDelay = 0;

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal: controller.signal,
      });
      if (response.ok) return (await response.json()) as T;

      lastError = new Error(`HTTP ${response.status} ${response.statusText} from ${url.hostname}`);
      if (response.status !== 429 && response.status < 500) throw lastError;

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const seconds = retryAfter ? Number(retryAfter) : NaN;
        const delay = Number.isFinite(seconds)
          ? seconds * 1_000
          : retryAfter
            ? Date.parse(retryAfter) - Date.now()
            : NaN;
        retryDelay = Number.isFinite(delay) ? Math.max(0, delay) : 5_000 * attempt;
      } else {
        retryDelay = 500 * attempt;
      }
    } catch (error) {
      lastError = error;
      if (
        error instanceof Error &&
        /^HTTP 4\d\d /.test(error.message) &&
        !/^HTTP 429 /.test(error.message)
      ) {
        throw error;
      }
      retryDelay ||= 500 * attempt;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < 3) {
      if (retryDelay > 60_000) {
        throw new Error(
          `${String(lastError)}; retry after ${Math.ceil(retryDelay / 1_000)} seconds.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Request failed after 3 attempts: ${String(lastError)}`);
};
