import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const catalog = JSON.parse(readFileSync(new URL("../data/public/catalog.json", import.meta.url)));

for (const route of ["/", "/rome"]) {
  assert.equal((await fetch(`${baseUrl}${route}`)).status, 200, `${route} must be available`);
}
for (const route of ["/admin", "/api/admin/ai-progress/00000000-0000-4000-8000-000000000000"]) {
  assert.equal((await fetch(`${baseUrl}${route}`)).status, 404, `${route} must be disabled`);
}

assert.ok(catalog.pois.length > 0, "The deployed map must contain published POIs");
const { poi, storyContent } = catalog.pois[0];
const storyResponse = await fetch(
  `${baseUrl}/api/pois/${catalog.city}/${encodeURIComponent(poi.id)}/dialog-content`,
);
assert.equal(storyResponse.status, 200);
assert.deepEqual(await storyResponse.json(), { storyContent });
if (catalog.people.length > 0) {
  const personResponse = await fetch(
    `${baseUrl}/api/people/${encodeURIComponent(catalog.people[0].id)}`,
  );
  assert.equal(personResponse.status, 200);
  assert.deepEqual(await personResponse.json(), { person: catalog.people[0] });
}

const unknownStory = await fetch(`${baseUrl}/api/pois/${catalog.city}/unknown/dialog-content`);
assert.deepEqual(await unknownStory.json(), { storyContent: null });
const pathPerson = await fetch(`${baseUrl}/api/people/%2e%2e%2fpeople%2fpope-nicholas-v`);
assert.deepEqual(await pathPerson.json(), { person: null });

console.log("Production map, public content, and admin isolation checks passed.");
