import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { findPoiInGeoJson, getDefaultInputPath } from "@/server/wikiPipeline/io";
import { sanitizePoiIdForFile, toCitySlug } from "@/server/wikiPipeline/normalize";
import type { PoiInput } from "@/server/wikiPipeline/types";

export type PoiType = { id: string; label: string };
export type PoiTypesResult = { types: PoiType[]; error?: string };

type WikidataEntity = {
  missing?: string;
  claims?: {
    P31?: Array<{
      rank?: string;
      mainsnak?: { datavalue?: { value?: { id?: string } } };
    }>;
  };
  labels?: { en?: { value?: string } };
};

const fetchEntities = async (ids: string[], props: string) => {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", ids.join("|"));
  url.searchParams.set("props", props);
  url.searchParams.set("languages", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikidata returned HTTP ${response.status}.`);
  }
  const data = (await response.json()) as {
    entities?: Record<string, WikidataEntity>;
    error?: { info?: string };
  };
  if (data.error || !data.entities) {
    throw new Error(data.error?.info ?? "Wikidata returned no entities.");
  }
  return data.entities;
};

const fetchPoiTypes = async (wikidataId: string): Promise<PoiType[]> => {
  const entity = (await fetchEntities([wikidataId], "claims"))[wikidataId];
  if (!entity || entity.missing) {
    throw new Error(`Wikidata entity ${wikidataId} was not found.`);
  }
  const ids = [
    ...new Set(
      (entity.claims?.P31 ?? [])
        .filter(({ rank }) => rank !== "deprecated")
        .map(({ mainsnak }) => mainsnak?.datavalue?.value?.id)
        .filter((id): id is string => Boolean(id && /^Q[1-9]\d*$/.test(id))),
    ),
  ];
  if (ids.length === 0) {
    return [];
  }

  const types = await fetchEntities(ids, "labels");
  return ids.map((id) => ({ id, label: types[id]?.labels?.en?.value ?? id }));
};

export const createPoiTypes = ({
  directory,
  findPointOfInterest,
}: {
  directory: string;
  findPointOfInterest: (poiId: string) => PoiInput | undefined;
}) => {
  const filePath = (poiId: string) => path.join(directory, `${sanitizePoiIdForFile(poiId)}.json`);

  const get = (poiId: string): PoiTypesResult | undefined => {
    const file = filePath(poiId);
    return existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf-8")) as PoiTypesResult)
      : undefined;
  };

  return {
    get,
    refresh: async (poiId: string): Promise<PoiTypesResult> => {
      const pointOfInterest = findPointOfInterest(poiId);
      if (!pointOfInterest) {
        throw new Error(`POI ${poiId} was not found.`);
      }
      if (!pointOfInterest.sourceHints.wikidata) {
        return { types: [], error: "No Wikidata ID." };
      }

      let result: PoiTypesResult;
      try {
        result = { types: await fetchPoiTypes(pointOfInterest.sourceHints.wikidata) };
      } catch (error) {
        console.warn(`[poi-types] Acquisition failed for ${poiId}.`, error);
        result = {
          types: get(poiId)?.types ?? [],
          error: error instanceof Error ? error.message : String(error),
        };
      }

      const file = filePath(poiId);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(`${file}.tmp`, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
      renameSync(`${file}.tmp`, file);
      return result;
    },
  };
};

export const createPoiTypesForCity = (city: string) =>
  createPoiTypes({
    directory: path.join(process.cwd(), "data", toCitySlug(city), "generated", "wikidata"),
    findPointOfInterest: (poiId) => {
      try {
        return findPoiInGeoJson(getDefaultInputPath(city), poiId, city);
      } catch {
        return undefined;
      }
    },
  });

export const poiTypes = createPoiTypesForCity("rome");
