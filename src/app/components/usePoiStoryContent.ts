"use client";

import { useEffect, useState } from "react";
import type { PublicStoryContent } from "@/server/storyWorkflow";

type StoryContentState = {
  content: PublicStoryContent | null;
  isLoading: boolean;
  poiId: string | null;
};

export const usePoiStoryContent = ({ citySlug, poiId }: { citySlug: string; poiId?: string }) => {
  const [state, setState] = useState<StoryContentState>({
    content: null,
    isLoading: false,
    poiId: null,
  });

  useEffect(() => {
    if (!poiId) {
      return;
    }

    const abortController = new AbortController();

    const loadStoryContent = async () => {
      setState({ content: null, isLoading: true, poiId });

      try {
        const response = await fetch(
          `/api/pois/${encodeURIComponent(citySlug)}/${encodeURIComponent(poiId)}/dialog-content`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          setState({ content: null, isLoading: false, poiId });
          return;
        }

        const payload = (await response.json()) as {
          storyContent?: PublicStoryContent | null;
        };
        setState({ content: payload.storyContent ?? null, isLoading: false, poiId });
      } catch {
        if (!abortController.signal.aborted) {
          setState({ content: null, isLoading: false, poiId });
        }
      }
    };

    void loadStoryContent();

    return () => abortController.abort();
  }, [citySlug, poiId]);

  return {
    content: state.poiId === poiId ? state.content : null,
    isLoading: Boolean(poiId) && (state.poiId !== poiId || state.isLoading),
  };
};
