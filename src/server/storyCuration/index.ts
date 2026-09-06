import { filesystemStoryWorkflowRepository } from "@/server/storyWorkflow/filesystemRepository";
import type { StoryWorkflowRepository } from "@/server/storyWorkflow/createStoryWorkflow";

export type StoryCuration = {
  selectDraftMainImage(input: {
    poiId: string;
    commonsFileName: string;
  }): Promise<void>;
};

export const createStoryCuration = (
  repository: Pick<StoryWorkflowRepository, "get" | "selectDraftMainImage">,
): StoryCuration => ({
  selectDraftMainImage: async ({ poiId, commonsFileName }) => {
    const draftStory = await repository.get(poiId);
    const candidate = draftStory?.mainImageCandidates.find(
      (item) => item.commonsFileName === commonsFileName,
    );
    if (!candidate) {
      throw new Error(`Main Image Candidate ${commonsFileName} not found.`);
    }
    if (!candidate.license || !candidate.attribution) {
      throw new Error(
        `Main Image Candidate ${commonsFileName} is missing license or attribution.`,
      );
    }
    await repository.selectDraftMainImage(poiId, candidate.commonsFileName);
  },
});

export const storyCuration = createStoryCuration(filesystemStoryWorkflowRepository);
