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
  import type { SourceTargetInfo } from "$lib/source-target";

  export let data: {
    collection: ResolvedDiagramTourCollection;
    sourceTarget: SourceTargetInfo;
  };

  let theme: ThemeName = readInitialTheme();
  let isBrowseOpen = false;
  let previousPathname = "";
  let browsePanel: HTMLDivElement | undefined;
  let browseOpenedAt = 0;
  let isHydrated = false;

  function handleThemeToggle(): void {
    theme = toggleTheme(theme);
    setDocumentTheme(document, theme);
    setStoredTheme(window.localStorage, theme);
  }

  function isActiveTour(slug: string): boolean {
    return page.url.pathname === `/${slug}`;
  }

  async function toggleBrowse(): Promise<void> {
    if (isBrowseOpen) {
      closeBrowse();

      return;
    }

    await openBrowse();
  }

  async function openBrowse(): Promise<void> {
    browseOpenedAt = Date.now();
    isBrowseOpen = true;
    await tick();
    browsePanel?.focus();
  }

  function closeBrowse(): void {
    isBrowseOpen = false;
  }

  function handleBrowseBackdropClick(): void {
    if (Date.now() - browseOpenedAt < 150) {
      return;
    }

    closeBrowse();
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && isBrowseOpen) {
      closeBrowse();
    }
  }

  onMount(() => {
    const storedTheme = getStoredTheme(window.localStorage);

    if (storedTheme !== null) {
      theme = storedTheme;
    }

    setDocumentTheme(document, theme);
    previousPathname = page.url.pathname;
    isHydrated = true;
  });

  $: if (page.url.pathname !== previousPathname) {
    previousPathname = page.url.pathname;
    isBrowseOpen = false;
  }

  function readInitialTheme(): ThemeName {
    if (typeof document === "undefined") {
      return DEFAULT_THEME;
    }

    return getDocumentTheme(document) ?? DEFAULT_THEME;
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

    {#if isBrowseOpen}
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
          <div class="browse-panel__header">
            <div>
              <p class="browse-panel__eyebrow">Navigate tours</p>
              <h2 class="browse-panel__title">Browse</h2>
            </div>

            <button
              type="button"
              class="button button--secondary browse-panel__close"
              aria-label="Close browse panel"
              on:click={closeBrowse}
            >
              Close
            </button>
          </div>

          {#if data.sourceTarget.kind === "file"}
            <div class="browse-panel__notice" data-testid="preview-target-notice">
              <span class="browse-panel__noticemark" aria-hidden="true">></span>
              <p>Previewing {data.sourceTarget.label}</p>
            </div>
          {/if}

          {#if data.collection.skipped.length > 0}
            <div class="browse-panel__notice" data-testid="skipped-tours-notice">
              <span class="browse-panel__noticemark" aria-hidden="true">!</span>
              <p>
                {data.collection.skipped.length}
                {data.collection.skipped.length === 1
                  ? " tour was skipped due to validation errors."
                  : " tours were skipped due to validation errors."}
              </p>
            </div>
          {/if}

          <nav class="tour-list" data-testid="browse-tour-list">
            {#each data.collection.entries as entry (entry.slug)}
              <a
                href={resolve(`/${entry.slug}`)}
                class:tour-link--active={isActiveTour(entry.slug)}
                class="tour-link"
                data-testid="tour-nav-link"
                on:click={closeBrowse}
              >
                {entry.title}
              </a>
            {/each}
          </nav>
        </div>
      {/if}

      <main class="app-main">
        <slot />
      </main>
    </div>
  </div>
</div>
