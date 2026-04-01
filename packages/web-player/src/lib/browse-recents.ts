export const RECENT_STORAGE_KEY = "diagram-tour:recent";
export const MAX_RECENT_SLUGS = 8;

export function readStoredRecentSlugs(storage: Storage): string[] {
  const storedValue = storage.getItem(RECENT_STORAGE_KEY);

  if (storedValue === null) {
    return [];
  }

  return readRecentSlugArray(storedValue);
}

export function rememberRecentSlug(current: string[], slug: string): string[] {
  return [slug, ...current.filter((item) => item !== slug)].slice(0, MAX_RECENT_SLUGS);
}

export function writeStoredRecentSlugs(storage: Storage, slugs: string[]): void {
  storage.setItem(RECENT_STORAGE_KEY, JSON.stringify(normalizeRecentSlugs(slugs)));
}

function readRecentSlugArray(storedValue: string): string[] {
  try {
    const parsed = JSON.parse(storedValue);

    return Array.isArray(parsed) ? normalizeRecentSlugs(parsed) : [];
  } catch {
    return [];
  }
}

function normalizeRecentSlugs(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string"))].slice(
    0,
    MAX_RECENT_SLUGS
  );
}
