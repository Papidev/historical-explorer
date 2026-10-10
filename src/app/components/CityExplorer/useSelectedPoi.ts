"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  window.addEventListener("poi-selection-change", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("poi-selection-change", onChange);
  };
};

export const useSelectedPoi = (initialSelectedPoiId: string | null) => ({
  selectedPoiId: useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get("poiId"),
    () => initialSelectedPoiId,
  ),
  selectPoi: (poiId: string | null) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("poiId") === poiId) return;
    if (poiId) url.searchParams.set("poiId", poiId);
    else url.searchParams.delete("poiId");
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("poi-selection-change"));
  },
});
