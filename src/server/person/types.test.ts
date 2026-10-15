import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { personSchema, toPublicPerson } from "./types";

it("exposes cited Wikipedia editions without leaking internal Person source data", () => {
  const person = personSchema.parse(
    JSON.parse(readFileSync("data/people/gian-lorenzo-bernini/person.json", "utf-8")),
  );
  person.additionalSources = [
    {
      id: "wikipedia-it",
      kind: "wikipedia",
      title: "Gian Lorenzo Bernini",
      url: "https://it.wikipedia.org/wiki/Gian_Lorenzo_Bernini",
    },
    {
      id: "wikipedia-fr",
      kind: "wikipedia",
      title: "Le Bernin",
      url: "https://fr.wikipedia.org/wiki/Le_Bernin",
    },
  ];
  person.content.description[1].sourceIds = ["wikipedia-it"];
  const published = toPublicPerson(person);
  expect(published.wikipediaSources).toEqual([
    { title: person.source.title, url: person.source.url },
    {
      title: "Gian Lorenzo Bernini",
      url: "https://it.wikipedia.org/wiki/Gian_Lorenzo_Bernini",
    },
  ]);
  expect(JSON.stringify(published)).not.toMatch(/"(?:sourceIds|generation|wikidataId)":/);
});
