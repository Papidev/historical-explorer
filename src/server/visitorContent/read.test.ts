import { describe, expect, it } from "vitest";
import { createPublishedRead } from "./read";

describe("published content reads", () => {
  it("recovers from intermittent pooler handshake failures and caches the result", async () => {
    let attempts = 0;
    const read = createPublishedRead(async (id) => {
      if (++attempts < 3) throw new Error("There was an error establishing an SSL connection");
      return { id, introduction: "Published story" };
    });

    const results = await Promise.all([read("rome"), read("rome")]);
    expect(results).toEqual([
      { id: "rome", introduction: "Published story" },
      { id: "rome", introduction: "Published story" },
    ]);
    expect(await read("rome")).toEqual(results[0]);
    expect(attempts).toBe(3);
  });

  it("stops after five attempts, sanitizes the failure and allows later recovery", async () => {
    let attempts = 0;
    let available = false;
    const read = createPublishedRead(async () => {
      attempts++;
      if (!available) throw new Error("There was an error establishing an SSL connection");
      return "published";
    });

    const results = await Promise.allSettled([read("rome"), read("rome")]);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected")
        expect(result.reason.message).toBe("Published content is temporarily unavailable.");
    }
    expect(attempts).toBe(5);
    available = true;
    expect(await read("rome")).toBe("published");
    expect(attempts).toBe(6);
  });

  it.each([
    "password authentication failed",
    "self-signed certificate in certificate chain",
    "SQL query failed: sensitive details",
    "Content database configuration is missing.",
  ])("does not retry other errors: %s", async (message) => {
    let attempts = 0;
    const read = createPublishedRead(async () => {
      attempts++;
      throw new Error(message);
    });

    await expect(read("rome")).rejects.toThrow("Published content is temporarily unavailable.");
    expect(attempts).toBe(1);
  });
});
