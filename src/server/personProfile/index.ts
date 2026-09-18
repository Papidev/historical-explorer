import type { AiSelection, RelatedPerson, Source } from "@/server/storyWorkflow";
import { fetchWikiSnapshot } from "@/server/wikiPipeline/fetchWiki";
import { buildWikipediaPageUrl } from "@/server/wikiPipeline/io";
import { toCitySlug } from "@/server/wikiPipeline/normalize";
import { wikiTextToPlainText } from "@/server/wikiPipeline/wikiText";
import { fetchMainImageCandidates } from "@/server/storyWorkflow/mainImageCandidates";
import { personProfileRepository } from "./filesystemRepository";
import { generatePersonProfile } from "./generatePersonProfile";
import { toPublicPersonProfile, type PersonProfile, type PersonProfileSource } from "./types";

const normalizeName = (value: string) =>
  value
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLocaleLowerCase("en");

const getProvider = (ai: AiSelection) =>
  ai.mode === "local"
    ? process.env.LOCAL_AI_PROVIDER === "gemini"
      ? "gemini"
      : "ollama"
    : process.env.CLOUD_AI_PROVIDER === "ollama"
      ? "ollama"
      : "gemini";

const allocatePersonId = (name: string) => {
  const baseId = toCitySlug(name) || "person";
  const ids = new Set(personProfileRepository.list().map(({ id }) => id));
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
  wikipediaTitle,
  ai,
}: {
  id: string;
  name: string;
  wikidataId: string;
  wikipediaTitle: string;
  ai: AiSelection;
}) => {
  const snapshot = await fetchWikiSnapshot(wikipediaTitle);
  const source: PersonProfileSource = {
    id: "wikipedia",
    kind: "wikipedia",
    title: snapshot.title,
    url: buildWikipediaPageUrl(snapshot.title),
    content: wikiTextToPlainText(snapshot.fullText),
  };
  const provider = getProvider(ai);
  const content = await generatePersonProfile({ name, wikidataId }, [source], {
    provider,
    model: ai.model,
  });
  const image = (
    await fetchMainImageCandidates({
      id,
      name,
      city: "",
      coordinates: { lat: 0, lng: 0 },
      sourceHints: { wikipedia: `en:${snapshot.title}`, wikidata: wikidataId },
    })
  ).find(({ license, attribution }) => license && attribution);
  const profile: PersonProfile = {
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
      aiProvider: provider,
      aiModel: ai.model,
      completedAt: new Date().toISOString(),
    },
  };
  personProfileRepository.replace(profile, source);
  return profile;
};

export const personProfiles = {
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
    const resolved: RelatedPerson[] = [];
    for (const person of relatedPeople) {
      const link = links.find(
        ({ label, title }) =>
          normalizeName(label) === normalizeName(person.name) ||
          normalizeName(title) === normalizeName(person.name),
      );
      if (!link) {
        resolved.push({ name: person.name, sourceIds: person.sourceIds });
        continue;
      }
      const snapshot = await fetchWikiSnapshot(link.title);
      if (!snapshot.wikidataId) {
        resolved.push({ name: person.name, sourceIds: person.sourceIds });
        continue;
      }
      const existing = personProfileRepository.findByWikidataId(snapshot.wikidataId);
      const profile =
        existing ??
        (await generateAndPersist({
          id: allocatePersonId(person.name),
          name: person.name,
          wikidataId: snapshot.wikidataId,
          wikipediaTitle: snapshot.title,
          ai,
        }));
      resolved.push({ name: profile.name, personId: profile.id, sourceIds: person.sourceIds });
    }
    return resolved;
  },
  regenerate: async ({ personId, ai }: { personId: string; ai: AiSelection }) => {
    const profile = personProfileRepository.get(personId);
    if (!profile) throw new Error(`Person ${personId} not found.`);
    return generateAndPersist({
      id: profile.id,
      name: profile.name,
      wikidataId: profile.wikidataId,
      wikipediaTitle: profile.wikipediaTitle,
      ai,
    });
  },
  get: (personId: string) => personProfileRepository.get(personId),
  list: () => personProfileRepository.list(),
  getPublic: (personId: string) => {
    const profile = personProfileRepository.get(personId);
    return profile ? toPublicPersonProfile(profile) : undefined;
  },
};

export type { PersonProfile, PublicPersonProfile } from "./types";
