<script lang="ts">
  import { resolve } from "$app/paths";
  import "../styles/index.css";
  import { page } from "$app/state";
  import { onMount } from "svelte";
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

  function handleThemeToggle(): void {
    theme = toggleTheme(theme);
    setDocumentTheme(document, theme);
    setStoredTheme(window.localStorage, theme);
  }

  function isActiveTour(slug: string): boolean {
    return page.url.pathname === `/${slug}`;
  }

  onMount(() => {
    const storedTheme = getStoredTheme(window.localStorage);

    if (storedTheme !== null) {
      theme = storedTheme;
    }

    setDocumentTheme(document, theme);
  });

  function readInitialTheme(): ThemeName {
    if (typeof document === "undefined") {
      return DEFAULT_THEME;
    }

    return getDocumentTheme(document) ?? DEFAULT_THEME;
  }
</script>

<div class="theme-root" data-theme={theme} data-testid="theme-root">
  <Toaster richColors position="top-right" />

  <div class="page page--docs">
    <header class="docs-topbar">
      <p class="docs-topbar__label">Diagram Tours</p>
      <button
        type="button"
        class="button button--secondary theme-toggle"
        data-testid="theme-toggle"
        on:click={handleThemeToggle}
      >
        {getThemeToggleLabel(theme)}
      </button>
    </header>

    <div class="docs-shell">
      <aside class="docs-nav" data-testid="tour-navigation">
        <div class="docs-nav__header">
          <p class="docs-nav__title">All Tours</p>
        </div>

        {#if data.sourceTarget.kind === "file"}
          <div class="docs-nav__notice" data-testid="preview-target-notice">
            <span class="docs-nav-notice-mark" aria-hidden="true">></span>
            <p>Previewing {data.sourceTarget.label}</p>
          </div>
        {/if}

        {#if data.collection.skipped.length > 0}
          <div class="docs-nav__notice" data-testid="skipped-tours-notice">
            <span class="docs-nav-notice-mark" aria-hidden="true">!</span>
            <p>
              {data.collection.skipped.length}
              {data.collection.skipped.length === 1
                ? " tour was skipped due to validation errors."
                : " tours were skipped due to validation errors."}
            </p>
          </div>
        {/if}

        <nav class="tour-list">
          {#each data.collection.entries as entry (entry.slug)}
            <a
              href={resolve(`/${entry.slug}`)}
              class:tour-link--active={isActiveTour(entry.slug)}
              class="tour-link"
              data-testid="tour-nav-link"
            >
              {entry.title}
            </a>
          {/each}
        </nav>
      </aside>

      <main class="docs-main">
        <slot />
      </main>
    </div>
  </div>
</div>
