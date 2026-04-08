<script lang="ts">
  import { afterNavigate, goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";
  import {
    buildBrowsePaletteSections,
    flattenBrowsePaletteSections,
    moveBrowsePaletteSlug,
    readInitialBrowsePaletteSlug,
    type BrowsePaletteItem,
    type BrowsePaletteSection
  } from "$lib/browse-palette";
  import {
    readStoredFavoriteSlugs,
    toggleFavoriteSlug,
    writeStoredFavoriteSlugs
  } from "$lib/browse-favorites";
  import {
    readStoredRecentSlugs,
    rememberRecentSlug,
    writeStoredRecentSlugs
  } from "$lib/browse-recents";
  import {
    countDiagnosticIssues,
    createDiagnosticDisplayGroups
  } from "$lib/diagnostics";
  import type { SourceTargetInfo } from "$lib/source-target";
  import {
    DEFAULT_THEME,
    getDocumentTheme,
    getStoredTheme,
    getThemeToggleLabel,
    setDocumentTheme,
    setStoredTheme,
    toggleTheme,
    type ThemeName
  } from "$lib/theme";
  import type { ResolvedDiagramTourCollection } from "@diagram-tour/core";
  import { onMount, tick } from "svelte";
  import { Toaster } from "svelte-sonner";
  import "../styles/index.css";

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
  let diagnosticsAnchor: HTMLDivElement | undefined;
  let browseOpenedAt = 0;
  let browseOpenedForPath: string | null = null;
  let diagnosticsPanelStyle = "";
  let browseSearch = "";
  let favoriteSlugs: string[] = [];
  let recentSlugs: string[] = [];
  let activeEntry: ResolvedDiagramTourCollection["entries"][number] | null = null;
  let activeSlug: string | null = null;
  let browseShortcutHint = "Cmd K";
  let browseSections: BrowsePaletteSection[] = [];
  let browseItems: BrowsePaletteItem[] = [];
  let activeBrowseSlug: string | null = null;
  let diagnosticGroups = createDiagnosticDisplayGroups(data.collection.skipped);
  let diagnosticIssueCount = countDiagnosticIssues(diagnosticGroups);
  let isHydrated = false;
  let breadcrumbs = ["diagram-tours", "collection"];
  let currentPathname: string = page.url.pathname;

  afterNavigate((navigation) => {
    currentPathname = navigation.to?.url.pathname ?? window.location.pathname;
  });

  $: {
    activeSlug = readActiveSlug(currentPathname);
    activeEntry = readActiveEntry(data.collection.entries, activeSlug);
    diagnosticGroups = createDiagnosticDisplayGroups(data.collection.skipped);
    diagnosticIssueCount = countDiagnosticIssues(diagnosticGroups);
    browseSections = buildBrowsePaletteSections({
      entries: data.collection.entries,
      favoriteSlugs,
      query: browseSearch,
      recentSlugs
    });
    browseItems = flattenBrowsePaletteSections(browseSections);
    activeBrowseSlug = readInitialBrowsePaletteSlug({
      activeSlug: activeBrowseSlug,
      currentSlug: activeSlug,
      items: browseItems
    });
    breadcrumbs = readBreadcrumbs(activeEntry);
  }

  function handleThemeToggle(): void {
    theme = toggleTheme(theme);
    setDocumentTheme(document, theme);
    setStoredTheme(window.localStorage, theme);
  }

  async function openBrowsePalette(): Promise<void> {
    if (isBrowseOpen) {
      await tick();
      focusBrowseEntry();

      return;
    }

    closeDiagnostics();
    browseOpenedAt = Date.now();
    browseOpenedForPath = currentPathname;
    isBrowseOpen = true;
    activeBrowseSlug = readInitialBrowsePaletteSlug({
      activeSlug: null,
      currentSlug: activeSlug,
      items: browseItems
    });
    await tick();
    focusBrowseEntry();
  }

  function toggleDiagnostics(): void {
    if (isDiagnosticsOpen) {
      closeDiagnostics();

      return;
    }

    closeBrowse();
    syncDiagnosticsPanelPosition();
    isDiagnosticsOpen = true;
  }

  function closeBrowse(): void {
    isBrowseOpen = false;
    browseSearch = "";
    activeBrowseSlug = null;
    browseOpenedForPath = null;
  }

  function closeDiagnostics(): void {
    isDiagnosticsOpen = false;
    diagnosticsPanelStyle = "";
  }

  async function copyDiagnosticReference(reference: string): Promise<void> {
    await navigator.clipboard.writeText(reference);
    toast.success("Reference copied to clipboard.");
  }

  function handleBrowseBackdropClick(): void {
    if (Date.now() - browseOpenedAt < 150) {
      return;
    }

    closeBrowse();
    closeDiagnostics();
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (isBrowseShortcut(event)) {
      event.preventDefault();
      void openBrowsePalette();

      return;
    }

    if (handleOverlayEscape(event.key, isBrowseOpen, isDiagnosticsOpen)) {
      return;
    }

    handleBrowsePaletteKeydown(event);
  }

  function handleExternalBrowseToggle(): void {
    void openBrowsePalette();
  }

  function handleWindowResize(): void {
    syncDiagnosticsPanelPosition();
  }

  onMount(() => {
    const storedTheme = getStoredTheme(window.localStorage);

    if (storedTheme !== null) {
      theme = storedTheme;
    }

    favoriteSlugs = readStoredFavoriteSlugs(window.localStorage);
    recentSlugs = readStoredRecentSlugs(window.localStorage);
    browseShortcutHint = isMacPlatform(window.navigator) ? "Cmd K" : "Ctrl K";
    setDocumentTheme(document, theme);
    previousPathname = currentPathname;
    isHydrated = true;
    rememberActiveSlug(activeSlug);
    window.addEventListener("diagram-tour-toggle-browse", handleExternalBrowseToggle);

    return () => {
      window.removeEventListener("diagram-tour-toggle-browse", handleExternalBrowseToggle);
    };
  });

  $: if (currentPathname !== previousPathname) {
    previousPathname = currentPathname;
    if (browseOpenedForPath !== currentPathname) {
      closeBrowse();
    }
    closeDiagnostics();
    rememberActiveSlug(activeSlug);
  }

  function handleBrowseSearchInput(event: Event): void {
    browseSearch = (event.currentTarget as HTMLInputElement).value;
  }

  function toggleFavorite(slug: string): void {
    favoriteSlugs = toggleFavoriteSlug(favoriteSlugs, slug);
    writeStoredFavoriteSlugs(window.localStorage, favoriteSlugs);
  }

  function isFavorite(slug: string): boolean {
    return favoriteSlugs.includes(slug);
  }

  async function navigateToBrowseSlug(slug: string): Promise<void> {
    const nextPathname = resolve(`/${slug}`);

    closeBrowse();
    currentPathname = nextPathname;
    await goto(resolve(`/${slug}`));
  }

  function setActiveBrowseSlug(slug: string): void {
    activeBrowseSlug = slug;
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

  function shouldCloseOverlayOnEscape(
    key: string,
    browseOpen: boolean,
    diagnosticsOpen: boolean
  ): boolean {
    return key === "Escape" && (browseOpen || diagnosticsOpen);
  }

  function handleOverlayEscape(
    key: string,
    browseOpen: boolean,
    diagnosticsOpen: boolean
  ): boolean {
    if (!shouldCloseOverlayOnEscape(key, browseOpen, diagnosticsOpen)) {
      return false;
    }

    closeBrowse();
    closeDiagnostics();

    return true;
  }

  function isBrowseShortcut(event: KeyboardEvent): boolean {
    if (isEditingField(document.activeElement)) {
      return false;
    }

    return isMetaBrowseShortcut(event) || isSlashBrowseShortcut(event);
  }

  function isMetaBrowseShortcut(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
  }

  function isSlashBrowseShortcut(event: KeyboardEvent): boolean {
    return event.key === "/" && !hasBrowseModifier(event);
  }

  function isEditingField(element: Element | null): boolean {
    return element !== null && (isFormField(element) || isContentEditableField(element));
  }

  function readActiveEntry(
    entries: ResolvedDiagramTourCollection["entries"],
    slug: string | null
  ): ResolvedDiagramTourCollection["entries"][number] | null {
    return entries.find((entry) => entry.slug === slug) ?? null;
  }

  function readBreadcrumbs(
    entry: ResolvedDiagramTourCollection["entries"][number] | null
  ): string[] {
    if (entry === null) {
      return ["diagram-tours", "collection"];
    }

    return ["diagram-tours", entry.tour.diagram.type, entry.title];
  }

  function readBrowseRowTestId(sectionId: BrowsePaletteSection["id"]): string {
    if (sectionId === "favorites") {
      return "browse-favorite-row";
    }

    if (sectionId === "recent") {
      return "browse-recent-row";
    }

    return "browse-tour-row";
  }

  function readStepCountLabel(stepCount: number): string {
    return `${stepCount} step${stepCount === 1 ? "" : "s"}`;
  }

  function rememberActiveSlug(slug: string | null): void {
    if (!isHydrated || slug === null) {
      return;
    }

    recentSlugs = rememberRecentSlug(recentSlugs, slug);
    writeStoredRecentSlugs(window.localStorage, recentSlugs);
  }

  function focusBrowseEntry(): void {
    if (browseSearchInput !== undefined) {
      browseSearchInput.focus();
      browseSearchInput.select();

      return;
    }

    browsePanel?.focus();
  }

  function isMacPlatform(navigatorValue: Navigator): boolean {
    return /mac/i.test(navigatorValue.userAgent);
  }

  function handleBrowsePaletteKeydown(event: KeyboardEvent): void {
    if (!isBrowseOpen) {
      return;
    }

    if (handleBrowseArrowKeydown(event)) {
      return;
    }

    handleBrowseEnterKeydown(event, activeBrowseSlug);
  }

  function handleBrowseArrowKeydown(event: KeyboardEvent): boolean {
    const direction = readBrowseArrowDirection(event.key);

    if (direction === null) {
      return false;
    }

    event.preventDefault();
    activeBrowseSlug = moveBrowsePaletteSlug({
      activeSlug: activeBrowseSlug,
      direction,
      items: browseItems
    });

    return true;
  }

  function handleBrowseEnterKeydown(event: KeyboardEvent, slug: string | null): void {
    if (event.key !== "Enter" || slug === null) {
      return;
    }

    event.preventDefault();
    void navigateToBrowseSlug(slug);
  }

  function hasBrowseModifier(event: KeyboardEvent): boolean {
    return event.metaKey || event.ctrlKey || event.altKey;
  }

  function readBrowseArrowDirection(key: string): -1 | 1 | null {
    if (key === "ArrowDown") {
      return 1;
    }

    if (key === "ArrowUp") {
      return -1;
    }

    return null;
  }

  function isFormField(element: Element): boolean {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
  }

  function isContentEditableField(element: Element): boolean {
    return element.getAttribute("contenteditable") === "true";
  }

  function syncDiagnosticsPanelPosition(): void {
    if (diagnosticsAnchor === undefined) {
      return;
    }

    const bounds = diagnosticsAnchor.getBoundingClientRect();
    const top = Math.round(bounds.bottom + 8);
    const right = Math.max(16, Math.round(window.innerWidth - bounds.right));

    diagnosticsPanelStyle = `top: ${top}px; right: ${right}px;`;
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} on:resize={handleWindowResize} />

<div class="theme-root" data-theme={theme} data-hydrated={isHydrated} data-testid="theme-root">
  <Toaster richColors position="bottom-right" />

  <div class="app-shell">
    <header class="topbar">
      <div class="topbar__left" data-testid="topbar-left">
        <a href={resolve("/")} class="topbar__brand">diagram-tours</a>
        <p class="topbar__breadcrumbs" data-testid="topbar-breadcrumbs">
          {breadcrumbs.join(" / ")}
        </p>
      </div>

      <div class="topbar__center" data-testid="topbar-center">
        <button
          type="button"
          class="topbar__searchhint"
          data-testid="search-hint-trigger"
          aria-expanded={isBrowseOpen}
          aria-controls="browse-panel"
          on:click={() => void openBrowsePalette()}
        >
          <svg class="topbar__searchhinticon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5"></circle>
            <path d="M10.5 10.5 14 14"></path>
          </svg>
          <span>Search tours...</span>
          <span class="topbar__searchhintkey">{browseShortcutHint}</span>
        </button>
      </div>

      <div class="topbar__actions" data-testid="topbar-right">
        <div bind:this={diagnosticsAnchor} class="diagnostics-anchor">
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
              {diagnosticIssueCount}
            </span>
          </button>

        </div>
        <a
          class="topbar__link"
          href="https://github.com/h-4vok/diagram-tours"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a
          class="topbar__link"
          href="https://github.com/h-4vok/diagram-tours/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          Docs
        </a>
        <a
          class="topbar__link"
          href="https://christianguzman.uk"
          target="_blank"
          rel="noreferrer"
        >
          Blog
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


    {#if isDiagnosticsOpen}
      <div
        id="diagnostics-panel"
        class="diagnostics-panel"
        data-testid="diagnostics-panel"
        tabindex="-1"
        style={diagnosticsPanelStyle}
      >
        <div class="diagnostics-panel__header">
          <div class="diagnostics-panel__summary">
            <p class="diagnostics-panel__title">Issues Detected</p>
            <p class="diagnostics-panel__copy" data-testid="diagnostics-summary">
              {diagnosticIssueCount > 0
                ? `${diagnosticIssueCount} issue${diagnosticIssueCount === 1 ? "" : "s"} across ${diagnosticGroups.length} source file${diagnosticGroups.length === 1 ? "" : "s"} in current workspace.`
                : "All clear. No issues found in current workspace."}
            </p>
          </div>
          <span class="diagnostics-panel__badge" data-testid="diagnostics-panel-count">
            {diagnosticIssueCount}
          </span>
        </div>

        {#if diagnosticGroups.length === 0}
          <div class="diagnostics-empty" data-testid="diagnostics-empty-state">
            <span class="diagnostics-empty__icon" aria-hidden="true">?</span>
            <p class="diagnostics-empty__title">All clear</p>
            <p class="diagnostics-empty__copy">No issues found in current workspace.</p>
          </div>
        {:else}
          <div class="diagnostics-list" data-testid="diagnostics-list">
            {#each diagnosticGroups as group (group.path)}
              <section class="diagnostics-group" data-testid="diagnostics-group">
                <div class="diagnostics-group__context">
                  <div class="diagnostics-group__summary">
                    <code class="diagnostics-group__path" title={group.path}>{group.path}</code>
                    <p class="diagnostics-group__count" data-testid="diagnostics-group-count">
                      {group.issueCount} issue{group.issueCount === 1 ? "" : "s"}
                    </p>
                    <button
                      type="button"
                      class="diagnostics-item__copy diagnostics-group__copy"
                      data-testid="diagnostics-copy-path"
                      aria-label={`Copy ${group.path}`}
                      on:click={() => void copyDiagnosticReference(group.path)}
                    >
                      Copy Path
                    </button>
                  </div>
                </div>

                <div class="diagnostics-group__items">
                  {#each group.issues as issue, index (`${group.path}:${index}`)}
                    <article class="diagnostics-item" data-testid="diagnostics-item">
                      <div class="diagnostics-item__context">
                        <p class="diagnostics-item__error">{issue.summary}</p>
                      </div>
                      <code class="diagnostics-item__path" title={issue.reference}>{issue.reference}</code>
                      {#if issue.code !== null}
                        <p class="diagnostics-item__detail">
                          <code class="diagnostics-item__code">{issue.code}</code>
                        </p>
                      {/if}
                      {#if issue.detail !== null}
                        <p class="diagnostics-item__detail">{issue.detail}</p>
                      {/if}
                      {#if issue.location !== null}
                        <p class="diagnostics-item__detail">
                          <code class="diagnostics-item__code">
                            {issue.location.line}:{issue.location.column}
                          </code>
                        </p>
                      {/if}
                      <button
                        type="button"
                        class="diagnostics-item__copy diagnostics-item__copy--inline"
                        data-testid="diagnostics-copy-reference"
                        aria-label={`Copy ${issue.reference}`}
                        on:click={() => void copyDiagnosticReference(issue.reference)}
                      >
                        Copy Ref
                      </button>
                    </article>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        {/if}
      </div>
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
            <input
              bind:this={browseSearchInput}
              type="text"
              class="browse-search__input"
              placeholder="Search tours, diagrams, or folders..."
              data-testid="browse-search-input"
              value={browseSearch}
              on:input={handleBrowseSearchInput}
            />
          </label>

          {#if browseItems.length === 0}
            <div class="browse-empty-state" data-testid="browse-empty-state">
              <p>No tours match "{browseSearch}".</p>
            </div>
          {:else}
            <div class="browse-results" data-testid="browse-tree" role="listbox" aria-label="Browse tours">
              {#each browseSections as section (section.id)}
                <section
                  class:browse-favorites={section.id === "favorites"}
                  class="browse-section"
                  data-testid={section.id === "favorites" ? "browse-favorites" : undefined}
                >
                  <p class="browse-section__label">{section.title}</p>
                  <div class="browse-section__list">
                    {#each section.items as item (`${section.id}:${item.slug}`)}
                      <div
                        class:browse-row--active={item.slug === activeBrowseSlug}
                        class:browse-row--current={item.slug === activeSlug}
                        class="browse-row browse-row--tour"
                        data-testid={readBrowseRowTestId(section.id)}
                        data-tour-slug={item.slug}
                      >
                        <button
                          type="button"
                          role="option"
                          class="browse-row__action"
                          aria-selected={item.slug === activeBrowseSlug}
                          on:click={() => void navigateToBrowseSlug(item.slug)}
                          on:focus={() => setActiveBrowseSlug(item.slug)}
                          on:mousemove={() => setActiveBrowseSlug(item.slug)}
                        >
                          <span
                            class={`browse-row__icon browse-row__icon--${item.diagramType}`}
                            data-testid="browse-tour-icon"
                            aria-hidden="true"
                          ></span>
                          <span class="browse-row__content">
                            <span class="browse-row__title">{item.title}</span>
                            <span class="browse-row__path">{item.sourcePath}</span>
                          </span>
                          <span class="browse-row__meta">{readStepCountLabel(item.stepCount)}</span>
                        </button>
                        <button
                          type="button"
                          class:browse-row__favorite--active={isFavorite(item.slug)}
                          class="browse-row__favorite"
                          data-testid="favorite-toggle"
                          aria-pressed={isFavorite(item.slug)}
                          aria-label={`Toggle favorite for ${item.title}`}
                          on:click|preventDefault|stopPropagation={() => toggleFavorite(item.slug)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" class="browse-row__favoriteicon">
                            <path
                              d="M12 3.25 14.7 8.72l6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6L3.27 9.6l6.03-.88L12 3.25Z"
                            />
                          </svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                </section>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <main class="app-main">
        <slot />
      </main>
    </div>
  </div>
</div>
