import type { WikiSnapshot } from "./types";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

const fetchJson = async <T>(url: URL, attempts = 2): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Request failed after ${attempts} attempts: ${String(lastError)}`);
};

export const fetchWikiSnapshot = async (title: string): Promise<WikiSnapshot> => {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("titles", title);
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  type QueryResponse = {
    query?: {
      pages?: Array<{
        extract?: string;
        missing?: boolean;
      }>;
    };
  };

  const data = await fetchJson<QueryResponse>(url);
  const page = data.query?.pages?.[0];
  if (!page || page.missing) {
    throw new Error(`Wikipedia page not found for title "${title}".`);
  }

  return {
    fullText: page.extract ?? "",
  };
};
