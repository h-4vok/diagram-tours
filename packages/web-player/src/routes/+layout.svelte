<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import "../styles/index.css";
  import { onMount, tick } from "svelte";
  import { Toaster } from "svelte-sonner";
  import {
    DEFAULT_THEME,
    getDocumentTheme,
    getStoredTheme,
    getThemeToggleLabel,
    setDocumentTheme,
    type ThemeName,
    setStoredTheme,
    toggleTheme
  } from "$lib/theme";
  import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";
  import {
    buildFavoriteBrowseEntries,
    readStoredFavoriteSlugs,
    toggleFavoriteSlug,
    writeStoredFavoriteSlugs
  } from "$lib/browse-favorites";
  import {
    buildBrowseTree,
    collectActiveBrowseFolderIds,
    filterBrowseTree,
    flattenBrowseTree
  } from "$lib/browse-tree";
  import { createDiagnosticDisplayItems } from "$lib/diagnostics";
  import type { SourceTargetInfo } from "$lib/source-target";

  export let data: {
    collection: ResolvedDiagramTourCollection;
    sourceTarget: SourceTargetInfo;
  };

  let theme: ThemeName = readInitialTheme();
  let isBrowseOpen = false;
  let isDiagnosticsOpen = false;
  let previousPathname = "";
  let browsePanel: HTMLDivElement | undefined;
  let browseSearchInput: HTMLInputElement | undefined;
  let browseOpenedAt = 0;
  let browseSearch = "";
  let favoriteSlugs: string[] = [];
  let expandedFolderIds: string[] = [];
  let activeEntry: ResolvedDiagramTourCollection["entries"][number] | null = null;
  let activeSlug: string | null = null;
  let browseTree = buildBrowseTree(data.collection.entries, null);
  let activeFolderIds: string[] = [];
  let diagnosticItems = createDiagnosticDisplayItems(data.collection.skipped);
  let favoriteEntries = buildFavoriteBrowseEntries({
    entries: data.collection.entries,
    favoriteSlugs,
    query: browseSearch
  });
  let filteredBrowseTree = browseTree;
  let isBrowseFiltering = false;
  let browseRows = flattenBrowseTree(browseTree, [], false);
  let isHydrated = false;

  $: {
    activeSlug = readActiveSlug(page.url.pathname);
    activeEntry = readActiveEntry(data.collection.entries, activeSlug);
    browseTree = buildBrowseTree(data.collection.entries, activeSlug);
    activeFolderIds = collectActiveBrowseFolderIds(browseTree);
    diagnosticItems = createDiagnosticDisplayItems(data.collection.skipped);
    favoriteEntries = buildFavoriteBrowseEntries({
      entries: data.collection.entries,
      favoriteSlugs,
      query: browseSearch
    });
    filteredBrowseTree = filterBrowseTree(browseTree, browseSearch);
    isBrowseFiltering = browseSearch.trim().length > 0;
    browseRows = flattenBrowseTree(filteredBrowseTree, expandedFolderIds, isBrowseFiltering);
  }

  function handleThemeToggle(): void {
    theme = toggleTheme(theme);
    setDocumentTheme(document, theme);
    setStoredTheme(window.localStorage, theme);
  }

  async function toggleBrowse(): Promise<void> {
    if (isBrowseOpen) {
      closeBrowse();

      return;
    }

    closeDiagnostics();
    await openBrowse();
  }

  function toggleDiagnostics(): void {
    if (isDiagnosticsOpen) {
      closeDiagnostics();

      return;
    }

    closeBrowse();
    isDiagnosticsOpen = true;
  }

  async function openBrowse(): Promise<void> {
    browseOpenedAt = Date.now();
    expandedFolderIds = mergeExpandedFolderIds(expandedFolderIds, activeFolderIds);
    isBrowseOpen = true;
    await tick();
    focusBrowseEntry();
  }

  function closeBrowse(): void {
    isBrowseOpen = false;
    browseSearch = "";
  }

  function closeDiagnostics(): void {
    isDiagnosticsOpen = false;
  }

  function handleBrowseBackdropClick(): void {
    if (Date.now() - browseOpenedAt < 150) {
      return;
    }

    closeBrowse();
    closeDiagnostics();
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (!shouldCloseOverlayOnEscape(event.key, isBrowseOpen, isDiagnosticsOpen)) {
      return;
    }

    closeBrowse();
    closeDiagnostics();
  }

  function handleExternalBrowseToggle(): void {
    void toggleBrowse();
  }

  onMount(() => {
    const storedTheme = getStoredTheme(window.localStorage);

    if (storedTheme !== null) {
      theme = storedTheme;
    }

    favoriteSlugs = readStoredFavoriteSlugs(window.localStorage);
    setDocumentTheme(document, theme);
    previousPathname = page.url.pathname;
    isHydrated = true;
    window.addEventListener("diagram-tour-toggle-browse", handleExternalBrowseToggle);

    return () => {
      window.removeEventListener("diagram-tour-toggle-browse", handleExternalBrowseToggle);
    };
  });

  $: if (page.url.pathname !== previousPathname) {
    previousPathname = page.url.pathname;
    isBrowseOpen = false;
    isDiagnosticsOpen = false;
    browseSearch = "";
  }

  function handleBrowseSearchInput(event: Event): void {
    browseSearch = (event.currentTarget as HTMLInputElement).value;
  }

  function toggleFolder(folderId: string): void {
    expandedFolderIds = expandedFolderIds.includes(folderId)
      ? expandedFolderIds.filter((item) => item !== folderId)
      : [...expandedFolderIds, folderId];
  }

  function toggleFavorite(slug: string): void {
    favoriteSlugs = toggleFavoriteSlug(favoriteSlugs, slug);
    writeStoredFavoriteSlugs(window.localStorage, favoriteSlugs);
  }

  function isFavorite(slug: string): boolean {
    return favoriteSlugs.includes(slug);
  }

  function isFolderExpanded(folderId: string): boolean {
    return isBrowseFiltering || expandedFolderIds.includes(folderId);
  }

  function readInitialTheme(): ThemeName {
    if (typeof document === "undefined") {
      return DEFAULT_THEME;
    }

    return getDocumentTheme(document) ?? DEFAULT_THEME;
  }

  function readActiveSlug(pathname: string): string | null {
    const slug = pathname.replace(/^\/+/, "");

    return slug.length === 0 ? null : slug;
  }

  function mergeExpandedFolderIds(current: string[], next: string[]): string[] {
    return Array.from(new Set([...current, ...next]));
  }

  function shouldCloseOverlayOnEscape(
    key: string,
    browseOpen: boolean,
    diagnosticsOpen: boolean
  ): boolean {
    return key === "Escape" && (browseOpen || diagnosticsOpen);
  }

  function readActiveEntry(
    entries: ResolvedDiagramTourCollection["entries"],
    slug: string | null
  ): ResolvedDiagramTourCollection["entries"][number] | null {
    return entries.find((entry) => entry.slug === slug) ?? null;
  }

  function focusBrowseEntry(): void {
    if (browseSearchInput !== undefined) {
      browseSearchInput.focus();

      return;
    }

    browsePanel?.focus();
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div class="theme-root" data-theme={theme} data-hydrated={isHydrated} data-testid="theme-root">
  <Toaster richColors position="top-right" />

  <div class="app-shell">
    <header class="topbar">
      <div class="topbar__brandrow">
        <a href={resolve("/")} class="topbar__brand">Diagram Tours</a>
      </div>

      <div class="topbar__actions">
        <button
          type="button"
          class="button button--secondary topbar__browsebutton"
          data-testid="browse-trigger"
          aria-expanded={isBrowseOpen}
          aria-controls="browse-panel"
          on:click={toggleBrowse}
        >
          Browse
        </button>
        {#if data.collection.skipped.length > 0}
          <div class="diagnostics-anchor">
            <button
              type="button"
              class="button button--secondary diagnostics-trigger"
              class:diagnostics-trigger--active={isDiagnosticsOpen}
              data-testid="diagnostics-trigger"
              aria-expanded={isDiagnosticsOpen}
              aria-controls="diagnostics-panel"
              on:click={toggleDiagnostics}
            >
              <span class="diagnostics-trigger__icon" aria-hidden="true">!</span>
              <span class="diagnostics-trigger__label">Issues</span>
              <span class="diagnostics-trigger__count" data-testid="diagnostics-count">
                {data.collection.skipped.length}
              </span>
            </button>

            {#if isDiagnosticsOpen}
              <div
                id="diagnostics-panel"
                class="diagnostics-panel"
                data-testid="diagnostics-panel"
                tabindex="-1"
              >
                <div class="diagnostics-panel__summary">
                  <p class="diagnostics-panel__title">Skipped tours</p>
                  <p class="diagnostics-panel__copy" data-testid="diagnostics-summary">
                    {data.collection.skipped.length}
                    {data.collection.skipped.length === 1
                      ? " invalid tour was omitted from the collection."
                      : " invalid tours were omitted from the collection."}
                  </p>
                </div>

                <div class="diagnostics-list" data-testid="diagnostics-list">
                  {#each diagnosticItems as diagnostic (diagnostic.path)}
                    <article class="diagnostics-item" data-testid="diagnostics-item">
                      <p class="diagnostics-item__title">{diagnostic.title}</p>
                      <p class="diagnostics-item__path">{diagnostic.path}</p>
                      <p class="diagnostics-item__error">{diagnostic.summary}</p>
                      {#if diagnostic.detail !== null}
                        <p class="diagnostics-item__detail">{diagnostic.detail}</p>
                      {/if}
                    </article>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
        <a
          class="topbar__link"
          href="https://christianguzman.uk"
          target="_blank"
          rel="noreferrer"
        >
          christianguzman.uk
        </a>
        <button
          type="button"
          class="button button--secondary theme-toggle"
          data-testid="theme-toggle"
          on:click={handleThemeToggle}
        >
          {getThemeToggleLabel(theme)}
        </button>
      </div>
    </header>

    {#if isBrowseOpen || isDiagnosticsOpen}
      <button
        type="button"
        class="browse-backdrop"
        aria-label="Close browse panel"
        data-testid="browse-backdrop"
        on:click={handleBrowseBackdropClick}
      ></button>
    {/if}

    <div class="app-canvas">
      {#if isBrowseOpen}
        <div
          bind:this={browsePanel}
          id="browse-panel"
          class="browse-panel"
          data-testid="browse-panel"
          tabindex="-1"
        >
          {#if activeEntry !== null}
            <div class="browse-panel__context" data-testid="browse-active-path">
              <span class="browse-panel__contextlabel">Selected path</span>
              <span class="browse-panel__contextvalue">{activeEntry.sourcePath}</span>
            </div>
          {/if}

          {#if data.sourceTarget.kind === "file"}
            <div class="browse-panel__notice" data-testid="preview-target-notice">
              <span class="browse-panel__noticemark" aria-hidden="true">></span>
              <p>Previewing {data.sourceTarget.label}</p>
            </div>
          {/if}

          <label class="browse-search">
            <span class="browse-search__label">Search tours</span>
            <input
              bind:this={browseSearchInput}
              type="text"
              class="browse-search__input"
              placeholder="Search by title, slug, or path"
              data-testid="browse-search-input"
              value={browseSearch}
              on:input={handleBrowseSearchInput}
            />
          </label>

          {#if favoriteEntries.length > 0}
            <section class="browse-favorites" data-testid="browse-favorites">
              <p class="browse-favorites__label">Favorites</p>
              <div class="browse-favorites__list">
                {#each favoriteEntries as favorite (favorite.slug)}
                  <div
                    class:browse-row--active={favorite.slug === activeSlug}
                    class="browse-row browse-row--favorite"
                    data-testid="browse-favorite-row"
                  >
                    <a
                      href={resolve(`/${favorite.slug}`)}
                      class="browse-row__link"
                      data-tour-slug={favorite.slug}
                      on:click={closeBrowse}
                    >
                      <span class="browse-row__caret" aria-hidden="true"></span>
                      <span
                        class="browse-row__icon browse-row__icon--tour"
                        data-testid="browse-tour-icon"
                        aria-hidden="true"
                      ></span>
                      <span class="browse-row__content">
                        <span class="browse-row__title">{favorite.title}</span>
                      </span>
                    </a>
                    <button
                      type="button"
                      class:browse-row__favorite--active={isFavorite(favorite.slug)}
                      class="browse-row__favorite"
                      data-testid="favorite-toggle"
                      aria-pressed={isFavorite(favorite.slug)}
                      aria-label={`Toggle favorite for ${favorite.title}`}
                      on:click|preventDefault|stopPropagation={() => toggleFavorite(favorite.slug)}
                    >
                      *
                    </button>
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          {#if browseRows.length === 0}
            <div class="browse-empty-state" data-testid="browse-empty-state">
              <p>No tours match "{browseSearch}".</p>
            </div>
          {:else}
            <nav class="browse-tree" data-testid="browse-tree">
              {#each browseRows as row (row.node.id)}
                {#if row.node.kind === "folder"}
                  <button
                    type="button"
                    class:browse-row--active={row.node.isActiveBranch}
                    class:browse-row--expanded={isFolderExpanded(row.node.id)}
                    class="browse-row browse-row--folder"
                    data-testid="browse-folder-row"
                    data-folder-id={row.node.id}
                    style={`--browse-depth:${row.depth};`}
                    aria-expanded={isFolderExpanded(row.node.id)}
                    on:click={() => toggleFolder(row.node.id)}
                  >
                    <span class="browse-row__caret" aria-hidden="true">
                      {isFolderExpanded(row.node.id) ? "-" : "+"}
                    </span>
                    <span
                      class="browse-row__icon browse-row__icon--folder"
                      data-testid="browse-folder-icon"
                      aria-hidden="true"
                    ></span>
                    <span class="browse-row__content">
                      <span class="browse-row__title browse-row__title--folder">
                        {row.node.displayName}
                      </span>
                    </span>
                  </button>
                {:else}
                  {@const tourNode = row.node}
                  <div
                    class:browse-row--active={tourNode.isActive}
                    class="browse-row browse-row--tour"
                    data-testid="browse-tour-row"
                    data-tour-slug={tourNode.slug}
                    style={`--browse-depth:${row.depth};`}
                  >
                    <a
                      href={resolve(`/${tourNode.slug}`)}
                      class="browse-row__link"
                      on:click={closeBrowse}
                    >
                      <span class="browse-row__caret" aria-hidden="true"></span>
                      <span
                        class="browse-row__icon browse-row__icon--tour"
                        data-testid="browse-tour-icon"
                        aria-hidden="true"
                      ></span>
                      <span class="browse-row__content">
                        <span class="browse-row__title">{tourNode.title}</span>
                      </span>
                    </a>
                    <button
                      type="button"
                      class:browse-row__favorite--active={isFavorite(tourNode.slug)}
                      class="browse-row__favorite"
                      data-testid="favorite-toggle"
                      aria-pressed={isFavorite(tourNode.slug)}
                      aria-label={`Toggle favorite for ${tourNode.title}`}
                      on:click|preventDefault|stopPropagation={() => toggleFavorite(tourNode.slug)}
                    >
                      *
                    </button>
                  </div>
                {/if}
              {/each}
            </nav>
          {/if}
        </div>
      {/if}

      <main class="app-main">
        <slot />
      </main>
    </div>
  </div>
</div>
