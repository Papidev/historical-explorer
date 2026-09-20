"use client";

import { useEffect, useState } from "react";
import type { PublicPerson } from "@/server/person";

export const usePerson = (personId?: string) => {
  const [state, setState] = useState<{
    personId: string | null;
    person: PublicPerson | null;
  }>({ personId: null, person: null });

  useEffect(() => {
    if (!personId) return;
    const controller = new AbortController();
    void fetch(`/api/people/${encodeURIComponent(personId)}`, { signal: controller.signal })
      .then(async (response) =>
        response.ok ? ((await response.json()) as { person?: PublicPerson | null }) : {},
      )
      .then(({ person }) => setState({ personId, person: person ?? null }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ personId, person: null });
      });
    return () => controller.abort();
  }, [personId]);

  return {
    person: state.personId === personId ? state.person : null,
    isLoading: Boolean(personId) && state.personId !== personId,
  };
};
