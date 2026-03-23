import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TourPlayer from "../src/lib/tour-player.svelte";
import { resolvedPaymentFlowTour } from "./fixtures/resolved-tour";

const {
  applyFocusStateMock,
  focusDiagramViewportMock,
  gotoMock,
  renderMermaidDiagramMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  applyFocusStateMock: vi.fn(applyFocusStateForTest),
  focusDiagramViewportMock: vi.fn(),
  gotoMock: vi.fn(() => Promise.resolve()),
  renderMermaidDiagramMock: vi.fn(renderDiagramForTest),
  toastErrorMock: vi.fn(),
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock,
}));

vi.mock("../src/lib/diagram-viewport", async (importOriginal) => {
  const actual = Object(await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    focusDiagramViewport: focusDiagramViewportMock,
  };
});

vi.mock("../src/lib/mermaid-diagram", () => ({
  renderMermaidDiagram: renderMermaidDiagramMock,
  applyFocusState: applyFocusStateMock,
  getMermaidErrorMessage: () => "Failed to render Mermaid diagram.",
}));

vi.mock("svelte-sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

describe("tour-player.svelte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setWindowWidth(1280);
  });

  it("renders the selected tour, starts on step one, and respects boundaries", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect(await screen.findByTestId("player-canvas")).toBeDefined();
    expect(screen.getByTestId("tour-identity").textContent).toContain(
      "Payment Flow",
    );
    expect(screen.getByTestId("step-text").textContent).toContain(
      "public edge of the checkout system",
    );
    expect(readButtonState("previous-button")).toBe(true);

    await fireEvent.click(screen.getByTestId("next-button"));

    expect(screen.getByTestId("step-text").textContent).toContain(
      "protects the payment path",
    );
    expect(readButtonState("previous-button")).toBe(false);
    expect(readButtonState("next-button")).toBe(false);
  });

  it("applies focused and dimmed hooks for the active step", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");

    await waitFor(() => {
      expect(readFocusState(diagramContainer, "api_gateway")).toBe("focused");
      expect(readFocusState(diagramContainer, "validation_service")).toBe(
        "dimmed",
      );
    });

    await fireEvent.click(screen.getByTestId("next-button"));

    await waitFor(() => {
      expect(readFocusState(diagramContainer, "validation_service")).toBe(
        "focused",
      );
      expect(readFocusState(diagramContainer, "api_gateway")).toBe("dimmed");
      expect(focusDiagramViewportMock).toHaveBeenCalled();
    });
  });

  it("shows a fallback message and toast when the diagram render fails", async () => {
    renderMermaidDiagramMock.mockRejectedValueOnce(new Error("render failed"));

    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect((await screen.findByTestId("diagram-error")).textContent).toContain(
      "Failed to render Mermaid diagram.",
    );
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Failed to render Mermaid diagram.",
    );
  });

  it("renders the step card as an overlay inside the diagram shell", async () => {
    const { container } = render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    await screen.findByTestId("step-text");

    const stepPanel = container.querySelector('[data-testid="step-overlay"]');
    const diagramShell = container.querySelector(
      '[data-testid="diagram-shell"]',
    );

    expect(stepPanel).not.toBeNull();
    expect(diagramShell).not.toBeNull();
    expect(diagramShell?.contains(stepPanel as Node)).toBe(true);
    expect(
      container.querySelector('[data-testid="tour-identity"]'),
    ).not.toBeNull();
  });

  it("renders the minimap on desktop, shows focused nodes, and stacks it below the step overlay", async () => {
    const { container } = render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect(await screen.findByTestId("minimap-shell")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId("minimap-surface")).toBeDefined();
      expect(screen.getAllByTestId("minimap-node-marker")).toHaveLength(6);
      expect(screen.getAllByTestId("minimap-focus-marker")).toHaveLength(1);
    });

    const overlayStack = container.querySelector(
      '[data-testid="canvas-overlay-stack"]',
    );

    expect(overlayStack).not.toBeNull();
    expect((overlayStack as HTMLElement).firstElementChild).toBe(
      screen.getByTestId("viewport-toolbar"),
    );
    expect((overlayStack as HTMLElement).children[1]).toBe(
      screen.getByTestId("step-overlay"),
    );
    expect((overlayStack as HTMLElement).lastElementChild).toBe(
      screen.getByTestId("minimap-shell"),
    );
  });

  it("hides the minimap automatically on small screens", async () => {
    setWindowWidth(640);

    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    await screen.findByTestId("step-text");

    expect(screen.queryByTestId("minimap-shell")).toBeNull();
  });

  it("restores the persisted collapsed minimap state and can be reopened", async () => {
    window.localStorage.setItem("diagram-tour:minimap-collapsed", "true");

    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect(await screen.findByTestId("minimap-shell")).toBeDefined();
    expect(screen.queryByTestId("minimap-surface")).toBeNull();
    expect(
      screen.getByTestId("minimap-toggle").getAttribute("aria-expanded"),
    ).toBe("false");

    await fireEvent.click(screen.getByTestId("minimap-toggle"));

    expect(
      screen.getByTestId("minimap-toggle").getAttribute("aria-expanded"),
    ).toBe("true");
    await waitFor(() => {
      expect(screen.getByTestId("minimap-surface")).toBeDefined();
    });
    expect(window.localStorage.getItem("diagram-tour:minimap-collapsed")).toBe(
      "false",
    );
  });

  it("zooms the rendered svg and resets back to 100 percent", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const svg = (await screen.findByTestId("diagram-container")).querySelector(
      "svg",
    );

    expect(svg?.getAttribute("width")).toBe("960");
    expect(screen.getByTestId("zoom-reset-button").textContent).toContain(
      "100%",
    );

    await fireEvent.click(screen.getByTestId("zoom-in-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("1200");
      expect(svg?.getAttribute("height")).toBe("800");
      expect(screen.getByTestId("zoom-reset-button").textContent).toContain(
        "125%",
      );
    });

    await fireEvent.click(screen.getByTestId("zoom-reset-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("960");
      expect(svg?.getAttribute("height")).toBe("640");
      expect(screen.getByTestId("zoom-reset-button").textContent).toContain(
        "100%",
      );
    });
  });

  it("fits the current diagram to the viewport when requested", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const svg = diagramContainer.querySelector("svg");

    expect(svg?.getAttribute("width")).toBe("960");

    await fireEvent.click(screen.getByTestId("zoom-fit-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("480");
      expect(svg?.getAttribute("height")).toBe("320");
      expect(screen.getByTestId("zoom-reset-button").textContent).toContain(
        "50%",
      );
    });
  });

  it("renders a clickable numbered timeline and jumps directly to a chosen step", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const timelineButtons = await screen.findAllByTestId(
      "timeline-step-button",
    );

    expect(timelineButtons).toHaveLength(4);
    expect(timelineButtons[0].getAttribute("aria-current")).toBe("step");
    expect(timelineButtons[0].className).toContain(
      "step-timeline__pill--current",
    );

    await fireEvent.click(timelineButtons[2]);

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=3", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true,
      });
    });
  });

  it("navigates directly when a clicked node maps to a single step", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const responseNode = diagramContainer.querySelector(
      '[data-node-id="response"]',
    ) as SVGGElement;
    const responseShape = responseNode.querySelector("rect") as SVGRectElement;

    expect(responseNode.dataset.stepTarget).toBe("true");
    await fireEvent.click(responseShape);

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=4", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true,
      });
    });
  });

  it("opens a chooser when a clicked node maps to multiple steps", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: createMultiMatchTour(),
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const gatewayNode = diagramContainer.querySelector(
      '[data-node-id="api_gateway"]',
    ) as SVGGElement;
    const gatewayShape = gatewayNode.querySelector("rect") as SVGRectElement;

    await fireEvent.click(gatewayShape);

    expect(await screen.findByTestId("node-step-chooser")).toBeDefined();
    expect(screen.getAllByTestId("node-step-choice")).toHaveLength(2);

    await fireEvent.click(screen.getAllByTestId("node-step-choice")[1]);

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=2", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true,
      });
    });
  });

  it("keeps non-navigable nodes inert when clicked", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const clientNode = diagramContainer.querySelector(
      '[data-node-id="client"]',
    ) as SVGGElement;
    const clientShape = clientNode.querySelector("rect") as SVGRectElement;

    expect(clientNode.dataset.stepTarget).toBeUndefined();
    await fireEvent.click(clientShape);

    expect(screen.queryByTestId("node-step-chooser")).toBeNull();
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("ignores auxiliary diagram elements when wiring click targets", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const auxiliaryMarker = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );

    auxiliaryMarker.dataset.diagramElementId = "response";
    auxiliaryMarker.dataset.nodeId = "response";
    auxiliaryMarker.dataset.diagramElementAuxiliary = "true";
    diagramContainer.querySelector("svg")?.append(auxiliaryMarker);

    expect(auxiliaryMarker.getAttribute("data-step-target")).toBeNull();
    await fireEvent.click(auxiliaryMarker);

    expect(screen.queryByTestId("node-step-chooser")).toBeNull();
    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("starts from the deep-linked step and updates the URL when navigating", async () => {
    render(TourPlayer, {
      initialStepIndex: 2,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect((await screen.findByTestId("step-text")).textContent).toContain(
      "merchant-side transaction state",
    );

    await fireEvent.click(screen.getByTestId("next-button"));

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=4", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true,
      });
    });

    await fireEvent.click(screen.getByTestId("previous-button"));

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=3", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true,
      });
    });
  });

  it("syncs a deep-linked step change without redrawing the Mermaid diagram", async () => {
    const view = render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect((await screen.findByTestId("step-text")).textContent).toContain(
      "public edge of the checkout system",
    );
    expect(renderMermaidDiagramMock).toHaveBeenCalledTimes(1);

    await view.rerender({
      initialStepIndex: 2,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect(screen.getByTestId("step-text").textContent).toContain(
      "merchant-side transaction state",
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
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const diagramStage = screen.getByTestId("diagram-stage-inner");

    expect(screen.getByTestId("step-text").textContent).toContain(
      "merchant-side transaction state",
    );
    await waitFor(() => {
      expect(focusDiagramViewportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          container: diagramContainer,
          content: diagramStage,
          focusGroup: expect.objectContaining({
            mode: "group",
            size: 2,
          }),
        }),
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
            text: `${resolvedPaymentFlowTour.steps[0].text} ${resolvedPaymentFlowTour.steps[0].text} ${resolvedPaymentFlowTour.steps[0].text}`,
          },
          ...resolvedPaymentFlowTour.steps.slice(1),
        ],
      },
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
  const parent = input.container.parentElement as HTMLElement;
  const positions = createNodePositions();

  input.container.innerHTML = `<svg data-testid="diagram-svg" width="960" height="640" data-intrinsic-width="960" data-intrinsic-height="640">${input.diagram.elements
    .map(
      (node) => `
        <g data-node-id="${node.id}" data-node-label="${node.label}">
          <rect width="120" height="72"></rect>
          <text>${node.label}</text>
        </g>
      `,
    )
    .join("")}</svg>`;

  Object.defineProperties(parent, {
    clientHeight: { value: 480, writable: true },
    clientWidth: { value: 720, writable: true },
    scrollHeight: { value: 480, writable: true },
    scrollWidth: { value: 720, writable: true },
  });
  Object.defineProperties(input.container, {
    clientHeight: { value: 920, writable: true },
    clientWidth: { value: 1320, writable: true },
    scrollHeight: { value: 920, writable: true },
    scrollWidth: { value: 1320, writable: true },
  });

  parent.scrollLeft = 0;
  parent.scrollTop = 0;
  parent.scrollTo = createScrollToForTest(parent);
  parent.getBoundingClientRect = () =>
    createDomRect({ height: 480, left: 0, top: 0, width: 720 });
  input.container.getBoundingClientRect = () =>
    createDomRect({ height: 920, left: 0, top: 0, width: 1320 });

  const svg = input.container.querySelector("svg") as SVGSVGElement;

  svg.getBoundingClientRect = () =>
    createDomRect({ height: 640, left: 160, top: 140, width: 960 });

  input.container
    .querySelectorAll<SVGGElement>("[data-node-id]")
    .forEach((element) => {
      const nodeId = element.dataset.nodeId ?? "";
      const rect = positions[nodeId];

      element.getBoundingClientRect = () => createDomRect(rect);
    });

  return Promise.resolve();
}

function createNodePositions(): Record<string, RectInput> {
  return {
    api_gateway: { height: 82, left: 360, top: 290, width: 122 },
    client: { height: 76, left: 150, top: 292, width: 118 },
    payment_provider: { height: 84, left: 930, top: 290, width: 136 },
    payment_service: { height: 84, left: 760, top: 290, width: 126 },
    response: { height: 76, left: 1120, top: 292, width: 128 },
    validation_service: { height: 84, left: 560, top: 290, width: 142 },
  };
}

function applyFocusStateForTest(input: {
  container: HTMLElement;
  focusGroup: { nodeIds: string[] };
}): void {
  const focusedNodeIds = new Set(input.focusGroup.nodeIds);

  input.container
    .querySelectorAll<HTMLElement>("[data-node-id]")
    .forEach((element) => {
      setFocusStateForTest({
        element,
        isEmptyFocus: focusedNodeIds.size === 0,
        isFocused: focusedNodeIds.has(element.dataset.nodeId ?? ""),
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
  return (
    container
      .querySelector(`[data-node-id="${nodeId}"]`)
      ?.getAttribute("data-focus-state") ?? null
  );
}

function setWindowWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
}

interface RectInput {
  height: number;
  left: number;
  top: number;
  width: number;
}

function createDomRect(input: RectInput): DOMRect {
  return {
    bottom: input.top + input.height,
    height: input.height,
    left: input.left,
    right: input.left + input.width,
    top: input.top,
    width: input.width,
  } as DOMRect;
}

function createScrollToForTest(parent: HTMLElement): typeof parent.scrollTo {
  return ((options: ScrollToOptions | number, top?: number) => {
    const position = toScrollPositionForTest(parent, options, top);

    parent.scrollLeft = position.scrollLeft;
    parent.scrollTop = position.scrollTop;
  }) as typeof parent.scrollTo;
}

function createMultiMatchTour() {
  return {
    ...resolvedPaymentFlowTour,
    steps: [
      resolvedPaymentFlowTour.steps[0],
      {
        ...resolvedPaymentFlowTour.steps[1],
        focus: [
          ...resolvedPaymentFlowTour.steps[1].focus,
          { id: "api_gateway", kind: "node" as const, label: "API Gateway" },
        ],
      },
      ...resolvedPaymentFlowTour.steps.slice(2),
    ],
  };
}

function toScrollPositionForTest(
  parent: HTMLElement,
  options: ScrollToOptions | number,
  top?: number,
): {
  scrollLeft: number;
  scrollTop: number;
} {
  return typeof options === "number"
    ? toNumericScrollPositionForTest(options, top)
    : toObjectScrollPositionForTest(parent, options);
}

function toNumericScrollPositionForTest(
  left: number,
  top?: number,
): {
  scrollLeft: number;
  scrollTop: number;
} {
  return {
    scrollLeft: left,
    scrollTop: top ?? 0,
  };
}

function toObjectScrollPositionForTest(
  parent: HTMLElement,
  options: ScrollToOptions,
): {
  scrollLeft: number;
  scrollTop: number;
} {
  return {
    scrollLeft: options.left ?? parent.scrollLeft,
    scrollTop: options.top ?? parent.scrollTop,
  };
}

