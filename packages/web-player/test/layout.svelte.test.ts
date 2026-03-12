import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Layout from "../src/routes/+layout.svelte";
import { resolvedTourCollection, singleTourCollection } from "./fixtures/tour-collection";

const directorySourceTarget = {
  kind: "directory" as const,
  label: "examples",
  path: "/repo/examples"
};

describe("+layout.svelte", () => {
  it("renders the top bar and navigation, even for a single-tour collection", async () => {
    render(Layout, {
      data: {
        collection: singleTourCollection,
        sourceTarget: directorySourceTarget
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
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
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
        },
        sourceTarget: directorySourceTarget
      }
    });

    expect((await screen.findByTestId("skipped-tours-notice")).textContent?.replace(/\s+/g, " ")).toContain(
      "1 tour was skipped due to validation errors."
    );
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

    expect((await screen.findByTestId("preview-target-notice")).textContent).toContain(
      "Previewing payment-flow.tour.yaml"
    );
  });
});
