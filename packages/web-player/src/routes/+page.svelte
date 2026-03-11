<script lang="ts">
  import {
    pageDescription,
    pageTitle,
    workspacePackages
  } from "../lib/workspace-content";
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={pageDescription} />
</svelte:head>

<div class="page">
  <div class="hero">
    <p class="eyebrow">diagram-tour</p>
    <h1>Diagram tours for Mermaid workflows</h1>
    <p class="lede">
      This app is intentionally minimal. It exists to verify the workspace setup and provide
      a clean starting point for the future player UI.
    </p>
  </div>

  <section class="panel">
    <h2>Workspace packages</h2>
    <ul>
      {#each workspacePackages as pkg (pkg.name)}
        <li>
          <strong>{pkg.name}</strong>
          <span>{pkg.description}</span>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: "Segoe UI", sans-serif;
    background:
      radial-gradient(circle at top left, #f2efe6, transparent 40%),
      linear-gradient(180deg, #f7f6f2 0%, #ece7dd 100%);
    color: #1f2933;
  }

  .page {
    min-height: 100vh;
    padding: 3rem 1.5rem;
  }

  .hero,
  .panel {
    max-width: 720px;
    margin: 0 auto;
  }

  .eyebrow {
    margin: 0 0 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.8rem;
    color: #8a5a44;
  }

  h1 {
    margin: 0;
    font-size: clamp(2.5rem, 7vw, 4.75rem);
    line-height: 0.95;
  }

  .lede {
    max-width: 44rem;
    font-size: 1.05rem;
    line-height: 1.7;
    color: #425466;
  }

  .panel {
    margin-top: 2.5rem;
    padding: 1.5rem;
    border: 1px solid rgba(31, 41, 51, 0.1);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(6px);
  }

  h2 {
    margin-top: 0;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 1rem;
  }

  li {
    display: grid;
    gap: 0.25rem;
  }

  strong {
    font-size: 1rem;
  }

  span {
    color: #52606d;
    line-height: 1.5;
  }
</style>
