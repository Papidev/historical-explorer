"use client";

import { useEffect, useState } from "react";
import type { PublicPersonProfile } from "@/server/personProfile";

export const usePersonProfile = (personId?: string) => {
  const [state, setState] = useState<{
    personId: string | null;
    profile: PublicPersonProfile | null;
    isLoading: boolean;
  }>({ personId: null, profile: null, isLoading: false });

  useEffect(() => {
    if (!personId) return;
    const controller = new AbortController();
    setState({ personId, profile: null, isLoading: true });
    void fetch(`/api/people/${encodeURIComponent(personId)}/profile`, { signal: controller.signal })
      .then(async (response) =>
        response.ok ? ((await response.json()) as { profile?: PublicPersonProfile | null }) : {},
      )
      .then(({ profile }) => setState({ personId, profile: profile ?? null, isLoading: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ personId, profile: null, isLoading: false });
      });
    return () => controller.abort();
  }, [personId]);

  return {
    profile: state.personId === personId ? state.profile : null,
    isLoading: Boolean(personId) && (state.personId !== personId || state.isLoading),
  };
};
