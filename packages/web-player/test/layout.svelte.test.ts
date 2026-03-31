import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { gotoMock, pageState } = vi.hoisted(() => ({
  gotoMock: vi.fn(() => Promise.resolve()),
  pageState: {
    url: new URL("https://example.test/payment-flow")
  }
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock
}));

vi.mock("$app/state", () => ({
  page: pageState
}));

import Layout from "../src/routes/+layout.svelte";
import {
  FAVORITES_STORAGE_KEY
} from "../src/lib/browse-favorites";
import { RECENT_STORAGE_KEY } from "../src/lib/browse-recents";
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

describe("+layout.svelte", () => {
  beforeEach(() => {
    gotoMock.mockClear();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    pageState.url = new URL("https://example.test/payment-flow");
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(() => Promise.resolve())
      }
    });
  });

  it("renders the top bar and a single command-palette trigger", async () => {
    render(Layout, {
      data: {
        collection: singleTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    expect(await screen.findByText("diagram-tours")).toBeDefined();
    expect(screen.getByTestId("topbar-left")).toBeDefined();
    expect(screen.getByTestId("topbar-center")).toBeDefined();
    expect(screen.getByTestId("topbar-right")).toBeDefined();
    expect(screen.getByTestId("search-hint-trigger")).toBeDefined();
    expect(screen.queryByTestId("browse-trigger")).toBeNull();
    expect(screen.queryByTestId("browse-panel")).toBeNull();
  });

  it("opens a centered command palette from the search hint and keeps theme toggle available", async () => {
    render(Layout, {
      data: {
        collection: nestedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe(
      "https://github.com/h-4vok/diagram-tours"
    );

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));

    expect(await screen.findByTestId("browse-panel")).toBeDefined();
    expect(screen.getByTestId("browse-search-input")).toBeDefined();
    expect(screen.getAllByTestId("browse-tour-row")).toHaveLength(1);
    expect(screen.getByTestId("browse-recent-row")).toBeDefined();
    expect(screen.getByText("All Diagrams")).toBeDefined();
    expect(screen.queryByTestId("browse-folder-row")).toBeNull();
    expect(screen.getByTestId("theme-toggle").textContent).toContain("Light mode");

    await fireEvent.click(screen.getByTestId("theme-toggle"));

    expect(screen.getByTestId("theme-root").getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("diagram-tour-theme")).toBe("light");
  });

  it("shows favorites and recents as separate sections above all diagrams", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, '["refund-flow"]');
    window.localStorage.setItem(RECENT_STORAGE_KEY, '["payment-flow"]');

    render(Layout, {
      data: {
        collection: nestedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));

    expect((await screen.findByTestId("browse-favorites")).textContent).toContain("Favorites");
    expect(screen.getByText("Recent")).toBeDefined();
    expect(screen.getByTestId("browse-favorite-row").textContent).toContain("Refund Flow");
    expect(screen.getByTestId("browse-recent-row").textContent).toContain("Payment Flow");
  });

  it("filters tours by text and shows an empty state when there are no matches", async () => {
    render(Layout, {
      data: {
        collection: nestedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));
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

  it("pins favorites in local storage from the command palette", async () => {
    render(Layout, {
      data: {
        collection: nestedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));
    const refundRow = screen
      .getAllByTestId("browse-tour-row")
      .find((element) => element.textContent?.includes("Refund Flow"));

    expect(refundRow).toBeDefined();

    await fireEvent.click(within(refundRow!).getByTestId("favorite-toggle"));

    expect(window.localStorage.getItem(FAVORITES_STORAGE_KEY)).toBe('["refund-flow"]');
    expect((await screen.findByTestId("browse-favorites")).textContent).toContain("Refund Flow");
  });

  it("opens the command palette from Ctrl/Cmd+K and slash, but ignores slash while typing", async () => {
    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    const outsideInput = document.createElement("input");
    document.body.appendChild(outsideInput);
    outsideInput.focus();

    await fireEvent.keyDown(window, { key: "/" });
    expect(screen.queryByTestId("browse-panel")).toBeNull();

    document.body.removeChild(outsideInput);
    await fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByTestId("browse-panel")).toBeDefined();

    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByTestId("browse-panel")).toBeDefined();

    await fireEvent.keyDown(window, { key: "Escape" });
    await fireEvent.keyDown(window, { key: "/" });
    expect(await screen.findByTestId("browse-panel")).toBeDefined();
  });

  it("tracks the active row from the current route, arrow keys, and enter", async () => {
    pageState.url = new URL("https://example.test/refund-flow");

    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));

    const refundOption = within(
      screen.getAllByTestId("browse-recent-row").find((element) => element.dataset.tourSlug === "refund-flow")!
    ).getByRole("option");

    expect(refundOption.getAttribute("aria-selected")).toBe("true");

    await fireEvent.keyDown(window, { key: "ArrowDown" });
    await fireEvent.keyDown(window, { key: "Enter" });

    expect(gotoMock).toHaveBeenCalledWith("/payment-flow");
  });

  it("closes the command palette with escape and the backdrop", async () => {
    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));
    expect(await screen.findByTestId("browse-panel")).toBeDefined();

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("browse-panel")).toBeNull();

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));
    await new Promise((resolve) => setTimeout(resolve, 160));
    await fireEvent.click(screen.getByTestId("browse-backdrop"));
    expect(screen.queryByTestId("browse-panel")).toBeNull();
  });

  it("keeps the command palette open when reopened after a route change settles", async () => {
    pageState.url = new URL("https://example.test/payment-flow");

    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    pageState.url = new URL("https://example.test/refund-flow");
    await fireEvent.click(screen.getByTestId("search-hint-trigger"));

    expect(await screen.findByTestId("browse-panel")).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.getByTestId("browse-panel")).toBeDefined();
  });

  it("shows the preview notice for single-file author previews", async () => {
    render(Layout, {
      data: {
        collection: singleTourCollection,
        sourceTarget: {
          kind: "file" as const,
          label: "checkout-payment-flow.tour.yaml",
          path: "/repo/examples/checkout-payment-flow.tour.yaml"
        }
      }
    });

    await fireEvent.click(screen.getByTestId("search-hint-trigger"));

    expect((await screen.findByTestId("preview-target-notice")).textContent).toContain(
      "Previewing checkout-payment-flow.tour.yaml"
    );
  });

  it("surfaces skipped-tour diagnostics in a structured topbar popover", async () => {
    render(Layout, {
      data: {
        collection: {
          ...resolvedTourCollection,
          skipped: [
            {
              sourcePath: "broken.tour.yaml",
              error: "step 1 focus references unknown Mermaid node id 'ghost'"
            }
          ]
        },
        sourceTarget: directorySourceTarget
      }
    });

    expect(screen.getByTestId("diagnostics-count").textContent).toBe("1");
    await fireEvent.click(screen.getByTestId("diagnostics-trigger"));

    expect((await screen.findByTestId("diagnostics-summary")).textContent).toContain(
      "1 skipped tour in current workspace."
    );
    expect(screen.getByTestId("diagnostics-panel-count").textContent).toBe("1");

    const diagnosticsItem = await screen.findByTestId("diagnostics-item");

    expect(diagnosticsItem.textContent).toContain("broken.tour.yaml");
    expect(diagnosticsItem.textContent).toContain("broken");
    expect(within(diagnosticsItem).getByText("ghost")).toBeDefined();
  });

  it("shows a zero state when no diagnostics exist", async () => {
    render(Layout, {
      data: {
        collection: resolvedTourCollection,
        sourceTarget: directorySourceTarget
      }
    });

    expect(screen.getByTestId("diagnostics-count").textContent).toBe("0");
    await fireEvent.click(screen.getByTestId("diagnostics-trigger"));

    expect(await screen.findByTestId("diagnostics-empty-state")).toBeDefined();
    expect(screen.getByText("All clear")).toBeDefined();
  });
});
