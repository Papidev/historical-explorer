import { parseEnglishWikipediaTitle } from "./normalize";
import { fetchWikimediaJson } from "./fetchWikimediaJson";
import type { PoiInput, ResolvedPage, WikipediaLanguage } from "./types";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

export class WikipediaSourceMissingError extends Error {
  constructor(poiId: string) {
    super(`No unambiguous English or Italian Wikipedia page was found for POI ${poiId}.`);
    this.name = "WikipediaSourceMissingError";
  }
}

// Retain the existing error export for callers that used the English-only resolver.
export { WikipediaSourceMissingError as EnglishWikipediaSourceMissingError };

const resolveViaWikidata = async (wikidataId: string) => {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "sitelinks");
  url.searchParams.set("sitefilter", "enwiki|itwiki");
  url.searchParams.set("format", "json");
  const data = await fetchWikimediaJson<{
    entities?: Record<
      string,
      { sitelinks?: { enwiki?: { title?: string }; itwiki?: { title?: string } } }
    >;
  }>(url);
  return data.entities?.[wikidataId]?.sitelinks;
};

const normalizeTitle = (title: string) =>
  title
    .normalize("NFKC")
    .replace(/_/g, " ")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("it");

const findPage = async (title: string, language: WikipediaLanguage) => {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "pageprops|langlinks");
  url.searchParams.set("titles", title);
  url.searchParams.set("redirects", "1");
  url.searchParams.set("lllang", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const data = await fetchWikimediaJson<{
    query?: {
      pages?: Array<{
        title?: string;
        missing?: boolean;
        pageprops?: { disambiguation?: string };
        langlinks?: Array<{ lang: string; title: string }>;
      }>;
    };
  }>(url);
  const page = data.query?.pages?.[0];
  return page && !page.missing && page.title && page.pageprops?.disambiguation === undefined
    ? { title: page.title, englishTitle: page.langlinks?.find(({ lang }) => lang === "en")?.title }
    : undefined;
};

const searchByName = async (name: string, language: WikipediaLanguage) => {
  if (!name.trim()) return undefined;
  const exact = await findPage(name, language);
  if (exact) return exact;
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", name);
  url.searchParams.set("srnamespace", "0");
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("srprop", "redirecttitle");
  url.searchParams.set("format", "json");
  const data = await fetchWikimediaJson<{
    query?: { search?: Array<{ title: string; redirecttitle?: string }> };
  }>(url);
  const matches = (data.query?.search ?? []).filter((page) =>
    [page.title, page.redirecttitle].some(
      (title) => title && normalizeTitle(title) === normalizeTitle(name),
    ),
  );
  if (matches.length !== 1) return undefined;
  return findPage(matches[0].title, language);
};

export const resolvePageForPoi = async (poi: PoiInput): Promise<ResolvedPage> => {
  const englishTagTitle = parseEnglishWikipediaTitle(poi.sourceHints.wikipedia);
  if (englishTagTitle) {
    return {
      method: "wikipedia_tag_en",
      candidates: [{ title: englishTagTitle, source: "wikipedia_tag_en" }],
      selected: { title: englishTagTitle },
    };
  }

  const sitelinks = poi.sourceHints.wikidata
    ? await resolveViaWikidata(poi.sourceHints.wikidata)
    : undefined;
  if (sitelinks?.enwiki?.title) {
    return {
      method: "wikidata_enwiki",
      candidates: [{ title: sitelinks.enwiki.title, source: "wikidata_enwiki" }],
      selected: { title: sitelinks.enwiki.title },
    };
  }

  const english = await searchByName(poi.name, "en");
  if (english) {
    return {
      method: "name_enwiki",
      candidates: [{ title: english.title, source: "name_enwiki" }],
      selected: { title: english.title },
    };
  }

  const italianTagTitle = /^it:/i.test(poi.sourceHints.wikipedia ?? "")
    ? poi.sourceHints.wikipedia?.slice(3).trim().replace(/_/g, " ")
    : undefined;
  const italianTitle = sitelinks?.itwiki?.title ?? italianTagTitle;
  const italian =
    (italianTitle ? await findPage(italianTitle, "it") : undefined) ??
    (await searchByName(poi.name, "it"));
  if (italian) {
    const method = sitelinks?.itwiki?.title
      ? "wikidata_itwiki"
      : italianTagTitle
        ? "wikipedia_tag_it"
        : "name_itwiki";
    return {
      method,
      candidates: [{ title: italian.title, source: method }],
      selected: {
        title: italian.englishTitle ?? italian.title,
        language: italian.englishTitle ? "en" : "it",
      },
    };
  }

  throw new WikipediaSourceMissingError(poi.id);
};
