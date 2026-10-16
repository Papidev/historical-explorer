import { fetchWikiSnapshot } from "@/server/wikiPipeline/fetchWiki";
import { fetchWikimediaJson } from "@/server/wikiPipeline/fetchWikimediaJson";
import type { WikiSnapshot, WikipediaLanguage } from "@/server/wikiPipeline/types";

export const fetchPersonSnapshot = async (
  title: string,
  language?: WikipediaLanguage,
): Promise<WikiSnapshot & { isHuman?: boolean }> => {
  const snapshot = await fetchWikiSnapshot(title, language);
  if (!snapshot.wikidataId || snapshot.isDisambiguation) return snapshot;

  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", snapshot.wikidataId);
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  const data = await fetchWikimediaJson<{
    entities?: Record<
      string,
      {
        claims?: {
          P31?: Array<{
            rank?: string;
            mainsnak?: { datavalue?: { value?: { id?: string } } };
          }>;
        };
      }
    >;
    error?: { info?: string };
  }>(url);
  if (data.error || !data.entities?.[snapshot.wikidataId]) {
    throw new Error(data.error?.info ?? `Wikidata returned no entity for ${snapshot.wikidataId}.`);
  }
  const types = (data.entities[snapshot.wikidataId].claims?.P31 ?? [])
    .filter(({ rank }) => rank !== "deprecated")
    .flatMap(({ mainsnak }) => mainsnak?.datavalue?.value?.id ?? []);
  return {
    ...snapshot,
    ...(types.length ? { isHuman: types.includes("Q5") } : {}),
  };
};
