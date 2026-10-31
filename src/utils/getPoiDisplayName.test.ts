import { describe, expect, it } from "vitest";
import { getPoiDisplayName } from "./getPoiDisplayName";

describe("local POI display names", () => {
  const sources = [
    { title: "Abate Luigi", url: "https://it.wikipedia.org/wiki/Abate_Luigi" },
    { title: "Abbot Luigi", url: "https://en.wikipedia.org/wiki/Abbot_Luigi" },
  ];
  it("prefers English independently of source order", () => {
    expect(getPoiDisplayName('"Statua parlante" Abate Luigi', sources)).toBe("Abbot Luigi");
  });
  it("falls back to Italian and then the original catalog name", () => {
    expect(getPoiDisplayName("Catalog name", sources.slice(0, 1))).toBe("Abate Luigi");
    expect(
      getPoiDisplayName("Catalog name", [
        { title: "French", url: "https://fr.wikipedia.org/wiki/Example" },
      ]),
    ).toBe("Catalog name");
    expect(getPoiDisplayName("Catalog name")).toBe("Catalog name");
  });
});
