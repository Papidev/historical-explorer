import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Person, PersonSource } from "./types";

const writeAtomically = (filePath: string, content: string) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, content, "utf-8");
  renameSync(temporaryPath, filePath);
};

export const createFilesystemPersonRepository = (rootPath = process.cwd()) => {
  const peoplePath = () => path.join(rootPath, "data", "people");
  const generatedPath = () => path.join(rootPath, "data", "generated", "people");
  const personPath = (personId: string) => path.join(peoplePath(), personId, "person.json");
  const sourcePath = (personId: string) => path.join(generatedPath(), `${personId}.txt`);

  const repository = {
    get: (personId: string) => {
      const filePath = personPath(personId);
      return existsSync(filePath)
        ? (JSON.parse(readFileSync(filePath, "utf-8")) as Person)
        : undefined;
    },
    list: () => {
      const directory = peoplePath();
      if (!existsSync(directory)) return [];
      return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => repository.get(entry.name))
        .filter((person): person is Person => Boolean(person));
    },
    findByWikidataId: (wikidataId: string) =>
      repository.list().find((person) => person.wikidataId === wikidataId),
    replace: (person: Person, source: PersonSource) => {
      writeAtomically(sourcePath(person.id), `${source.content.trim()}\n`);
      writeAtomically(personPath(person.id), `${JSON.stringify(person, null, 2)}\n`);
    },
    readSource: (person: Person): PersonSource => ({
      ...person.source,
      content: readFileSync(sourcePath(person.id), "utf-8").trim(),
    }),
  };

  return repository;
};

export const personRepository = createFilesystemPersonRepository();

export type PersonRepository = ReturnType<typeof createFilesystemPersonRepository>;
