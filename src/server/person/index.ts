import type {
  AiSelection,
  RelatedPeopleResolutionResult,
  RelatedPerson,
  Source,
} from "@/server/storyWorkflow";
import { fetchMainImageCandidates } from "@/server/storyWorkflow/mainImageCandidates";
import { fetchWikiSnapshot } from "@/server/wikiPipeline/fetchWiki";
import { buildWikipediaPageUrl } from "@/server/wikiPipeline/io";
import { getPersonDisplayName } from "@/utils/getPersonDisplayName";
import { toCitySlug } from "@/server/wikiPipeline/normalize";
import type {
  MainImageCandidate,
  WikiSnapshot,
  WikipediaLanguage,
} from "@/server/wikiPipeline/types";
import { wikiTextToPlainText } from "@/server/wikiPipeline/wikiText";
import { personRepository, type PersonRepository } from "./filesystemRepository";
import { generatePerson } from "./generatePerson";
import { toPublicPerson, type Person, type PersonContent, type PersonSource } from "./types";

const normalizeTitle = (value: string) =>
  value
    .split("#")[0]
    .normalize("NFKC")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");

const normalizeName = (value: string) =>
  normalizeTitle(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘ʼ']/g, "")
    .replace(/[\p{Pd}.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^(?:(?:pope|emperor|empress|king|queen|prince|princess|saint|st|sir|dame|cardinal|bishop|archbishop|doctor|dr)\s+)+/,
      "",
    );

const findMatchingLinks = (name: string, links: WikiSnapshot["links"]) => {
  const exact = links.filter(
    ({ label, title }) =>
      normalizeTitle(label) === normalizeTitle(name) ||
      normalizeTitle(title) === normalizeTitle(name),
  );
  return new Map(
    (exact.length > 0
      ? exact
      : links.filter(
          ({ label, title }) =>
            normalizeName(label) === normalizeName(name) ||
            normalizeName(title) === normalizeName(name) ||
            (!/\([^)]*\)\s*$/.test(name) &&
              normalizeName(title.replace(/\s*\([^)]*\)\s*$/, "")) === normalizeName(name)),
        )
    ).map((link) => [
      `${link.language ?? "en"}:${normalizeTitle(link.title)}`,
      { ...link, title: link.title.split("#")[0] },
    ]),
  );
};

export const getSourceLinkIssue = (name: string, sources: Source[]) => {
  if (sources.length === 0) return undefined;

  const matchingLinks = findMatchingLinks(
    name,
    sources.flatMap((source) => source.links ?? []),
  );
  if (matchingLinks.size === 0) {
    return "No matching Wikipedia link exists in the current Story source.";
  }
  if (matchingLinks.size > 1) {
    return "Multiple Wikipedia links match this name in the current Story source.";
  }
  return undefined;
};

const getProvider = (ai: AiSelection): "ollama" | "gemini" =>
  ai.mode === "local"
    ? process.env.LOCAL_AI_PROVIDER === "gemini"
      ? "gemini"
      : "ollama"
    : process.env.CLOUD_AI_PROVIDER === "ollama"
      ? "ollama"
      : "gemini";

type PersonDependencies = {
  repository: PersonRepository;
  fetchSnapshot: (title: string, language?: WikipediaLanguage) => Promise<WikiSnapshot>;
  generateContent: (
    person: { name: string; wikidataId: string },
    sources: PersonSource[],
    config: { mode: "local" | "cloud"; provider: "ollama" | "gemini"; model: string },
  ) => Promise<PersonContent>;
  fetchImageCandidates: (input: {
    id: string;
    name: string;
    city: string;
    coordinates: { lat: number; lng: number };
    sourceHints: { wikipedia: string; wikidata: string };
  }) => Promise<MainImageCandidate[]>;
  now: () => Date;
};

const allocatePersonId = (name: string, repository: PersonRepository) => {
  const baseId = toCitySlug(name) || "person";
  const ids = new Set(repository.list().map(({ id }) => id));
  let id = baseId;
  let suffix = 2;
  while (ids.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
};

const generateAndPersist = async ({
  id,
  name,
  wikidataId,
  snapshot,
  ai,
  dependencies,
  onProgress,
}: {
  id: string;
  name: string;
  wikidataId: string;
  snapshot: WikiSnapshot;
  ai: AiSelection & { provider: "ollama" | "gemini" };
  dependencies: PersonDependencies;
  onProgress?: (message: string) => void;
}) => {
  const source: PersonSource = {
    id: "wikipedia",
    kind: "wikipedia",
    title: snapshot.title,
    url: buildWikipediaPageUrl(snapshot.title, snapshot.language),
    content: wikiTextToPlainText(snapshot.fullText),
  };
  onProgress?.(
    `Generating ${name} with ${ai.provider === "ollama" ? "Ollama" : "Gemini"} (${ai.model}).`,
  );
  const content = await dependencies.generateContent(
    { name: getPersonDisplayName(name), wikidataId },
    [source],
    {
      mode: ai.mode,
      provider: ai.provider,
      model: ai.model,
    },
  );
  onProgress?.(`Finding an optional image for ${name}.`);
  const image = (
    await dependencies
      .fetchImageCandidates({
        id,
        name,
        city: "",
        coordinates: { lat: 0, lng: 0 },
        sourceHints: {
          wikipedia: `${snapshot.language ?? "en"}:${snapshot.title}`,
          wikidata: wikidataId,
        },
      })
      .catch((error: unknown) => {
        if (!/\b429\b|too many requests/i.test(String(error))) throw error;
        console.warn(`Person image discovery was rate limited for ${name}: ${String(error)}`);
        return [];
      })
  ).find(({ license, attribution }) => license && attribution);
  const person: Person = {
    // Allocate after all asynchronous work so concurrent People cannot claim the same ID.
    id: allocatePersonId(name, dependencies.repository),
    name: getPersonDisplayName(name),
    wikidataId,
    wikipediaTitle: snapshot.title,
    content,
    ...(image ? { image } : {}),
    source: {
      id: source.id,
      kind: source.kind,
      title: source.title,
      url: source.url,
    },
    generation: {
      aiMode: ai.mode,
      aiProvider: ai.provider,
      aiModel: ai.model,
      completedAt: dependencies.now().toISOString(),
    },
  };
  dependencies.repository.replace(person, source);
  return person;
};

export const createPeople = (overrides: Partial<PersonDependencies> = {}) => {
  const dependencies: PersonDependencies = {
    repository: personRepository,
    fetchSnapshot: fetchWikiSnapshot,
    generateContent: generatePerson,
    fetchImageCandidates: fetchMainImageCandidates,
    now: () => new Date(),
    ...overrides,
  };

  const pendingPeople = new Map<string, Promise<Person>>();

  return {
    regenerate: async ({
      personId,
      ai,
      onProgress,
    }: {
      personId: string;
      ai: AiSelection;
      onProgress?: (message: string) => void;
    }) => {
      const person = dependencies.repository.list().find(({ id }) => id === personId);
      if (!person) throw new Error("Person not found.");
      if (pendingPeople.has(person.wikidataId)) {
        throw new Error("This Person is already being generated. Try again when it finishes.");
      }
      const pending = (async () => {
        const source = dependencies.repository.readSource(person);
        const provider = getProvider(ai);
        onProgress?.(`Generating ${person.name} with ${provider} (${ai.model}).`);
        const content = await dependencies.generateContent(person, [source], { ...ai, provider });
        const updated = {
          ...person,
          content,
          generation: {
            aiMode: ai.mode,
            aiProvider: provider,
            aiModel: ai.model,
            completedAt: dependencies.now().toISOString(),
          },
        };
        dependencies.repository.replace(updated, source);
        return updated;
      })().finally(() => pendingPeople.delete(person.wikidataId));
      pendingPeople.set(person.wikidataId, pending);
      return pending;
    },
    resolveAndGenerateMissing: async ({
      relatedPeople: references,
      storySources,
      ai,
      onProgress,
    }: {
      relatedPeople: RelatedPerson[];
      storySources: Source[];
      ai: AiSelection;
      onProgress?: (message: string) => void;
    }) => {
      const links = storySources.flatMap((source) => source.links ?? []);
      const uniquePeople = new Map<string, RelatedPerson>();
      for (const reference of references) {
        const person =
          reference.personId && dependencies.repository.get(reference.personId)
            ? reference
            : { name: reference.name, sourceIds: reference.sourceIds };
        const matchingLinks = findMatchingLinks(person.name, links);
        let key =
          matchingLinks.size === 1
            ? `wikipedia:${matchingLinks.keys().next().value}`
            : `name:${normalizeName(person.name)}`;
        if (
          person.personId &&
          uniquePeople.get(key)?.personId &&
          uniquePeople.get(key)?.personId !== person.personId
        ) {
          key = `${key}\0${person.personId}`;
        }
        const existing = uniquePeople.get(key);
        uniquePeople.set(
          key,
          existing
            ? {
                ...existing,
                ...(existing.personId || person.personId
                  ? { personId: existing.personId ?? person.personId }
                  : {}),
                sourceIds: Array.from(new Set([...existing.sourceIds, ...person.sourceIds])),
              }
            : { ...person, sourceIds: [...person.sourceIds] },
        );
      }
      const relatedPeople = Array.from(uniquePeople.values());
      const personAi = { ...ai, provider: getProvider(ai) };
      const resolved: RelatedPerson[] = [];
      const failures: RelatedPeopleResolutionResult["failures"] = [];

      for (let index = 0; index < relatedPeople.length; index += 1) {
        const person = relatedPeople[index];
        if (person.personId) {
          onProgress?.(
            `Skipping ${person.name} (${index + 1}/${relatedPeople.length}): already resolved.`,
          );
          resolved.push(person);
          continue;
        }
        onProgress?.(`Checking ${person.name} (${index + 1}/${relatedPeople.length}).`);

        const matchingLinks = findMatchingLinks(person.name, links);
        if (matchingLinks.size === 0) {
          onProgress?.(`Skipping ${person.name}: no matching Wikipedia link in the Story source.`);
          continue;
        }
        try {
          const matchingSnapshots = new Map<string, WikiSnapshot>();
          for (const link of matchingLinks.values()) {
            onProgress?.(`Fetching the Wikipedia article for ${person.name}: ${link.title}.`);
            try {
              const snapshot = await dependencies.fetchSnapshot(link.title, link.language);
              if (snapshot.isDisambiguation) {
                onProgress?.(`Ignoring ${link.title}: Wikipedia disambiguation page.`);
              } else {
                matchingSnapshots.set(
                  `${snapshot.language ?? "en"}:${normalizeTitle(snapshot.title)}`,
                  snapshot,
                );
              }
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.startsWith('Wikipedia page not found for title "')
              ) {
                onProgress?.(`Skipping ${person.name}: Wikipedia page not found.`);
                continue;
              }
              throw error;
            }
          }
          if (matchingSnapshots.size === 0) {
            onProgress?.(
              `Skipping ${person.name}: no personal Wikipedia article among the matching links.`,
            );
            continue;
          }
          if (matchingSnapshots.size > 1) {
            resolved.push({ name: person.name, sourceIds: person.sourceIds });
            failures.push({
              name: person.name,
              message: "Multiple Wikipedia links match this name; the identity is ambiguous.",
            });
            onProgress?.(`Could not match ${person.name} to one Wikipedia link.`);
            continue;
          }
          const [snapshot] = matchingSnapshots.values();
          if (!snapshot.wikidataId) {
            resolved.push({ name: person.name, sourceIds: person.sourceIds });
            failures.push({
              name: person.name,
              message: "The linked Wikipedia page has no Wikidata ID.",
            });
            onProgress?.(`No Wikidata ID was found for ${person.name}.`);
            continue;
          }

          const existing = dependencies.repository.findByWikidataId(snapshot.wikidataId);
          let pending = pendingPeople.get(snapshot.wikidataId);
          if (!existing && !pending) {
            const wikidataId = snapshot.wikidataId;
            pending = generateAndPersist({
              id: toCitySlug(person.name) || "person",
              name: person.name,
              wikidataId,
              snapshot,
              ai: personAi,
              dependencies,
              onProgress,
            }).finally(() => pendingPeople.delete(wikidataId));
            pendingPeople.set(wikidataId, pending);
          }
          const resolvedPerson = existing ?? (await pending!);
          resolved.push({
            name: person.name,
            personId: resolvedPerson.id,
            sourceIds: person.sourceIds,
          });
          onProgress?.(`Resolved ${person.name}.`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.startsWith('Wikipedia page not found for title "')) {
            onProgress?.(`Skipping ${person.name}: Wikipedia page not found.`);
            continue;
          }
          resolved.push({ name: person.name, sourceIds: person.sourceIds });
          failures.push({ name: person.name, message });
          onProgress?.(`Failed to resolve ${person.name}: ${message}`);

          if (/\b429\b|too many requests|Ollama timed out/i.test(message)) {
            for (const skipped of relatedPeople.slice(index + 1)) {
              resolved.push(skipped);
              if (!skipped.personId) {
                failures.push({
                  name: skipped.name,
                  message: /Ollama timed out/i.test(message)
                    ? "Skipped after Ollama timed out for another Person."
                    : message,
                });
              }
            }
            onProgress?.(
              /Ollama timed out/i.test(message)
                ? "Stopped after Ollama timed out. Try again later."
                : "Stopped after a rate limit. Try again later.",
            );
            break;
          }
        }
      }

      return { relatedPeople: resolved, failures };
    },
    getPublic: (personId: string) => {
      const person = dependencies.repository.get(personId);
      return person ? toPublicPerson(person) : undefined;
    },
  };
};

export const people = createPeople();

export type { Person, PublicPerson } from "./types";
