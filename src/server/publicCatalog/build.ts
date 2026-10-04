import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createPoisForCity } from "@/utils";
import { personRepository } from "@/server/person/filesystemRepository";
import { personContentSchema, toPublicPerson } from "@/server/person/types";
import { readStoryContent } from "@/server/storyWorkflow/storyContentArtifacts";
import { readMainImageCandidateArtifact } from "@/server/storyWorkflow/mainImageCandidateArtifacts";
import { parseStoryContent, toPublicStoryContent } from "@/server/storyWorkflow/storyContent";
import type { DraftStorySnapshot } from "@/server/storyWorkflow/types";
import type { PublicCatalog } from "./types";

export const buildPublicCatalog = async () => {
  const snapshots = new Map<string, DraftStorySnapshot>();
  const pois = await createPoisForCity("rome", async (poiId) => {
    const storyContent = readStoryContent("rome", poiId)?.content;
    const images = readMainImageCandidateArtifact("rome", poiId);
    const draftMainImage = images?.candidates.find(
      ({ commonsFileName }) => commonsFileName === images.selectedCommonsFileName,
    );
    if (!storyContent || !draftMainImage?.license || !draftMainImage.attribution) {
      return undefined;
    }
    const snapshot: DraftStorySnapshot = {
      poiId,
      storyContent: parseStoryContent(storyContent, ["wikipedia"]),
      draftMainImage,
      mainImageCandidates: [],
      sources: [],
      generation: {},
    };
    snapshots.set(poiId, snapshot);
    return snapshot;
  });
  const people = personRepository.list();
  const catalog: PublicCatalog = { version: 1, city: "rome", pois: [], people: [] };

  for (const poi of pois) {
    const snapshot = snapshots.get(poi.id);
    const storyContent = snapshot?.storyContent;
    const image = snapshot?.draftMainImage;
    if (
      !storyContent ||
      !image?.license ||
      !image.attribution ||
      !storyContent.relatedPeople.every(
        ({ personId }) => personId && people.some(({ id }) => id === personId),
      )
    ) {
      continue;
    }
    catalog.pois.push({
      poi,
      storyContent: toPublicStoryContent(storyContent),
      mainImage: {
        thumbnailUrl: image.thumbnailUrl,
        originalImageUrl: image.originalImageUrl,
        commonsPageUrl: image.commonsPageUrl,
        license: image.license,
        attribution: image.attribution,
      },
    });
  }

  catalog.people = people
    .filter(({ id }) =>
      catalog.pois.some(({ storyContent }) =>
        storyContent.relatedPeople.some(({ personId }) => personId === id),
      ),
    )
    .map((person) =>
      toPublicPerson({ ...person, content: personContentSchema.parse(person.content) }),
    );
  return catalog;
};

export const writePublicCatalog = async () => {
  const catalog = await buildPublicCatalog();
  const filePath = path.join(process.cwd(), "data", "public", "catalog.json");
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(`${filePath}.tmp`, `${JSON.stringify(catalog, null, 2)}\n`, "utf-8");
  renameSync(`${filePath}.tmp`, filePath);
  return { pois: catalog.pois.length, people: catalog.people.length };
};
