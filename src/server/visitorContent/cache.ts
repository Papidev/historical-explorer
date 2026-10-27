// A hard TTL: expired entries are never served during a database outage.
// Each server instance keeps a bounded cache; no credentials enter its keys or values.
export const createCachedRead = <T>(
  read: (id: string) => Promise<T>,
  now: () => number = Date.now,
) => {
  const entries = new Map<string, { expiresAt: number; value: Promise<T> }>();
  return async (id: string): Promise<T> => {
    const cached = entries.get(id);
    if (cached && cached.expiresAt > now()) return cached.value;
    const entry = { expiresAt: now() + 60_000, value: read(id) };
    entries.delete(id);
    entries.set(id, entry);
    if (entries.size > 200) entries.delete(entries.keys().next().value!);
    try {
      return await entry.value;
    } catch {
      if (entries.get(id) === entry) entries.delete(id);
      // Driver errors can contain connection details. Keep them out of responses and logs.
      throw new Error("Published content is temporarily unavailable.");
    }
  };
};
