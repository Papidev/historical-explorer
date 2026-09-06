import { describe, expect, it, vi } from "vitest";
import { createStoryCuration } from "./index";

describe("Story Curation", () => {
  it("selects a Draft Main Image through the Story Workflow repository", async () => {
    const selectDraftMainImage = vi.fn(async () => undefined);
    const storyCuration = createStoryCuration({
      get: async () => ({
        poiId: "forum-boarium",
        sources: [],
        mainImageCandidates: [
          {
            commonsFileName: "Forum Boarium.jpg",
            commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Forum_Boarium.jpg",
            thumbnailUrl: "https://example.com/thumbnail.jpg",
            originalImageUrl: "https://example.com/original.jpg",
            license: "CC BY-SA 4.0",
            attribution: "Example author",
            discoveredVia: "wikidata-p18",
            isProposed: true,
          },
        ],
        generation: {},
      }),
      selectDraftMainImage,
    });

    await storyCuration.selectDraftMainImage({
      poiId: "forum-boarium",
      commonsFileName: "Forum Boarium.jpg",
    });

    expect(selectDraftMainImage).toHaveBeenCalledWith(
      "forum-boarium",
      "Forum Boarium.jpg",
    );
  });
});
