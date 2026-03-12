import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import TourPlayer from "../src/lib/tour-player.svelte";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

const {
  applyFocusStateMock,
  gotoMock,
  renderMermaidDiagramMock,
  toastErrorMock
} = vi.hoisted(() => ({
  applyFocusStateMock: vi.fn(applyFocusStateForTest),
  gotoMock: vi.fn(() => Promise.resolve()),
  renderMermaidDiagramMock: vi.fn(renderDiagramForTest),
  toastErrorMock: vi.fn()
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock
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

describe("tour-player.svelte", () => {
  it("renders the selected tour, starts on step one, and respects boundaries", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    expect(await screen.findByRole("heading", { name: "Payment Flow" })).toBeDefined();
    expect(screen.getByTestId("step-text").textContent).toContain(
      "public edge of the checkout system"
    );
    expect(readButtonState("previous-button")).toBe(true);

    await fireEvent.click(screen.getByTestId("next-button"));

    expect(screen.getByTestId("step-text").textContent).toContain(
      "protects the payment path"
    );
    expect(readButtonState("previous-button")).toBe(false);
    expect(readButtonState("next-button")).toBe(false);
  });

  it("applies focused and dimmed hooks for the active step", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
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

    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    expect((await screen.findByTestId("diagram-error")).textContent).toContain(
      "Failed to render Mermaid diagram."
    );
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to render Mermaid diagram.");
  });

  it("places the step card above the diagram", async () => {
    const { container } = render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    await screen.findByTestId("step-text");

    const stepPanel = container.querySelector(".step-panel");
    const diagramStage = container.querySelector(".diagram-stage");

    expect(stepPanel).not.toBeNull();
    expect(diagramStage).not.toBeNull();
    expect(stepPanel?.compareDocumentPosition(diagramStage as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("starts from the deep-linked step and updates the URL when navigating", async () => {
    render(TourPlayer, {
      initialStepIndex: 2,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    expect((await screen.findByTestId("step-text")).textContent).toContain(
      "merchant-side transaction state"
    );

    await fireEvent.click(screen.getByTestId("next-button"));

    expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=4", {
      invalidateAll: false,
      keepFocus: true,
      noScroll: true
    });

    await fireEvent.click(screen.getByTestId("previous-button"));

    expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=3", {
      invalidateAll: false,
      keepFocus: true,
      noScroll: true
    });
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
