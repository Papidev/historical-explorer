import wtf from "wtf_wikipedia";
import type { WikiSnapshot } from "./types";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const EXCLUDED_SECTION_TITLES = ["References", "See also"];

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

const stripExcludedSections = (content: string) => {
  const doc = wtf(content);

  // Remove all matching sections (and nested content), preserving the rest of the article wikitext.
  for (const sectionTitle of EXCLUDED_SECTION_TITLES) {
    let section = doc.section(sectionTitle);
    while (section) {
      section.remove();
      section = doc.section(sectionTitle);
    }
  }

  return doc.wikitext().trim();
};

const toWikiPathSegment = (value: string) => encodeURIComponent(value.trim().replace(/\s+/g, "_"));

const resolveCommonsTitleFromWikidata = async (wikidataId: string) => {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "sitelinks");
  url.searchParams.set("sitefilter", "commonswiki");
  url.searchParams.set("format", "json");

  type WikidataResponse = {
    entities?: Record<
      string,
      {
        sitelinks?: {
          commonswiki?: {
            title?: string;
          };
        };
      }
    >;
  };

  const data = await fetchJson<WikidataResponse>(url);
  return data.entities?.[wikidataId]?.sitelinks?.commonswiki?.title;
};

const replaceCommonsInlineTemplate = (content: string, articleTitle: string, commonsTitle?: string) => {
  const commonsTemplatePattern = /\{\{\s*commons-inline(?:\|([^}]+))?\s*\}\}/gi;

  return content.replace(commonsTemplatePattern, (_match, rawParam: string | undefined) => {
    const firstParam = rawParam?.split("|")[0]?.trim();
    const targetTitle = firstParam || commonsTitle || articleTitle;
    const displayTitle = targetTitle.replace(/_/g, " ");
    const href = `https://commons.wikimedia.org/wiki/${toWikiPathSegment(targetTitle)}`;
    return `[${href} Media related to ${displayTitle} at Wikimedia Commons]`;
  });
};

export const fetchWikiSnapshot = async (title: string): Promise<WikiSnapshot> => {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "revisions|pageprops");
  url.searchParams.set("titles", title);
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  type QueryResponse = {
    query?: {
      pages?: Array<{
        missing?: boolean;
        pageprops?: {
          wikibase_item?: string;
        };
        revisions?: Array<{
          slots?: {
            main?: {
              content?: string;
            };
          };
        }>;
      }>;
    };
  };

  const data = await fetchJson<QueryResponse>(url);
  const page = data.query?.pages?.[0];
  if (!page || page.missing) {
    throw new Error(`Wikipedia page not found for title "${title}".`);
  }

  const wikidataId = page.pageprops?.wikibase_item;
  const commonsTitle = wikidataId ? await resolveCommonsTitleFromWikidata(wikidataId) : undefined;
  const withExpandedCommons = replaceCommonsInlineTemplate(
    page.revisions?.[0]?.slots?.main?.content ?? "",
    title,
    commonsTitle,
  );

  return {
    fullText: stripExcludedSections(withExpandedCommons),
  };
};
