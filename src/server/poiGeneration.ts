// These guards coordinate the single local server process, not multiple workers.
const activePois = new Set<string>();

export const withPoiGeneration = async <T>(poiId: string, generate: () => Promise<T>) => {
  if (activePois.has(poiId)) throw new Error("This POI is already being generated.");
  if (activePois.size >= 3)
    throw new Error("Three POIs are already being processed. Try again later.");
  activePois.add(poiId);
  try {
    return await generate();
  } finally {
    activePois.delete(poiId);
  }
};
