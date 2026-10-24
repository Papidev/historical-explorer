import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const catalog = JSON.parse(readFileSync(new URL("../data/public/catalog.json", import.meta.url)));
const databaseConfigured = Boolean(
  process.env.CONTENT_DATABASE_URL && process.env.CONTENT_DATABASE_CA,
);

const versionResponse = await fetch(`${baseUrl}/api/version`);
assert.equal(versionResponse.status, 200);
const release = await versionResponse.json();
assert.equal(
  release.version,
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version,
);
assert.ok(release.commit === null || /^[a-f0-9]{40}$/.test(release.commit));

for (const route of ["/", "/rome"]) {
  const response = await fetch(`${baseUrl}${route}`);
  assert.equal(response.status, 200, `${route} must be available`);
  if (route === "/rome" && !databaseConfigured)
    assert.match(await response.text(), /Places are temporarily unavailable/);
}
for (const route of ["/admin", "/api/admin/ai-progress/00000000-0000-4000-8000-000000000000"]) {
  assert.equal((await fetch(`${baseUrl}${route}`)).status, 404, `${route} must be disabled`);
}

assert.ok(catalog.pois.length > 0, "The local public catalog must contain published POIs");
const { poi, storyContent } = catalog.pois[0];
const storyResponse = await fetch(
  `${baseUrl}/api/pois/${catalog.city}/${encodeURIComponent(poi.id)}/dialog-content`,
);
assert.equal(storyResponse.headers.get("cache-control"), "no-store");
assert.equal(storyResponse.status, databaseConfigured ? 200 : 503);
const story = await storyResponse.json();
if (!databaseConfigured) {
  // CI deliberately has no database credentials. Verify failure behavior rather than
  // selecting a local replacement without establishing online ownership/removal.
  assert.deepEqual(story, { storyContent: null });
} else if (story.detail) {
  assert.equal(story.detail.city, catalog.city);
  assert.equal(story.storyContent.textFormat, "markdown");
  assert.equal(typeof story.storyContent.introduction, "string");
} else {
  assert.deepEqual(story, { storyContent, detail: null });
}
if (!databaseConfigured || story.storyContent.relatedPeople.length > 0) {
  const personId = databaseConfigured
    ? story.storyContent.relatedPeople[0].personId
    : catalog.people[0]?.id;
  assert.ok(personId, "The public fixture must provide a Person");
  const personResponse = await fetch(
    `${baseUrl}/api/people/${encodeURIComponent(personId)}?${new URLSearchParams({ city: catalog.city, poiId: poi.id })}`,
  );
  assert.equal(personResponse.status, databaseConfigured ? 200 : 503);
  assert.equal(personResponse.headers.get("cache-control"), "no-store");
  const person = await personResponse.json();
  if (!databaseConfigured) assert.deepEqual(person, { person: null });
  else if (story.detail) {
    assert.equal(person.person.id, personId);
    assert.equal(person.person.textFormat, "markdown");
    assert.equal(person.detail.id, personId);
  } else {
    assert.deepEqual(person, {
      person: catalog.people.find(({ id }) => id === personId),
      detail: null,
    });
  }
}

const unknownStory = await fetch(`${baseUrl}/api/pois/${catalog.city}/unknown/dialog-content`);
assert.deepEqual(await unknownStory.json(), { storyContent: null });
const pathPerson = await fetch(`${baseUrl}/api/people/%2e%2e%2fpeople%2fpope-nicholas-v`);
assert.equal(pathPerson.status, databaseConfigured ? 404 : 503);
assert.equal((await pathPerson.json()).person, null);

console.log("Production map, public content, and admin isolation checks passed.");
