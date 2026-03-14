import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it } from "vitest";

import Layout from "../src/routes/+layout.svelte";
import { resolvedTourCollection, singleTourCollection } from "./fixtures/tour-collection";

const directorySourceTarget = {
  kind: "directory" as const,
  label: "examples",
  path: "/repo/examples"
};

describe("+layout.svelte", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the top bar and a browse entry point for navigation", async () => {
    render(Layout, {
      data: {
        collection: singleTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    expect(await screen.findByText("Diagram Tours")).toBeDefined();
    expect(screen.getByTestId("browse-trigger")).toBeDefined();
    expect(screen.queryByTestId("browse-panel")).toBeNull();
    expect(screen.queryByTestId("tour-navigation")).toBeNull();
  });

  it("opens browse, shows tours, and keeps the theme toggle available", async () => {
    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    expect(screen.getByRole("link", { name: "christianguzman.uk" }).getAttribute("href")).toBe(
      "https://christianguzman.uk"
    );
    await fireEvent.click(screen.getByTestId("browse-trigger"));

    expect(await screen.findAllByTestId("tour-nav-link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Payment Flow" }).getAttribute("href")).toBe(
      "/payment-flow"
    );
    expect(screen.getByTestId("theme-toggle").textContent).toContain("Dark mode");

    await fireEvent.click(screen.getByTestId("theme-toggle"));

    expect(screen.getByTestId("theme-root").getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("diagram-tour-theme")).toBe("dark");
  });

  it("hydrates the theme from persistent storage", async () => {
    window.localStorage.setItem("diagram-tour-theme", "dark");

    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    expect((await screen.findByTestId("theme-root")).getAttribute("data-theme")).toBe("dark");
    expect(screen.getByTestId("theme-toggle").textContent).toContain("Light mode");
  });

  it("surfaces skipped-tour information when discovery skips invalid tours", async () => {
    render(Layout, {
      data: {
        collection: {
          ...resolvedTourCollection,
          skipped: [
            {
              sourcePath: "broken.tour.yaml",
              error: "broken"
            }
          ]
        },
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("browse-trigger"));

    expect(
      (await screen.findByTestId("skipped-tours-notice")).textContent?.replace(/\s+/g, " ")
    ).toContain("1 tour was skipped due to validation errors.");
  });

  it("shows the preview notice for single-file author previews", async () => {
    render(Layout, {
      data: {
        collection: singleTourCollection,
        sourceTarget: {
          kind: "file" as const,
          label: "payment-flow.tour.yaml",
          path: "/repo/examples/payment-flow/payment-flow.tour.yaml"
        }
      }
    });

    await fireEvent.click(screen.getByTestId("browse-trigger"));

    expect((await screen.findByTestId("preview-target-notice")).textContent).toContain(
      "Previewing payment-flow.tour.yaml"
    );
  });

  it("closes browse with escape after opening it", async () => {
    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("browse-trigger"));
    expect(await screen.findByTestId("browse-panel")).toBeDefined();

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByTestId("browse-panel")).toBeNull();
  });
});
