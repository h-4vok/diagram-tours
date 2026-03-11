import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import Page from "../src/routes/+page.svelte";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

const { applyFocusStateMock, renderMermaidDiagramMock, toastErrorMock } = vi.hoisted(() => ({
  applyFocusStateMock: vi.fn(applyFocusStateForTest),
  renderMermaidDiagramMock: vi.fn(renderDiagramForTest),
  toastErrorMock: vi.fn()
}));

vi.mock("../src/lib/mermaid-diagram", () => ({
  renderMermaidDiagram: renderMermaidDiagramMock,
  applyFocusState: applyFocusStateMock,
  getMermaidErrorMessage: () => "Failed to render Mermaid diagram."
}));

vi.mock("svelte-sonner", () => ({
  toast: {
    error: toastErrorMock
  }
}));

describe("+page.svelte", () => {
  it("renders the example tour, starts on step one, and respects boundaries", async () => {
    render(Page, {
      data: {
        tour: resolvedPaymentFlowTour
      }
    });

    expect(await screen.findByRole("heading", { name: "Payment Flow" })).toBeDefined();
    expect(screen.getByTestId("step-text").textContent).toContain(
      "The API Gateway is the public entry point"
    );
    expect(readButtonState("previous-button")).toBe(true);

    await fireEvent.click(screen.getByTestId("next-button"));

    expect(screen.getByTestId("step-text").textContent).toContain(
      "The Validation Service checks the request"
    );
    expect(readButtonState("previous-button")).toBe(false);
    expect(readButtonState("next-button")).toBe(false);

    await fireEvent.click(screen.getByTestId("next-button"));
    await fireEvent.click(screen.getByTestId("next-button"));

    expect(readButtonState("next-button")).toBe(true);

    await fireEvent.click(screen.getByTestId("previous-button"));

    expect(screen.getByTestId("step-text").textContent).toContain(
      "The Payment Service coordinates the transaction"
    );
  });

  it("applies focused and dimmed hooks for the active step", async () => {
    render(Page, {
      data: {
        tour: resolvedPaymentFlowTour
      }
    });

    const diagramContainer = await screen.findByTestId("diagram-container");

    expect(readFocusState(diagramContainer, "api_gateway")).toBe("focused");
    expect(readFocusState(diagramContainer, "validation_service")).toBe("dimmed");

    await fireEvent.click(screen.getByTestId("next-button"));

    expect(readFocusState(diagramContainer, "validation_service")).toBe("focused");
    expect(readFocusState(diagramContainer, "api_gateway")).toBe("dimmed");
  });

  it("shows a fallback message and toast when the diagram render fails", async () => {
    renderMermaidDiagramMock.mockRejectedValueOnce(new Error("render failed"));

    render(Page, {
      data: {
        tour: resolvedPaymentFlowTour
      }
    });

    expect((await screen.findByTestId("diagram-error")).textContent).toContain(
      "Failed to render Mermaid diagram."
    );
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to render Mermaid diagram.");
  });
});

function renderDiagramForTest(input: {
  container: HTMLElement;
  diagram: typeof resolvedPaymentFlowTour.diagram;
}): Promise<void> {
  input.container.innerHTML = input.diagram.nodes
    .map((node) => `<div data-node-id="${node.id}" data-node-label="${node.label}"></div>`)
    .join("");

  return Promise.resolve();
}

function applyFocusStateForTest(input: {
  container: HTMLElement;
  focusedNodeIds: string[];
}): void {
  const focusedNodeIds = new Set(input.focusedNodeIds);

  input.container.querySelectorAll<HTMLElement>("[data-node-id]").forEach((element) => {
    setFocusStateForTest({
      element,
      isEmptyFocus: focusedNodeIds.size === 0,
      isFocused: focusedNodeIds.has(element.dataset.nodeId ?? "")
    });
  });
}

function setFocusStateForTest(input: {
  element: HTMLElement;
  isEmptyFocus: boolean;
  isFocused: boolean;
}): void {
  if (input.isEmptyFocus) {
    input.element.removeAttribute("data-focus-state");

    return;
  }

  input.element.dataset.focusState = input.isFocused ? "focused" : "dimmed";
}

function readButtonState(testId: string): boolean {
  return (screen.getByTestId(testId) as HTMLButtonElement).disabled;
}

function readFocusState(container: HTMLElement, nodeId: string): string | null {
  return container
    .querySelector(`[data-node-id="${nodeId}"]`)
    ?.getAttribute("data-focus-state") ?? null;
}
