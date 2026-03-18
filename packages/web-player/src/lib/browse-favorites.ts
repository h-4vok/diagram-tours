import type { ResolvedDiagramTourCollectionEntry } from "@diagram-tour/core";

export const FAVORITES_STORAGE_KEY = "diagram-tour:favorites";

export interface FavoriteBrowseEntry {
  slug: string;
  title: string;
}

export function buildFavoriteBrowseEntries(input: {
  entries: ResolvedDiagramTourCollectionEntry[];
  favoriteSlugs: string[];
  query: string;
}): FavoriteBrowseEntry[] {
  return input.entries
    .filter((entry) => input.favoriteSlugs.includes(entry.slug))
    .filter((entry) => matchesFavoriteQuery(entry, input.query))
    .map((entry) => ({
      slug: entry.slug,
      title: entry.title
    }))
    .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));
}

export function readStoredFavoriteSlugs(storage: Storage): string[] {
  const storedValue = storage.getItem(FAVORITES_STORAGE_KEY);

  if (storedValue === null) {
    return [];
  }

  return readFavoriteSlugArray(storedValue);
}

export function toggleFavoriteSlug(current: string[], slug: string): string[] {
  return current.includes(slug)
    ? current.filter((item) => item !== slug)
    : sortFavoriteSlugs([...current, slug]);
}

export function writeStoredFavoriteSlugs(storage: Storage, slugs: string[]): void {
  storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(sortFavoriteSlugs(slugs)));
}

function matchesFavoriteQuery(
  entry: ResolvedDiagramTourCollectionEntry,
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return `${entry.title} ${entry.slug} ${entry.sourcePath}`.toLowerCase().includes(normalizedQuery);
}

function readFavoriteSlugArray(storedValue: string): string[] {
  try {
    const parsed = JSON.parse(storedValue);

    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function sortFavoriteSlugs(slugs: string[]): string[] {
  return [...new Set(slugs)].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}
