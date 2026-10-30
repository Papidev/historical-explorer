import { afterEach, describe, expect, it, vi } from "vitest";
import { createContentHandler } from "./handler";
import { ContentWriteError } from "./postgresContent";
import { contentErrorResponse, CONTENT_BODY_LIMIT } from "./http";
import { ContentDatabaseConfigurationError, contentDatabaseConfig } from "./database";
import { exampleStoryWrite } from "./__fixtures__/writes";

const token = "a-test-credential-with-at-least-32-random-bytes";
const handle = createContentHandler(() => {
  throw new Error("Database must not be accessed.");
});
const request = (segments: string[], body?: unknown, options: RequestInit = {}) => {
  const input = new Request(`http://localhost/api/admin/content/v1/${segments.join("/")}`, {
    method: body === undefined ? "GET" : "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...options,
  });
  return { input, response: handle(input, { params: Promise.resolve({ segments }) }) };
};

afterEach(() => vi.unstubAllEnvs());

describe("content HTTP boundary before database access", () => {
  it("fails closed when the server token is missing or too short", async () => {
    for (const configured of [undefined, "short"]) {
      vi.stubEnv("CONTENT_API_TOKEN", configured);
      const { input, response } = request(["catalogs", "rome"], {});
      expect(await response).toHaveProperty("status", 503);
      expect(input.bodyUsed).toBe(false);
    }
  });

  it.each([undefined, "Basic bad", "Bearer wrong", `Bearer ${token} extra`])(
    "rejects credentials before consuming a body: %s",
    async (authorization) => {
      vi.stubEnv("CONTENT_API_TOKEN", token);
      const { input, response } = request(
        ["catalogs", "rome"],
        {},
        { headers: authorization ? { authorization } : {} },
      );
      const result = await response;
      expect(result.status).toBe(401);
      expect(result.headers.get("cache-control")).toBe("no-store");
      expect(await result.json()).toEqual({
        error: { code: "unauthorized", message: "A valid API credential is required." },
      });
      expect(input.bodyUsed).toBe(false);
    },
  );

  it.each([
    ["catalogs", "rome"],
    ["categories"],
    ["catalogs", "rome", "types"],
    ["pois", "728cbdf6-2449-4991-99b0-75204603eaa0", "types"],
    ["pois", "728cbdf6-2449-4991-99b0-75204603eaa0", "story"],
    ["pois", "728cbdf6-2449-4991-99b0-75204603eaa0", "baseline"],
    ["pois", "728cbdf6-2449-4991-99b0-75204603eaa0", "categories"],
    ["pois", "728cbdf6-2449-4991-99b0-75204603eaa0", "categories-baseline"],
    ["people", "a/b ?", "baseline"],
    ["people", "a/b ?"],
  ])("rejects unsupported methods with Allow on %j", async (...segments) => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    const response = await request(segments, undefined, { method: "POST" }).response;
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe(
      segments[2] === "types" && segments[0] === "catalogs"
        ? "GET"
        : segments[2] === "types" || ["catalogs", "categories"].includes(segments[0])
          ? "GET, PUT"
          : ["baseline", "categories-baseline"].includes(segments[2] ?? "")
            ? "GET"
            : "PUT",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("validates acquisition identities and states before database access", async () => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    const poiId = "728cbdf6-2449-4991-99b0-75204603eaa0";
    const input = {
      poiId,
      inputRevision: poiId,
      revision: poiId,
      expectedRevision: null,
      acquisition: {
        wikidataId: "Q1",
        types: [],
        skipped: false,
        acquiredAt: new Date().toISOString(),
      },
    };
    for (const body of [
      { ...input, poiId: "728cbdf6-2449-4991-99b0-75204603eaa1" },
      { ...input, acquisition: { ...input.acquisition, skipped: true } },
      { ...input, acquisition: { ...input.acquisition, wikidataId: null } },
      { ...input, acquisition: { ...input.acquisition, error: "failure" } },
    ]) {
      expect((await request(["pois", poiId, "types"], body).response).status).toBe(400);
    }
    expect((await request(["pois", "invalid", "types"]).response).status).toBe(400);
    expect((await request(["catalogs", "Rome", "types"]).response).status).toBe(400);
  });

  it("rejects malformed JSON, unsupported encoding, invalid routes and strict nested fields", async () => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    expect(
      (
        await request(
          ["catalogs", "rome"],
          {},
          { headers: { authorization: `Bearer ${token}`, "content-type": "text/plain" } },
        ).response
      ).status,
    ).toBe(415);
    expect((await request(["catalogs", "rome"], {}, { body: "{" }).response).status).toBe(400);
    expect((await request(["catalogs", "Rome"]).response).status).toBe(400);
    expect((await request(["pois", "bad-uuid", "baseline"]).response).status).toBe(400);
    expect((await request(["unknown", "thing"]).response).status).toBe(404);
    const body = exampleStoryWrite();
    expect(
      (
        await request(["pois", body.detail.id, "story"], { ...body, privatePath: "/secret" })
          .response
      ).status,
    ).toBe(400);
    expect(
      (
        await request(["pois", body.detail.id, "story"], {
          ...body,
          detail: { ...body.detail, coordinates: { ...body.detail.coordinates, private: true } },
        }).response
      ).status,
    ).toBe(400);
    expect(
      (
        await request(["catalogs", "rome"], {
          city: "rome",
          revision: body.inputRevision,
          expectedRevision: null,
          pois: [
            {
              id: body.detail.id,
              name: "Place",
              coordinates: body.detail.coordinates,
              osmIds: [],
              wikipediaPages: [
                {
                  language: "en",
                  pageId: 1,
                  title: "Place",
                  url: "https://en.wikipedia.org/wiki/Place",
                  private: true,
                },
              ],
            },
          ],
        }).response
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          ["catalogs", "rome"],
          {},
          {
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              "content-encoding": "gzip",
            },
          },
        ).response
      ).status,
    ).toBe(415);
  });

  it("rejects path/body mismatches for every write before accessing the repository", async () => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    const body = exampleStoryWrite();
    expect(
      (
        await request(["pois", body.detail.id, "categories"], {
          poiId: body.detail.publicationId,
          inputRevision: body.inputRevision,
          revision: body.detail.publicationId,
          expectedRevision: null,
          expectedStateDigest: "a".repeat(64),
          categoryIds: [],
          definitions: [],
        }).response
      ).status,
    ).toBe(400);
    expect(
      (
        await request(["catalogs", "milan"], {
          city: "rome",
          revision: body.inputRevision,
          expectedRevision: null,
          pois: [],
        }).response
      ).status,
    ).toBe(400);
    expect(
      (await request(["pois", body.detail.publicationId.toUpperCase(), "story"], body).response)
        .status,
    ).toBe(400);
    expect(
      (
        await request(["people", "other-person"], {
          ...body.people[0],
          expectedProfileVersion: body.people[0].profileVersion,
        }).response
      ).status,
    ).toBe(400);
  });

  it("validates strict category payloads and duplicates before database access", async () => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    const story = exampleStoryWrite();
    const body = {
      poiId: story.detail.id,
      inputRevision: story.inputRevision,
      revision: story.detail.publicationId,
      expectedRevision: null,
      expectedStateDigest: "a".repeat(64),
      categoryIds: ["architecture"],
      definitions: [{ id: "architecture", name: "Architecture" }],
    };
    for (const invalid of [
      { ...body, extra: true },
      { ...body, expectedStateDigest: "bad" },
      { ...body, expectedRevision: undefined },
      { ...body, categoryIds: ["architecture", "architecture"] },
      { ...body, definitions: [...body.definitions, ...body.definitions] },
      { ...body, definitions: [{ ...body.definitions[0], extra: true }] },
    ]) {
      const response = await request(["pois", body.poiId, "categories"], invalid).response;
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "invalid" } });
    }
    const unauthorized = request(["pois", body.poiId, "categories"], body, { headers: {} });
    expect((await unauthorized.response).status).toBe(401);
    expect(unauthorized.input.bodyUsed).toBe(false);
    expect((await request(["pois", "invalid", "categories-baseline"]).response).status).toBe(400);
  });

  it("enforces the body limit with and without Content-Length", async () => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    const declared = request(
      ["catalogs", "rome"],
      {},
      {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "content-length": String(CONTENT_BODY_LIMIT + 1),
        },
      },
    );
    expect((await declared.response).status).toBe(413);
    expect(declared.input.bodyUsed).toBe(false);
    const response = await request(
      ["catalogs", "rome"],
      {},
      { body: " ".repeat(CONTENT_BODY_LIMIT + 1) },
    ).response;
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("safe content error mapping", () => {
  it.each([
    [new ContentWriteError("invalid", "sensitive"), 400, "invalid"],
    [new ContentWriteError("conflict", "sensitive"), 409, "conflict"],
    [new ContentWriteError("obsolete", "sensitive"), 409, "obsolete"],
    [{ code: "23505", detail: "sensitive" }, 409, "conflict"],
    [{ code: "40P01", detail: "sensitive" }, 409, "conflict"],
    [{ code: "08P01", message: ":bad_startup_payload sensitive" }, 503, "unavailable"],
    [{ code: "53300" }, 503, "unavailable"],
    [new Error("Connection terminated unexpectedly sensitive"), 503, "unavailable"],
    [new Error("There was an error establishing an SSL connection"), 503, "unavailable"],
    [new ContentDatabaseConfigurationError("sensitive"), 503, "unavailable"],
    [new Error("sensitive"), 500, "internal"],
  ])("maps errors without exposing their details", async (error, status, code) => {
    const response = contentErrorResponse(error);
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text).error.code).toBe(code);
    expect(text).not.toContain("sensitive");
  });
});

describe("verified server database configuration", () => {
  const environment = {
    CONTENT_DATABASE_URL:
      "postgresql://writer.project:encoded%21pass@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    CONTENT_DATABASE_CA: "certificate\\nline",
    VERCEL: "1",
  };
  it("requires explicit credentials, verified TLS and the transaction pooler on Vercel", () => {
    expect(contentDatabaseConfig(environment)).toMatchObject({
      port: 6543,
      user: "writer.project",
      password: "encoded!pass",
      max: 1,
      ssl: { ca: "certificate\nline", rejectUnauthorized: true },
    });
    expect(() => contentDatabaseConfig({})).toThrow();
    expect(() =>
      contentDatabaseConfig({ ...environment, CONTENT_DATABASE_URL: "malformed" }),
    ).toThrow();
    expect(() =>
      contentDatabaseConfig({
        ...environment,
        CONTENT_DATABASE_URL: environment.CONTENT_DATABASE_URL.replace(":6543", ":5432"),
      }),
    ).toThrow();
    expect(() =>
      contentDatabaseConfig({
        ...environment,
        CONTENT_DATABASE_URL: `${environment.CONTENT_DATABASE_URL}?sslmode=no-verify`,
      }),
    ).toThrow();
    expect(() =>
      contentDatabaseConfig({ ...environment, CONTENT_DATABASE_CA: undefined }),
    ).toThrow();
  });
});

describe("category catalog HTTP validation", () => {
  it("authenticates reads and creation before database access", async () => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    for (const body of [undefined, { name: "Museum", expectedStateDigest: "a".repeat(64) }]) {
      expect((await request(["categories"], body, { headers: {} }).response).status).toBe(401);
    }
  });
  it.each([
    { name: "Museum" },
    { name: " ", expectedStateDigest: "a".repeat(64) },
    { name: "<bad>", expectedStateDigest: "a".repeat(64) },
    { name: "line\nbreak", expectedStateDigest: "a".repeat(64) },
    { name: "x".repeat(81), expectedStateDigest: "a".repeat(64) },
    { name: "Museum", expectedStateDigest: "a".repeat(64), parentId: "other" },
  ])("rejects malformed creation input before database access: %j", async (input) => {
    vi.stubEnv("CONTENT_API_TOKEN", token);
    expect((await request(["categories"], input).response).status).toBe(400);
  });
});
