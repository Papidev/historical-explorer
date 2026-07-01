import { resolvePageForPoi } from "./resolve";
import type { MainImageCandidate, MainImageDiscoveredVia, PoiInput } from "./types";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const COMMONS_FILE_BASE_URL = "https://commons.wikimedia.org/wiki/File:";

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

const normalizeCommonsFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/^File:/i, "")
    .replace(/ /g, "_");

const toCommonsPageUrl = (fileName: string) =>
  `${COMMONS_FILE_BASE_URL}${encodeURIComponent(normalizeCommonsFileName(fileName))}`;

const getExtMetadataString = (
  metadata: Record<string, { value?: string }> | undefined,
  key: string,
) => {
  const value = metadata?.[key]?.value;
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const stripHtml = (value?: string) =>
  value
    ?.replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

const discoverP18FileName = async (wikidataId?: string) => {
  if (!wikidataId) {
    return undefined;
  }

  const url = new URL(WIKIDATA_API);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", wikidataId);
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");

  type WikidataResponse = {
    entities?: Record<
      string,
      {
        claims?: {
          P18?: Array<{
            mainsnak?: {
              datavalue?: {
                value?: unknown;
              };
            };
          }>;
        };
      }
    >;
  };

  const data = await fetchJson<WikidataResponse>(url);
  const value = data.entities?.[wikidataId]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;

  return typeof value === "string" ? value : undefined;
};

const discoverPageImageFileName = async (title: string) => {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("titles", title);
  url.searchParams.set("piprop", "name");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  type PageImageResponse = {
    query?: {
      pages?: Array<{
        pageimage?: string;
      }>;
    };
  };

  const data = await fetchJson<PageImageResponse>(url);
  return data.query?.pages?.[0]?.pageimage;
};

const fetchCommonsCandidate = async (
  commonsFileName: string,
  discoveredVia: MainImageDiscoveredVia,
): Promise<MainImageCandidate | undefined> => {
  const normalizedFileName = normalizeCommonsFileName(commonsFileName);
  const url = new URL(COMMONS_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("titles", `File:${normalizedFileName}`);
  url.searchParams.set("iiprop", "url|size|extmetadata");
  url.searchParams.set("iiurlwidth", "640");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  type CommonsResponse = {
    query?: {
      pages?: Array<{
        missing?: boolean;
        imageinfo?: Array<{
          url?: string;
          thumburl?: string;
          width?: number;
          height?: number;
          extmetadata?: Record<string, { value?: string }>;
        }>;
      }>;
    };
  };

  const data = await fetchJson<CommonsResponse>(url);
  const page = data.query?.pages?.[0];
  const imageInfo = page?.imageinfo?.[0];
  if (page?.missing || !imageInfo?.url || !imageInfo.thumburl) {
    return undefined;
  }

  const license =
    stripHtml(getExtMetadataString(imageInfo.extmetadata, "LicenseShortName")) ??
    stripHtml(getExtMetadataString(imageInfo.extmetadata, "UsageTerms")) ??
    stripHtml(getExtMetadataString(imageInfo.extmetadata, "Copyrighted"));
  const author =
    stripHtml(getExtMetadataString(imageInfo.extmetadata, "Artist")) ??
    stripHtml(getExtMetadataString(imageInfo.extmetadata, "Credit"));
  const attribution =
    stripHtml(getExtMetadataString(imageInfo.extmetadata, "Attribution")) ?? author;

  return {
    commonsFileName: normalizedFileName,
    commonsPageUrl: toCommonsPageUrl(normalizedFileName),
    thumbnailUrl: imageInfo.thumburl,
    originalImageUrl: imageInfo.url,
    license,
    attribution,
    author,
    width: imageInfo.width,
    height: imageInfo.height,
    discoveredVia,
    isProposed: false,
  };
};

export const fetchMainImageCandidates = async (poi: PoiInput) => {
  const resolvedPage = await resolvePageForPoi(poi);
  const discoveredFiles = [
    {
      commonsFileName: await discoverP18FileName(poi.sourceHints.wikidata),
      discoveredVia: "wikidata-p18" as const,
    },
    {
      commonsFileName: await discoverPageImageFileName(resolvedPage.selected.title),
      discoveredVia: "wikipedia-page-image" as const,
    },
  ];
  const seenFileNames = new Set<string>();
  const candidates: MainImageCandidate[] = [];

  for (const discoveredFile of discoveredFiles) {
    if (!discoveredFile.commonsFileName) {
      continue;
    }

    const normalizedFileName = normalizeCommonsFileName(discoveredFile.commonsFileName);
    const seenKey = normalizedFileName.toLowerCase();
    if (seenFileNames.has(seenKey)) {
      continue;
    }

    seenFileNames.add(seenKey);
    const candidate = await fetchCommonsCandidate(normalizedFileName, discoveredFile.discoveredVia);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates.slice(0, 3).map((candidate, index) => ({
    ...candidate,
    isProposed: index === 0,
  }));
};
