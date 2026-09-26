import { parseEnglishWikipediaTitle } from "./normalize";
import { fetchWikimediaJson } from "./fetchWikimediaJson";
import type { PoiInput, ResolvedPage } from "./types";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const resolveViaWikidata = async (wikidataId: string): Promise<string | undefined> => {
  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "sitelinks");
  url.searchParams.set("sitefilter", "enwiki");
  url.searchParams.set("format", "json");

  type WikidataResponse = {
    entities?: Record<
      string,
      {
        sitelinks?: {
          enwiki?: {
            title?: string;
          };
        };
      }
    >;
  };

  const data = await fetchWikimediaJson<WikidataResponse>(url);
  const entity = data.entities?.[wikidataId];
  return entity?.sitelinks?.enwiki?.title;
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

  if (poi.sourceHints.wikidata) {
    const title = await resolveViaWikidata(poi.sourceHints.wikidata);
    if (title) {
      return {
        method: "wikidata_enwiki",
        candidates: [{ title, source: "wikidata_enwiki" }],
        selected: { title },
      };
    }
  }

  throw new Error(
    `Unable to resolve an English Wikipedia page for POI ${poi.id}: no valid English Wikipedia tag or Wikidata English sitelink was found.`,
  );
};
