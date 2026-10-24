import { describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/contract-v1.json";
import { catalogWriteSchema, personUpdateSchema, storyWriteSchema } from "./postgresContent";
import { CONTENT_BODY_LIMIT } from "./http";

describe("portable v1 contract fixtures", () => {
  it.each(fixtures)("validates $kind (valid=$valid)", ({ kind, valid, body }) => {
    expect(
      { catalog: catalogWriteSchema, story: storyWriteSchema, person: personUpdateSchema }[
        kind as "catalog" | "story" | "person"
      ].safeParse(body).success,
    ).toBe(valid);
  });

  it("fits a complete representative wire Story below the atomic request limit", () => {
    const fixture = fixtures.find(({ kind, valid }) => kind === "story" && valid)!;
    expect(storyWriteSchema.safeParse(fixture.body).success).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(fixture.body))).toBeLessThan(CONTENT_BODY_LIMIT);
  });
});
