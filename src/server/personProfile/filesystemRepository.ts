import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PersonProfile, PersonProfileSource } from "./types";

const profilesPath = () => path.join(process.cwd(), "data", "people");
const generatedPath = () => path.join(process.cwd(), "data", "generated", "people");
const profilePath = (personId: string) => path.join(profilesPath(), personId, "profile.json");
const sourcePath = (personId: string) => path.join(generatedPath(), `${personId}.txt`);

const writeAtomically = (filePath: string, content: string) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, content, "utf-8");
  renameSync(temporaryPath, filePath);
};

export const personProfileRepository = {
  get: (personId: string) => {
    const filePath = profilePath(personId);
    return existsSync(filePath)
      ? (JSON.parse(readFileSync(filePath, "utf-8")) as PersonProfile)
      : undefined;
  },
  list: () => {
    const directory = profilesPath();
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => personProfileRepository.get(entry.name))
      .filter((profile): profile is PersonProfile => Boolean(profile));
  },
  findByWikidataId: (wikidataId: string) =>
    personProfileRepository.list().find((profile) => profile.wikidataId === wikidataId),
  replace: (profile: PersonProfile, source: PersonProfileSource) => {
    writeAtomically(sourcePath(profile.id), `${source.content.trim()}\n`);
    writeAtomically(profilePath(profile.id), `${JSON.stringify(profile, null, 2)}\n`);
  },
  readSource: (profile: PersonProfile): PersonProfileSource => ({
    ...profile.source,
    content: readFileSync(sourcePath(profile.id), "utf-8").trim(),
  }),
};
