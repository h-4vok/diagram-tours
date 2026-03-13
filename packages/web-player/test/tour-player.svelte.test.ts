import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TourPlayer from "../src/lib/tour-player.svelte";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

const {
  applyFocusStateMock,
  focusDiagramViewportMock,
  gotoMock,
  renderMermaidDiagramMock,
  toastErrorMock
} = vi.hoisted(() => ({
  applyFocusStateMock: vi.fn(applyFocusStateForTest),
  focusDiagramViewportMock: vi.fn(),
  gotoMock: vi.fn(() => Promise.resolve()),
  renderMermaidDiagramMock: vi.fn(renderDiagramForTest),
  toastErrorMock: vi.fn()
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock
}));

vi.mock("../src/lib/diagram-viewport", () => ({
  focusDiagramViewport: focusDiagramViewportMock
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    await waitFor(() => {
      expect(readFocusState(diagramContainer, "api_gateway")).toBe("focused");
      expect(readFocusState(diagramContainer, "validation_service")).toBe("dimmed");
    });

    await fireEvent.click(screen.getByTestId("next-button"));

    await waitFor(() => {
      expect(readFocusState(diagramContainer, "validation_service")).toBe("focused");
      expect(readFocusState(diagramContainer, "api_gateway")).toBe("dimmed");
      expect(focusDiagramViewportMock).toHaveBeenCalled();
    });
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

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=4", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true
      });
    });

    await fireEvent.click(screen.getByTestId("previous-button"));

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=3", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true
      });
    });
  });

  it("syncs a deep-linked step change without redrawing the Mermaid diagram", async () => {
    const view = render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    expect((await screen.findByTestId("step-text")).textContent).toContain(
      "public edge of the checkout system"
    );
    expect(renderMermaidDiagramMock).toHaveBeenCalledTimes(1);

    await view.rerender({
      initialStepIndex: 2,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    expect(screen.getByTestId("step-text").textContent).toContain(
      "merchant-side transaction state"
    );
    expect(renderMermaidDiagramMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(focusDiagramViewportMock).toHaveBeenCalled();
    });
  });

  it("centers the initial deep-linked step through the stage-aware viewport hook", async () => {
    render(TourPlayer, {
      initialStepIndex: 2,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const diagramStage = screen.getByTestId("diagram-stage-inner");

    expect(screen.getByTestId("step-text").textContent).toContain(
      "merchant-side transaction state"
    );
    await waitFor(() => {
      expect(focusDiagramViewportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          container: diagramContainer,
          content: diagramStage,
          focusGroup: expect.objectContaining({
            mode: "group",
            size: 2
          })
        })
      );
    });
  });

  it("keeps controls and the diagram visible when the step text is long", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: {
        ...resolvedPaymentFlowTour,
        steps: [
          {
            ...resolvedPaymentFlowTour.steps[0],
            text: `${resolvedPaymentFlowTour.steps[0].text} ${resolvedPaymentFlowTour.steps[0].text} ${resolvedPaymentFlowTour.steps[0].text}`
          },
          ...resolvedPaymentFlowTour.steps.slice(1)
        ]
      }
    });

    expect(await screen.findByTestId("step-text")).toBeDefined();
    expect(screen.getByTestId("previous-button")).toBeDefined();
    expect(screen.getByTestId("next-button")).toBeDefined();
    expect(screen.getByTestId("diagram-container")).toBeDefined();
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
  focusGroup: { nodeIds: string[] };
}): void {
  const focusedNodeIds = new Set(input.focusGroup.nodeIds);

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
