import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it } from "vitest";

import Layout from "../src/routes/+layout.svelte";
import {
  nestedTourCollection,
  resolvedTourCollection,
  singleTourCollection
} from "./fixtures/tour-collection";

const directorySourceTarget = {
  kind: "directory" as const,
  label: "examples",
  path: "/repo/examples"
};

function findFolderRow(label: string): HTMLElement {
  const folder = screen
    .getAllByTestId("browse-folder-row")
    .find((element) => element.textContent?.includes(label));

  expect(folder).toBeDefined();

  return folder!;
}

async function expandFolder(label: string): Promise<HTMLElement> {
  const folder = findFolderRow(label);

  await fireEvent.click(folder);

  return folder;
}

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
    expect(screen.queryByTestId("browse-tree")).toBeNull();
  });

  it("opens browse as an explorer tree, renders compact folders, and keeps theme toggle available", async () => {
    render(Layout, {
      data: {
        collection: nestedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    expect(screen.getByRole("link", { name: "christianguzman.uk" }).getAttribute("href")).toBe(
      "https://christianguzman.uk"
    );

    await fireEvent.click(screen.getByTestId("browse-trigger"));

    expect(await screen.findByTestId("browse-tree")).toBeDefined();
    expect(screen.getByTestId("browse-search-input")).toBeDefined();
    expect(screen.getAllByTestId("browse-folder-row")[0].textContent).toContain("payments");
    expect(screen.getAllByTestId("browse-folder-row")).toHaveLength(1);

    await fireEvent.click(screen.getAllByTestId("browse-folder-row")[0]);

    expect(screen.getAllByTestId("browse-folder-row")).toHaveLength(3);
    expect(screen.getAllByTestId("browse-folder-row")[1].textContent).toContain("core/payment-flow");
    expect(screen.getAllByTestId("browse-folder-row")[2].textContent).toContain(
      "support/refund-flow"
    );
    expect(screen.getAllByTestId("browse-folder-icon")).toHaveLength(3);
    expect(screen.getByTestId("theme-toggle").textContent).toContain("Dark mode");

    await fireEvent.click(screen.getByTestId("theme-toggle"));

    expect(screen.getByTestId("theme-root").getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("diagram-tour-theme")).toBe("dark");
  });

  it("toggles folder branches open and closed", async () => {
    render(Layout, {
      data: {
        collection: nestedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("browse-trigger"));

    const paymentsFolder = findFolderRow("payments");
    expect(paymentsFolder.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Payment Flow")).toBeNull();

    await expandFolder("payments");

    expect(paymentsFolder.getAttribute("aria-expanded")).toBe("true");

    await expandFolder("core/payment-flow");

    expect(screen.getByText("Payment Flow")).toBeDefined();
    expect(screen.getAllByTestId("browse-tour-icon")).toHaveLength(1);

    await fireEvent.click(paymentsFolder);

    expect(paymentsFolder.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Payment Flow")).toBeNull();
  });

  it("filters tours by text and shows an empty state when there are no matches", async () => {
    render(Layout, {
      data: {
        collection: nestedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("browse-trigger"));
    await fireEvent.input(screen.getByTestId("browse-search-input"), {
      currentTarget: { value: "rfnd" },
      target: { value: "rfnd" }
    });

    expect(screen.getByText("Refund Flow")).toBeDefined();
    expect(screen.queryByText("Payment Flow")).toBeNull();

    await fireEvent.input(screen.getByTestId("browse-search-input"), {
      currentTarget: { value: "missing" },
      target: { value: "missing" }
    });

    expect((await screen.findByTestId("browse-empty-state")).textContent).toContain(
      'No tours match "missing".'
    );
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

  it("surfaces skipped-tour diagnostics in a topbar popover", async () => {
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

    expect(screen.getByTestId("diagnostics-count").textContent).toBe("1");
    await fireEvent.click(screen.getByTestId("diagnostics-trigger"));

    expect(
      (await screen.findByTestId("diagnostics-summary")).textContent?.replace(/\s+/g, " ").trim()
    ).toBe(
      "1 invalid tour was omitted from the collection."
    );
    expect(screen.getByText("broken.tour.yaml")).toBeDefined();
    expect(screen.getByText("broken")).toBeDefined();
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

  it("opens browse from the current tour toggle event", async () => {
    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    window.dispatchEvent(new CustomEvent("diagram-tour-toggle-browse"));

    expect(await screen.findByTestId("browse-panel")).toBeDefined();
  });
});
