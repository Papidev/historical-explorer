import { getLocalDataDirectory } from "@/server/localData";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { personSchema, type Person, type PersonSource } from "./types";

const writeAtomically = (filePath: string, content: string) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, content, "utf-8");
  renameSync(temporaryPath, filePath);
};

export const createFilesystemPersonRepository = (
  rootPath?: string,
  generatedDirectory = rootPath ? path.join(rootPath, "data") : getLocalDataDirectory(),
) => {
  rootPath ??= process.cwd();
  const peoplePath = () => path.join(rootPath, "data", "people");
  const generatedPath = () => path.join(generatedDirectory, "generated", "people");
  const personPath = (personId: string) => path.join(peoplePath(), personId, "person.json");
  const sourcePath = (personId: string) => path.join(generatedPath(), `${personId}.txt`);

  const repository = {
    get: (personId: string) => {
      const filePath = personPath(personId);
      if (!existsSync(filePath)) return undefined;
      try {
        const person = personSchema.parse(JSON.parse(readFileSync(filePath, "utf-8")));
        if (person.id !== personId) {
          throw new Error(`Person ID ${person.id} does not match directory ${personId}.`);
        }
        return person;
      } catch (error) {
        throw new Error(`Invalid Person file ${filePath}: ${String(error)}`, { cause: error });
      }
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
    retainSourceContext: (personId: string, wikidataIds: string[]) => {
      const person = repository.get(personId);
      if (!person) throw new Error("Person not found.");
      const context = [...new Set([...(person.sourceContextWikidataIds ?? []), ...wikidataIds])];
      if (context.length === (person.sourceContextWikidataIds?.length ?? 0)) return;
      writeAtomically(
        personPath(personId),
        `${JSON.stringify({ ...person, sourceContextWikidataIds: context }, null, 2)}\n`,
      );
    },
    replace: (person: Person, source: PersonSource, additionalSources: PersonSource[] = []) => {
      personSchema.parse(person);
      writeAtomically(sourcePath(person.id), `${source.content.trim()}\n`);
      if (additionalSources.length || person.additionalSources?.length) {
        writeAtomically(
          path.join(generatedPath(), `${person.id}.sources.json`),
          `${JSON.stringify(additionalSources, null, 2)}\n`,
        );
      }
      writeAtomically(personPath(person.id), `${JSON.stringify(person, null, 2)}\n`);
    },
    readSource: (person: Person): PersonSource => ({
      ...person.source,
      content: readFileSync(sourcePath(person.id), "utf-8").trim(),
    }),
    readSources: (person: Person): PersonSource[] => [
      repository.readSource(person),
      ...(person.additionalSources?.length
        ? person.additionalSources.map((metadata) => {
            const sources = JSON.parse(
              readFileSync(path.join(generatedPath(), `${person.id}.sources.json`), "utf-8"),
            ) as PersonSource[];
            const source = sources.find(({ id }) => id === metadata.id);
            if (!source) throw new Error(`Missing Person Source ${metadata.id}.`);
            return { ...metadata, content: source.content };
          })
        : []),
    ],
  };

  return repository;
};

export const personRepository = createFilesystemPersonRepository();

export type PersonRepository = ReturnType<typeof createFilesystemPersonRepository>;
