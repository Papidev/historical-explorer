import { throwIfGenerationCancelled } from "@/server/generationCancellation";
import type { Source } from "@/server/storyWorkflow/types";
import { fetchWikimediaJson } from "./fetchWikimediaJson";
import { fetchWikiSnapshot } from "./fetchWiki";
import { buildWikipediaPageUrl } from "./io";
import { wikiTextToPlainText } from "./wikiText";

const allowedWikipediaLanguages = new Set(["en", "it", "fr", "de", "es"]);

type Entity = {
  claims?: Record<
    string,
    Array<{
      rank?: string;
      mainsnak: { datavalue?: { value: string | { id?: string } } };
      qualifiers?: Record<string, Array<{ datavalue?: { value: { time?: string } } }>>;
    }>
  >;
  sitelinks?: Record<string, { title?: string }>;
};

const readEntities = async (ids: string[]) => {
  const entities: Record<string, Entity> = {};
  for (let index = 0; index < ids.length; index += 50) {
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", ids.slice(index, index + 50).join("|"));
    url.searchParams.set("props", "claims|sitelinks");
    url.searchParams.set("format", "json");
    Object.assign(
      entities,
      (await fetchWikimediaJson<{ entities?: Record<string, Entity> }>(url)).entities,
    );
  }
  return entities;
};

const claimValues = (entity: Entity | undefined, property: string, current = true) =>
  (entity?.claims?.[property] ?? [])
    .filter((claim) => {
      if (claim.rank === "deprecated") return false;
      if (!current) return true;
      const today = new Date().toISOString().slice(0, 10);
      const start = claim.qualifiers?.P580?.[0]?.datavalue?.value.time;
      const end = claim.qualifiers?.P582?.[0]?.datavalue?.value.time;
      return (!start || start.slice(1, 11) <= today) && (!end || end.slice(1, 11) > today);
    })
    .flatMap(({ mainsnak }) => (mainsnak.datavalue ? [mainsnak.datavalue.value] : []));

export const acquireWikipediaSources = async ({
  wikidataId,
  initialSource,
  countryProperty = "P17",
  contextWikidataIds = [],
}: {
  wikidataId?: string;
  initialSource?: Source;
  countryProperty?: "P17" | "P27";
  contextWikidataIds?: string[];
}) => {
  const sources: Source[] =
    initialSource?.content.trim() &&
    allowedWikipediaLanguages.has(new URL(initialSource.url).hostname.split(".")[0])
      ? [initialSource]
      : [];
  const warnings: string[] = [];
  if (initialSource && !initialSource.content.trim())
    warnings.push("The initial Wikipedia article has no usable content.");
  const languages = new Set(["en"]);
  let entity: Entity | undefined;
  if (wikidataId) {
    try {
      const roots = await readEntities([...new Set([wikidataId, ...contextWikidataIds])]);
      entity = roots[wikidataId];
      const countryIds = [
        ...new Set(
          [
            ...claimValues(entity, countryProperty, countryProperty !== "P27"),
            ...contextWikidataIds.flatMap((id) => claimValues(roots[id], "P17")),
          ].flatMap((value) => (typeof value === "object" && value.id ? [value.id] : [])),
        ),
      ];
      if (!countryIds.length)
        warnings.push(
          "No country was identified in Wikidata; local Wikipedia languages could not be determined.",
        );
      const countries = await readEntities(countryIds);
      const languageIds = [
        ...new Set(
          countryIds.flatMap((id) => {
            const values = claimValues(countries[id], "P37");
            if (!values.length)
              warnings.push(`No official languages were found for country ${id}.`);
            return values.flatMap((value) =>
              typeof value === "object" && value.id ? [value.id] : [],
            );
          }),
        ),
      ];
      const languageEntities = await readEntities(languageIds);
      for (const id of languageIds) {
        const codes = claimValues(languageEntities[id], "P424").filter(
          (value): value is string =>
            typeof value === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value),
        );
        if (!codes.length)
          warnings.push(`Official language ${id} has no usable Wikimedia language code.`);
        codes
          .filter((code) => allowedWikipediaLanguages.has(code))
          .forEach((code) => languages.add(code));
      }
    } catch (error) {
      throwIfGenerationCancelled();
      warnings.push(`Could not determine all local Wikipedia editions: ${String(error)}`);
    }
  } else {
    warnings.push(
      "No Wikidata identity is available; local Wikipedia languages could not be determined.",
    );
  }

  for (const language of languages) {
    if (sources.some((source) => new URL(source.url).hostname === `${language}.wikipedia.org`))
      continue;
    const title = entity?.sitelinks?.[`${language}wiki`]?.title;
    if (!title) {
      warnings.push(`No ${language} Wikipedia article is linked to this entity.`);
      continue;
    }
    try {
      const snapshot = await fetchWikiSnapshot(title, language);
      if (snapshot.isDisambiguation || snapshot.wikidataId !== wikidataId) {
        throw new Error("The Wikipedia article does not identify the expected entity.");
      }
      const content = wikiTextToPlainText(snapshot.fullText);
      if (!content.trim()) throw new Error("The Wikipedia article has no usable content.");
      sources.push({
        id: sources.length ? `wikipedia-${language}` : "wikipedia",
        kind: "wikipedia",
        title: snapshot.title,
        wikidataId,
        url: buildWikipediaPageUrl(snapshot.title, language),
        content,
        links: snapshot.links,
      });
    } catch (error) {
      throwIfGenerationCancelled();
      warnings.push(`Could not acquire ${language} Wikipedia: ${String(error)}`);
    }
  }
  if (!sources.length) throw new Error(`No usable Wikipedia sources. ${warnings.join(" ")}`);
  warnings.forEach((warning) => console.warn(`[wiki-sources] ${warning}`));
  return { sources, warnings };
};
