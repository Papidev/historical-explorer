import type {
  AiSelection,
  RelatedPeopleResolutionResult,
  RelatedPerson,
  Source,
} from "@/server/storyWorkflow";
import { fetchMainImageCandidates } from "@/server/storyWorkflow/mainImageCandidates";
import { fetchWikiSnapshot } from "@/server/wikiPipeline/fetchWiki";
import { buildWikipediaPageUrl } from "@/server/wikiPipeline/io";
import { toCitySlug } from "@/server/wikiPipeline/normalize";
import type { MainImageCandidate, WikiSnapshot } from "@/server/wikiPipeline/types";
import { wikiTextToPlainText } from "@/server/wikiPipeline/wikiText";
import { personRepository, type PersonRepository } from "./filesystemRepository";
import { generatePerson } from "./generatePerson";
import { toPublicPerson, type Person, type PersonContent, type PersonSource } from "./types";

const normalizeName = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLocaleLowerCase("en");

const normalizeTitle = (value: string) => value.replace(/_/g, " ").trim().toLocaleLowerCase("en");

const getProvider = (ai: AiSelection): "ollama" | "gemini" =>
  ai.mode === "local"
    ? process.env.LOCAL_AI_PROVIDER === "gemini"
      ? "gemini"
      : "ollama"
    : process.env.CLOUD_AI_PROVIDER === "ollama"
      ? "ollama"
      : "gemini";

const getPersonAiSelection = (ai: AiSelection) => {
  const provider = getProvider(ai);
  return ai.mode === "cloud" && provider === "ollama"
    ? {
        mode: "local" as const,
        provider: "ollama" as const,
        model: process.env.LOCAL_AI_MODEL?.trim() || "qwen3:8b",
      }
    : { ...ai, provider };
};

type PersonDependencies = {
  repository: PersonRepository;
  fetchSnapshot: (title: string) => Promise<WikiSnapshot>;
  generateContent: (
    person: { name: string; wikidataId: string },
    sources: PersonSource[],
    config: { provider: "ollama" | "gemini"; model: string },
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
}: {
  id: string;
  name: string;
  wikidataId: string;
  snapshot: WikiSnapshot;
  ai: AiSelection & { provider: "ollama" | "gemini" };
  dependencies: PersonDependencies;
}) => {
  const source: PersonSource = {
    id: "wikipedia",
    kind: "wikipedia",
    title: snapshot.title,
    url: buildWikipediaPageUrl(snapshot.title),
    content: wikiTextToPlainText(snapshot.fullText),
  };
  const content = await dependencies.generateContent({ name, wikidataId }, [source], {
    provider: ai.provider,
    model: ai.model,
  });
  const image = (
    await dependencies.fetchImageCandidates({
      id,
      name,
      city: "",
      coordinates: { lat: 0, lng: 0 },
      sourceHints: { wikipedia: `en:${snapshot.title}`, wikidata: wikidataId },
    })
  ).find(({ license, attribution }) => license && attribution);
  const person: Person = {
    id,
    name,
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

  return {
    resolveAndGenerateMissing: async ({
      relatedPeople,
      storySources,
      ai,
    }: {
      relatedPeople: RelatedPerson[];
      storySources: Source[];
      ai: AiSelection;
    }) => {
      const links = storySources.flatMap((source) => source.links ?? []);
      const personAi = getPersonAiSelection(ai);
      const resolved: RelatedPerson[] = [];
      const failures: RelatedPeopleResolutionResult["failures"] = [];

      for (let index = 0; index < relatedPeople.length; index += 1) {
        const person = relatedPeople[index];
        if (person.personId) {
          resolved.push(person);
          continue;
        }

        const matchingLinks = new Map(
          links
            .filter(
              ({ label, title }) =>
                normalizeName(label) === normalizeName(person.name) ||
                normalizeName(title) === normalizeName(person.name),
            )
            .map((link) => [normalizeTitle(link.title), link]),
        );
        if (matchingLinks.size !== 1) {
          resolved.push({ name: person.name, sourceIds: person.sourceIds });
          failures.push({
            name: person.name,
            message:
              matchingLinks.size === 0
                ? "No matching Wikipedia link was found in the Story source."
                : "Multiple Wikipedia links match this name; the identity is ambiguous.",
          });
          continue;
        }

        try {
          const [link] = matchingLinks.values();
          const snapshot = await dependencies.fetchSnapshot(link.title);
          if (!snapshot.wikidataId) {
            resolved.push({ name: person.name, sourceIds: person.sourceIds });
            failures.push({
              name: person.name,
              message: "The linked Wikipedia page has no Wikidata ID.",
            });
            continue;
          }

          const existing = dependencies.repository.findByWikidataId(snapshot.wikidataId);
          const resolvedPerson =
            existing ??
            (await generateAndPersist({
              id: allocatePersonId(person.name, dependencies.repository),
              name: person.name,
              wikidataId: snapshot.wikidataId,
              snapshot,
              ai: personAi,
              dependencies,
            }));
          resolved.push({
            name: person.name,
            personId: resolvedPerson.id,
            sourceIds: person.sourceIds,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          resolved.push({ name: person.name, sourceIds: person.sourceIds });
          failures.push({ name: person.name, message });

          if (/\b429\b|too many requests/i.test(message)) {
            for (const skipped of relatedPeople.slice(index + 1)) {
              resolved.push(skipped);
              if (!skipped.personId) {
                failures.push({ name: skipped.name, message });
              }
            }
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
