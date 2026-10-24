import { describe, expect, it } from "vitest";
import { createCachedRead } from "./cache";

describe("visitor read cache", () => {
  it("reuses a saved version for at most 60 seconds, then observes removal", async () => {
    let time = 0;
    let publication: string | null = "saved";
    let reads = 0;
    const read = createCachedRead(
      async () => {
        reads++;
        return publication;
      },
      () => time,
    );
    expect(await read("poi")).toBe("saved");
    publication = null;
    time = 59_999;
    expect(await read("poi")).toBe("saved");
    expect(reads).toBe(1);
    time = 60_000;
    expect(await read("poi")).toBeNull();
    publication = "replacement";
    time = 120_000;
    expect(await read("poi")).toBe("replacement");
  });

  it("never serves expired content on failure, sanitizes errors and allows recovery", async () => {
    let time = 0;
    let available = true;
    const read = createCachedRead(
      async () => {
        if (!available) throw new Error("postgres://sensitive-connection");
        return "published";
      },
      () => time,
    );
    expect(await read("poi")).toBe("published");
    available = false;
    time = 60_000;
    await expect(read("poi")).rejects.toThrow("Published content is temporarily unavailable.");
    available = true;
    expect(await read("poi")).toBe("published");
  });

  it("bounds the number of cached identities", async () => {
    let reads = 0;
    const read = createCachedRead(async (id) => {
      reads++;
      return id;
    });
    for (let i = 0; i < 201; i++) await read(String(i));
    await read("200");
    expect(reads).toBe(201);
    await read("0");
    expect(reads).toBe(202);
  });
});
