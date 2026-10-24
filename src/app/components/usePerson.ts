"use client";

import { useEffect, useState } from "react";
import type { PublicPerson } from "@/server/person";

export const usePerson = (personId?: string, city?: string, poiId?: string) => {
  const [state, setState] = useState<{
    personId: string | null;
    person: PublicPerson | null;
    poiId?: string;
  }>({ personId: null, person: null });

  useEffect(() => {
    if (!personId) return;
    const controller = new AbortController();
    void fetch(
      `/api/people/${encodeURIComponent(personId)}${city && poiId ? `?${new URLSearchParams({ city, poiId })}` : ""}`,
      { signal: controller.signal },
    )
      .then(async (response) =>
        response.ok ? ((await response.json()) as { person?: PublicPerson | null }) : {},
      )
      .then(({ person }) => setState({ personId, poiId, person: person ?? null }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ personId, poiId, person: null });
      });
    return () => controller.abort();
  }, [personId, city, poiId]);

  return {
    person: state.personId === personId && state.poiId === poiId ? state.person : null,
    isLoading: Boolean(personId) && (state.personId !== personId || state.poiId !== poiId),
  };
};
