import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AdminPoiRow, GeoJson, GeoJsonFeature, PoiItem } from "./types";

const toRowKey = (value: string) => value.trim().toLowerCase();

const parseGeoJson = (filePath: string) => {
  const raw = readFileSync(filePath, "utf-8");

  return JSON.parse(raw) as GeoJson;
};

const toPoiItems = (features: GeoJsonFeature[] | undefined) =>
  (features ?? []).map((feature, index) => {
    const properties = feature.properties ?? {};
    const id =
      (typeof feature.wikidataId === "string" && feature.wikidataId.trim()) ||
      (typeof properties.wikidata === "string" && properties.wikidata.trim()) ||
      (typeof feature.id === "string" && feature.id.trim()) ||
      (typeof feature.id === "number" ? `${feature.id}` : "") ||
      `missing-id-${index}`;
    const name = (typeof properties.name === "string" && properties.name.trim()) || id;
    const wikidata = typeof properties.wikidata === "string" ? properties.wikidata.trim() : undefined;

    return { id, name, wikidata, featureIndex: index } satisfies PoiItem;
  });

const loadWikiSnapshots = (directoryPath: string) =>
  readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort()
    .map((fileName, index) => {
      const filePath = path.join(directoryPath, fileName);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as { id?: unknown };
      const id =
        (typeof parsed.id === "string" && parsed.id.trim()) ||
        fileName.replace(/\.json$/u, "") ||
        `missing-id-${index}`;

      return {
        item: { id, name: `${id}.json`, featureIndex: index } satisfies PoiItem,
        json: raw,
      };
    });

const loadMdxFiles = (directoryPath: string) =>
  readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith(".mdx"))
    .sort()
    .map((fileName, index) => {
      const filePath = path.join(directoryPath, fileName);
      const raw = readFileSync(filePath, "utf-8");
      const id = fileName.replace(/\.mdx$/u, "") || `missing-id-${index}`;

      return {
        item: { id, name: fileName, featureIndex: index } satisfies PoiItem,
        content: raw,
      };
    });

const toPoiRows = (
  rawPois: PoiItem[],
  transformedPois: Array<{ item: PoiItem; json: string }>,
  wikiPois: Array<{ item: PoiItem; json: string }>,
  mdxPois: Array<{ item: PoiItem; content: string }>,
) => {
  const rowsById = new Map<string, AdminPoiRow>();

  for (const rawPoi of rawPois) {
    rowsById.set(toRowKey(rawPoi.id), { id: rawPoi.id, rawPoi });
  }

  for (const { item, json } of transformedPois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(
      rowKey,
      row ? { ...row, transformedPoi: item, transformedJson: json } : { id: item.id, transformedPoi: item, transformedJson: json },
    );
  }

  for (const { item, json } of wikiPois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(
      rowKey,
      row ? { ...row, wikiPoi: item, wikiJson: json } : { id: item.id, wikiPoi: item, wikiJson: json },
    );
  }

  for (const { item, content } of mdxPois) {
    const rowKey = toRowKey(item.id);
    const row = rowsById.get(rowKey);
    rowsById.set(
      rowKey,
      row ? { ...row, mdxPoi: item, mdxContent: content } : { id: item.id, mdxPoi: item, mdxContent: content },
    );
  }

  return Array.from(rowsById.values());
};

export const loadPoiLists = () => {
  try {
    const rawPath = path.join(process.cwd(), "public", "data", "raw", "rome-pois-raw.geojson");
    const transformedPath = path.join(process.cwd(), "public", "data", "rome-pois.geojson");
    const wikiDirectoryPath = path.join(process.cwd(), "data", "wiki");
    const mdxDirectoryPath = path.join(process.cwd(), "content", "pois", "rome");

    const rawPois = toPoiItems(parseGeoJson(rawPath).features);
    const transformedGeoJson = parseGeoJson(transformedPath);
    const transformedPois = (transformedGeoJson.features ?? []).map((feature, index) => ({
      item: toPoiItems([feature])[0] ?? {
        id: `missing-id-${index}`,
        name: `missing-id-${index}`,
        featureIndex: index,
      },
      json: JSON.stringify(feature, null, 2),
    }));
    const wikiPois = loadWikiSnapshots(wikiDirectoryPath);
    const mdxPois = loadMdxFiles(mdxDirectoryPath);
    const rows = toPoiRows(rawPois, transformedPois, wikiPois, mdxPois);

    return { rows, error: null };
  } catch (error) {
    return {
      rows: [] as AdminPoiRow[],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
