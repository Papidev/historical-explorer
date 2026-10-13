import type { AdminBatchAction } from "./types";

export const generateDraftStories: AdminBatchAction = async (formData) => {
  const response = await fetch("/api/admin/story-generations", { method: "POST", body: formData });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || `Story generation failed: HTTP ${response.status}.`);
  }
  return response.json();
};
