import { parseEnglishWikipediaTitle } from "./normalize";
import { fetchWikimediaJson } from "./fetchWikimediaJson";
import { isInvalidPoiIdentity } from "./isInvalidPoiIdentity";
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
  url.searchParams.set("props", "sitelinks|claims");
  url.searchParams.set("sitefilter", "enwiki|itwiki");
  url.searchParams.set("format", "json");
  const data = await fetchWikimediaJson<{
    entities?: Record<
      string,
      {
        sitelinks?: { enwiki?: { title?: string }; itwiki?: { title?: string } };
        claims?: NonNullable<Parameters<typeof isInvalidPoiIdentity>[0]>["claims"];
      }
    >;
  }>(url);
  const entity = data.entities?.[wikidataId];
  return { sitelinks: entity?.sitelinks, isInvalid: isInvalidPoiIdentity(entity) };
};

const normalizeTitle = (title: string) =>
  title
    .normalize("NFKC")
    .replace(/_/g, " ")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("it");

type WikipediaPage = {
  title?: string;
  missing?: boolean;
  pageprops?: { disambiguation?: string; wikibase_item?: string };
  langlinks?: Array<{ lang: string; title: string }>;
  coordinates?: Array<{
    lat: number;
    lon: number;
    primary?: string | boolean;
    globe?: string;
    type?: string;
  }>;
};

const isNearbyPlace = (page: WikipediaPage, coordinates: PoiInput["coordinates"]) => {
  const coordinate = page?.coordinates?.find(
    ({ primary, globe }) => (primary === true || primary === "") && globe === "earth",
  );
  // A title alone is not identity evidence. Require a local physical place, not a city,
  // administrative area, event, or article that only mentions a nearby coordinate.
  if (
    !coordinate ||
    ![
      "landmark",
      "edu",
      "airport",
      "railwaystation",
      "mountain",
      "river",
      "waterbody",
      "isle",
      "forest",
      "pass",
    ].includes(coordinate.type ?? "")
  )
    return false;
  const distance =
    2 *
    6_371_000 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(((coordinate.lat - coordinates.lat) * Math.PI) / 360) ** 2 +
            Math.cos((coordinates.lat * Math.PI) / 180) *
              Math.cos((coordinate.lat * Math.PI) / 180) *
              Math.sin(((coordinate.lon - coordinates.lng) * Math.PI) / 360) ** 2,
        ),
      ),
    );
  // Allow up to 1 km for differences between a POI centroid and the article's point.
  return distance <= 1_000;
};

const findPage = async (
  title: string,
  language: WikipediaLanguage,
  poiCoordinates?: PoiInput["coordinates"],
) => {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set(
    "prop",
    poiCoordinates ? "pageprops|langlinks|coordinates" : "pageprops|langlinks",
  );
  if (poiCoordinates) {
    url.searchParams.set("coprimary", "primary");
    url.searchParams.set("coprop", "type|globe");
  }
  url.searchParams.set("titles", title);
  url.searchParams.set("redirects", "1");
  url.searchParams.set("lllang", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const data = await fetchWikimediaJson<{ query?: { pages?: WikipediaPage[] } }>(url);
  const page = data.query?.pages?.[0];
  if (poiCoordinates && (!page || !isNearbyPlace(page, poiCoordinates))) return undefined;
  if (
    page?.pageprops?.wikibase_item &&
    (await resolveViaWikidata(page.pageprops.wikibase_item)).isInvalid
  )
    return undefined;
  return page && !page.missing && page.title && page.pageprops?.disambiguation === undefined
    ? {
        title: page.title,
        englishTitle: page.langlinks?.find(({ lang }) => lang === "en")?.title,
        wikidataId: page.pageprops?.wikibase_item,
      }
    : undefined;
};

const searchByName = async (poi: PoiInput, language: WikipediaLanguage) => {
  const name = poi.name;
  if (!name.trim()) return undefined;
  const exact = await findPage(name, language, poi.coordinates);
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
  return findPage(matches[0].title, language, poi.coordinates);
};

const searchByCoordinates = async (poi: PoiInput): Promise<ResolvedPage | undefined> => {
  const nearbyPages: Array<{
    title: string;
    englishTitle?: string;
    wikidataId?: string;
    language: WikipediaLanguage;
  }> = [];
  for (const language of ["en", "it"] as const) {
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "geosearch");
    url.searchParams.set("ggscoord", `${poi.coordinates.lat}|${poi.coordinates.lng}`);
    url.searchParams.set("ggsradius", "1000");
    url.searchParams.set("ggslimit", "50");
    url.searchParams.set("ggsprimary", "primary");
    url.searchParams.set("ggsglobe", "earth");
    url.searchParams.set("ggsnamespace", "0");
    url.searchParams.set("prop", "pageprops|langlinks|coordinates");
    url.searchParams.set("lllang", "en");
    url.searchParams.set("coprimary", "primary");
    url.searchParams.set("coprop", "type|globe");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    const data = await fetchWikimediaJson<{ query?: { pages?: WikipediaPage[] } }>(url);
    for (const page of data.query?.pages ?? []) {
      if (
        page.title &&
        !page.missing &&
        page.pageprops?.disambiguation === undefined &&
        isNearbyPlace(page, poi.coordinates)
      ) {
        nearbyPages.push({
          title: page.title,
          englishTitle: page.langlinks?.find(({ lang }) => lang === "en")?.title,
          wikidataId: page.pageprops?.wikibase_item,
          language,
        });
      }
    }
  }

  const ids = [
    ...new Set(nearbyPages.flatMap(({ wikidataId }) => (wikidataId ? [wikidataId] : []))),
  ];
  const namesById = new Map<string, string[]>();
  const invalidIds = new Set<string>();
  for (let index = 0; index < ids.length; index += 50) {
    const url = new URL(WIKIDATA_API);
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", ids.slice(index, index + 50).join("|"));
    url.searchParams.set("props", "labels|aliases|claims");
    url.searchParams.set("languages", "en|it");
    url.searchParams.set("format", "json");
    const data = await fetchWikimediaJson<{
      entities?: Record<
        string,
        {
          claims?: NonNullable<Parameters<typeof isInvalidPoiIdentity>[0]>["claims"];
          labels?: Record<string, { value: string }>;
          aliases?: Record<string, Array<{ value: string }>>;
        }
      >;
    }>(url);
    for (const [id, entity] of Object.entries(data.entities ?? {})) {
      if (isInvalidPoiIdentity(entity)) invalidIds.add(id);
      namesById.set(id, [
        ...Object.values(entity.labels ?? {}).map(({ value }) => value),
        ...Object.values(entity.aliases ?? {})
          .flat()
          .map(({ value }) => value),
      ]);
    }
  }

  const matches = new Map<string, (typeof nearbyPages)[number]>();
  for (const page of nearbyPages) {
    if (invalidIds.has(page.wikidataId ?? "")) continue;
    if (
      [page.title, page.englishTitle, ...(namesById.get(page.wikidataId ?? "") ?? [])].some(
        (name) => name && normalizeTitle(name) === normalizeTitle(poi.name),
      )
    ) {
      const key =
        page.wikidataId ??
        `${page.englishTitle ? "en" : page.language}:${page.englishTitle ?? page.title}`;
      if (!matches.has(key)) matches.set(key, page);
    }
  }
  if (matches.size === 1) {
    const [page] = matches.values();
    const method = page.language === "en" ? "coordinates_enwiki" : "coordinates_itwiki";
    return {
      method,
      candidates: [{ title: page.title, source: method }],
      selected: {
        title: page.englishTitle ?? page.title,
        language: page.englishTitle ? "en" : page.language,
        wikidataId: page.wikidataId,
      },
    };
  }
};

export const resolvePageForPoi = async (poi: PoiInput): Promise<ResolvedPage> => {
  const englishTagTitle = parseEnglishWikipediaTitle(poi.sourceHints.wikipedia);
  const englishTag = englishTagTitle ? await findPage(englishTagTitle, "en") : undefined;
  if (englishTag) {
    return {
      method: "wikipedia_tag_en",
      candidates: [{ title: englishTag.title, source: "wikipedia_tag_en" }],
      selected: { title: englishTag.title, wikidataId: englishTag.wikidataId },
    };
  }

  const entity = poi.sourceHints.wikidata
    ? await resolveViaWikidata(poi.sourceHints.wikidata)
    : undefined;
  const sitelinks = entity?.isInvalid ? undefined : entity?.sitelinks;
  const englishLinked = sitelinks?.enwiki?.title
    ? await findPage(sitelinks.enwiki.title, "en")
    : undefined;
  if (englishLinked) {
    return {
      method: "wikidata_enwiki",
      candidates: [{ title: englishLinked.title, source: "wikidata_enwiki" }],
      selected: {
        title: englishLinked.title,
        wikidataId: englishLinked.wikidataId ?? poi.sourceHints.wikidata,
      },
    };
  }

  const italianTagTitle = /^it:/i.test(poi.sourceHints.wikipedia ?? "")
    ? poi.sourceHints.wikipedia?.slice(3).trim().replace(/_/g, " ")
    : undefined;
  const italianTitle = sitelinks?.itwiki?.title ?? italianTagTitle;
  const linkedItalian = italianTitle ? await findPage(italianTitle, "it") : undefined;
  if (linkedItalian) {
    const method = sitelinks?.itwiki?.title ? "wikidata_itwiki" : "wikipedia_tag_it";
    return {
      method,
      candidates: [{ title: linkedItalian.title, source: method }],
      selected: {
        title: linkedItalian.englishTitle ?? linkedItalian.title,
        language: linkedItalian.englishTitle ? "en" : "it",
        wikidataId: linkedItalian.wikidataId,
      },
    };
  }

  const english = await searchByName(poi, "en");
  if (english) {
    return {
      method: "name_enwiki",
      candidates: [{ title: english.title, source: "name_enwiki" }],
      selected: { title: english.title, wikidataId: english.wikidataId },
    };
  }

  const italian = await searchByName(poi, "it");
  if (italian) {
    const method = "name_itwiki";
    return {
      method,
      candidates: [{ title: italian.title, source: method }],
      selected: {
        title: italian.englishTitle ?? italian.title,
        language: italian.englishTitle ? "en" : "it",
        wikidataId: italian.wikidataId,
      },
    };
  }

  const nearby = await searchByCoordinates(poi);
  if (nearby) return nearby;
  throw new WikipediaSourceMissingError(poi.id);
};
