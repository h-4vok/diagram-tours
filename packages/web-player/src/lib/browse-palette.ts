import type { DiagramType, ResolvedDiagramTourCollectionEntry } from "@diagram-tour/core";

export interface BrowsePaletteItem {
  diagramType: DiagramType;
  slug: string;
  sourcePath: string;
  stepCount: number;
  title: string;
}

export interface BrowsePaletteSection {
  id: "favorites" | "recent" | "all";
  items: BrowsePaletteItem[];
  title: string;
}

export function buildBrowsePaletteSections(input: {
  entries: ResolvedDiagramTourCollectionEntry[];
  favoriteSlugs: string[];
  query: string;
  recentSlugs: string[];
}): BrowsePaletteSection[] {
  const entryLookup = new Map(input.entries.map((entry) => [entry.slug, entry]));
  const matchingEntries = input.entries.filter((entry) => matchesBrowsePaletteQuery(entry, input.query));
  const usedSlugs = new Set<string>();
  const favorites = readFavoritePaletteItems(input.favoriteSlugs, entryLookup, input.query);
  markUsedSlugs(usedSlugs, favorites);
  const recent = readRecentPaletteItems({
    entryLookup,
    query: input.query,
    recentSlugs: input.recentSlugs,
    usedSlugs
  });
  markUsedSlugs(usedSlugs, recent);
  const all = readAllPaletteItems(matchingEntries, usedSlugs);

  return [
    createSection("favorites", "Favorites", favorites),
    createSection("recent", "Recent", recent),
    createSection("all", "All Diagrams", all)
  ].filter((section) => section.items.length > 0);
}

export function flattenBrowsePaletteSections(sections: BrowsePaletteSection[]): BrowsePaletteItem[] {
  return sections.flatMap((section) => section.items);
}

export function readInitialBrowsePaletteSlug(input: {
  activeSlug: string | null;
  currentSlug: string | null;
  items: BrowsePaletteItem[];
}): string | null {
  return readPaletteSlugCandidate(input.items, [input.activeSlug, input.currentSlug]);
}

export function moveBrowsePaletteSlug(input: {
  activeSlug: string | null;
  direction: -1 | 1;
  items: BrowsePaletteItem[];
}): string | null {
  const nextIndex = readNextPaletteIndex(input);

  return input.items[nextIndex]?.slug ?? null;
}

function readFavoritePaletteItems(
  favoriteSlugs: string[],
  entryLookup: Map<string, ResolvedDiagramTourCollectionEntry>,
  query: string
): BrowsePaletteItem[] {
  return sortPaletteItems(readPaletteItemsBySlug(favoriteSlugs, entryLookup, query));
}

function readRecentPaletteItems(input: {
  entryLookup: Map<string, ResolvedDiagramTourCollectionEntry>;
  query: string;
  recentSlugs: string[];
  usedSlugs: Set<string>;
}): BrowsePaletteItem[] {
  return readPaletteItemsBySlug(input.recentSlugs, input.entryLookup, input.query).filter(
    (entry) => !input.usedSlugs.has(entry.slug)
  );
}

function readAllPaletteItems(
  entries: ResolvedDiagramTourCollectionEntry[],
  usedSlugs: Set<string>
): BrowsePaletteItem[] {
  return sortPaletteItems(entries.map(toPaletteItem).filter((entry) => !usedSlugs.has(entry.slug)));
}

function readPaletteItemsBySlug(
  slugs: string[],
  entryLookup: Map<string, ResolvedDiagramTourCollectionEntry>,
  query: string
): BrowsePaletteItem[] {
  return slugs
    .map((slug) => entryLookup.get(slug))
    .filter(isDefined)
    .filter((entry) => matchesBrowsePaletteQuery(entry, query))
    .map(toPaletteItem);
}

function createSection(
  id: BrowsePaletteSection["id"],
  title: string,
  items: BrowsePaletteItem[]
): BrowsePaletteSection {
  return {
    id,
    items,
    title
  };
}

function markUsedSlugs(usedSlugs: Set<string>, items: BrowsePaletteItem[]): void {
  for (const item of items) {
    usedSlugs.add(item.slug);
  }
}

function sortPaletteItems(items: BrowsePaletteItem[]): BrowsePaletteItem[] {
  return [...items].sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));
}

function toPaletteItem(entry: ResolvedDiagramTourCollectionEntry): BrowsePaletteItem {
  return {
    diagramType: entry.tour.diagram.type,
    slug: entry.slug,
    sourcePath: entry.sourcePath,
    stepCount: entry.tour.steps.length,
    title: entry.title
  };
}

function matchesBrowsePaletteQuery(
  entry: ResolvedDiagramTourCollectionEntry,
  query: string
): boolean {
  const normalizedQuery = normalizeSearchValue(query);

  if (normalizedQuery.length === 0) {
    return true;
  }

  const haystack = normalizeSearchValue(`${entry.title} ${entry.slug} ${entry.sourcePath}`);

  return haystack.includes(normalizedQuery) || matchesFuzzyPaletteQuery(haystack, normalizedQuery);
}

function matchesFuzzyPaletteQuery(haystack: string, query: string): boolean {
  if (!shouldUseFuzzyBrowseQuery(query)) {
    return false;
  }

  return haystack
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0)
    .some((token) => hasFuzzyOrderedMatch(token, query));
}

function shouldUseFuzzyBrowseQuery(query: string): boolean {
  return query.length <= 4 && !query.includes(" ");
}

function hasFuzzyOrderedMatch(haystack: string, query: string): boolean {
  let haystackIndex = 0;

  return Array.from(query).every((character) => {
    const nextIndex = haystack.indexOf(character, haystackIndex);

    if (nextIndex === -1) {
      return false;
    }

    haystackIndex = nextIndex + 1;

    return true;
  });
}

function clampPaletteIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

function readPaletteSlugCandidate(items: BrowsePaletteItem[], candidates: Array<string | null>): string | null {
  if (items.length === 0) {
    return null;
  }

  return readMatchingPaletteSlug(items, candidates) ?? readFirstPaletteSlug(items);
}

function hasPaletteSlug(items: BrowsePaletteItem[], slug: string | null): slug is string {
  return slug !== null && items.some((item) => item.slug === slug);
}

function readActivePaletteIndex(items: BrowsePaletteItem[], activeSlug: string | null): number {
  const activeIndex = items.findIndex((item) => item.slug === activeSlug);

  return activeIndex === -1 ? 0 : activeIndex;
}

function readMatchingPaletteSlug(
  items: BrowsePaletteItem[],
  candidates: Array<string | null>
): string | null {
  return candidates.find((candidate) => hasPaletteSlug(items, candidate)) ?? null;
}

function readFirstPaletteSlug(items: BrowsePaletteItem[]): string {
  return items[0].slug;
}

function readNextPaletteIndex(input: {
  activeSlug: string | null;
  direction: -1 | 1;
  items: BrowsePaletteItem[];
}): number {
  if (input.items.length === 0) {
    return -1;
  }

  return clampPaletteIndex(
    readActivePaletteIndex(input.items, input.activeSlug) + input.direction,
    input.items.length
  );
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
