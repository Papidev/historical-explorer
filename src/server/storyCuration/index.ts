import { renameSync, writeFileSync } from "node:fs";
import {
  listMainImageCandidateArtifactFilePathsForPoi,
  readMainImageCandidateArtifact,
} from "@/server/storyWorkflow/mainImageCandidateArtifacts";

export type StoryCuration = {
  selectDraftMainImage(input: {
    poiId: string;
    commonsFileName: string;
  }): Promise<void>;
};

export const storyCuration: StoryCuration = {
  selectDraftMainImage: async ({ poiId, commonsFileName }) => {
    const artifact = readMainImageCandidateArtifact(poiId);
    const candidate = artifact?.candidates.find(
      (item) => item.commonsFileName === commonsFileName,
    );
    if (!artifact || !candidate) {
      throw new Error(`Main Image Candidate ${commonsFileName} not found.`);
    }
    if (!candidate.license || !candidate.attribution) {
      throw new Error(
        `Main Image Candidate ${commonsFileName} is missing license or attribution.`,
      );
    }
    const [filePath] = listMainImageCandidateArtifactFilePathsForPoi(poiId);
    if (!filePath) {
      throw new Error(`Main Image Candidates for ${poiId} not found.`);
    }
    const temporaryFilePath = `${filePath}.tmp`;
    writeFileSync(
      temporaryFilePath,
      `${JSON.stringify(
        { ...artifact, selectedCommonsFileName: candidate.commonsFileName },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    renameSync(temporaryFilePath, filePath);
  },
};
