import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Layout from "../src/routes/+layout.svelte";
import { resolvedTourCollection, singleTourCollection } from "./fixtures/tour-collection";

describe("+layout.svelte", () => {
  it("renders the top bar and navigation, even for a single-tour collection", async () => {
    render(Layout, {
      data: {
        collection: singleTourCollection
      }
    });

    expect(await screen.findByText("Diagram Tours")).toBeDefined();
    expect(await screen.findByTestId("tour-navigation")).toBeDefined();
    expect(screen.getAllByTestId("tour-nav-link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Payment Flow" }).getAttribute("href")).toBe(
      "/payment-flow"
    );
  });

  it("renders multiple navigation entries and keeps the theme toggle available", async () => {
    render(Layout, {
      data: {
        collection: resolvedTourCollection
      }
    });

    expect(await screen.findAllByTestId("tour-nav-link")).toHaveLength(2);
    expect(screen.getByTestId("theme-toggle").textContent).toContain("Dark mode");

    await fireEvent.click(screen.getByTestId("theme-toggle"));

    expect(screen.getByTestId("theme-root").getAttribute("data-theme")).toBe("dark");
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
        }
      }
    });

    expect((await screen.findByTestId("skipped-tours-notice")).textContent?.replace(/\s+/g, " ")).toContain(
      "1 tour was skipped due to validation errors."
    );
  });
});
