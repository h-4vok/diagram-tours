import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE } from "../src/lib/interaction-context";
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
    document.documentElement.removeAttribute(ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE);
    setWindowWidth(1280);
    mockElementAnimate();
  });

  it("renders the selected tour, starts on step one, and respects boundaries", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect(await screen.findByTestId("player-canvas")).toBeDefined();
    expect(screen.getByTestId("step-text").textContent).toContain(
      "public edge of the checkout system",
    );
    expect(readButtonState("previous-button")).toBe(true);

    await fireEvent.click(screen.getByTestId("next-button"));

    expect(readLastStepTextElement(screen.getAllByTestId("step-text"))?.textContent).toContain(
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
  });

  it("renders inline code references inside the teleprompter text", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: {
        ...resolvedPaymentFlowTour,
        steps: [
          {
            ...resolvedPaymentFlowTour.steps[0],
            text: "Focus `API Gateway` before continuing."
          },
          ...resolvedPaymentFlowTour.steps.slice(1)
        ]
      }
    });

    expect(await screen.findByText("API Gateway", { selector: "code" })).toBeDefined();
    expect(screen.getAllByTestId("timeline-step-button")).toHaveLength(4);
  });

  it("renders the minimap on desktop, shows focused nodes, and groups controls in a camera cluster", async () => {
    const { container } = render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect(await screen.findByTestId("minimap-shell")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId("minimap-surface")).toBeDefined();
      expect(screen.getAllByTestId("minimap-edge-marker").length).toBeGreaterThan(0);
      expect(screen.getAllByTestId("minimap-node-marker")).toHaveLength(6);
      expect(screen.getAllByTestId("minimap-focus-marker")).toHaveLength(1);
    });

    const cameraCluster = container.querySelector(
      '[data-testid="camera-control-cluster"]',
    );

    expect(cameraCluster).not.toBeNull();
    expect((cameraCluster as HTMLElement).firstElementChild).toBe(
      screen.getByTestId("camera-control-panel"),
    );
    expect(screen.getByTestId("camera-control-panel").firstElementChild).toBe(
      screen.getByTestId("minimap-shell"),
    );
    expect(screen.getByTestId("camera-control-panel").lastElementChild).toBe(
      screen.getByTestId("viewport-toolbar"),
    );
    expect(screen.getByTestId("zoom-one-hundred-button")).toBeDefined();
    expect(
      container.querySelector('[data-testid="step-overlay"]'),
    ).not.toBeNull();
  });

  it("clicking the minimap surface recenters the diagram viewport", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const minimapSurface = await screen.findByTestId("minimap-surface");

    expect(screen.getByTestId("minimap-viewport-rect")).toBeDefined();
    mockElementRect(minimapSurface, { height: 154, left: 0, top: 0, width: 220 });
    diagramContainer.scrollLeft = 180;
    diagramContainer.scrollTop = 120;

    await fireEvent.pointerDown(minimapSurface, {
      button: 0,
      clientX: 10,
      clientY: 10,
    });

    await waitFor(() => {
      expect(diagramContainer.scrollLeft).toBe(0);
      expect(diagramContainer.scrollTop).toBe(0);
    });
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

  it("zooms the rendered svg, keeps the visible percentage separate, and enables the explicit 100 percent reset", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const svg = (await screen.findByTestId("diagram-container")).querySelector(
      "svg",
    );

    expect(svg?.getAttribute("width")).toBe("960");
    expect(screen.getByTestId("zoom-value").textContent).toContain(
      "100%",
    );
    expect(
      Array.from(screen.getByTestId("viewport-toolbar").children).map(
        (element) => element.getAttribute("data-testid") ?? element.textContent?.trim(),
      ),
    ).toEqual(["zoom-primary-controls", "zoom-value", "zoom-one-hundred-button"]);
    expect(screen.getByTestId("zoom-primary-controls").textContent?.replace(/\s+/gu, "")).toBe(
      "-Fit+",
    );
    expect(
      (screen.getByTestId("zoom-one-hundred-button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await fireEvent.click(screen.getByTestId("zoom-in-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("1200");
      expect(svg?.getAttribute("height")).toBe("800");
      expect(screen.getByTestId("zoom-value").textContent).toContain(
        "125%",
      );
      expect(screen.getByTestId("zoom-one-hundred-button").textContent).toBe(
        "100%",
      );
      expect(
        (screen.getByTestId("zoom-one-hundred-button") as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    await fireEvent.click(screen.getByTestId("zoom-out-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("960");
      expect(svg?.getAttribute("height")).toBe("640");
      expect(screen.getByTestId("zoom-value").textContent).toContain(
        "100%",
      );
    });
  });

  it("keeps fit stable after a manual zoom change", async () => {
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
      expect(svg?.getAttribute("width")).toBe("720");
      expect(svg?.getAttribute("height")).toBe("480");
      expect(screen.getByTestId("zoom-value").textContent).toContain(
        "75%",
      );
    });

    const fittedScrollLeft = diagramContainer.scrollLeft;
    const fittedScrollTop = diagramContainer.scrollTop;

    await fireEvent.click(screen.getByTestId("zoom-in-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("960");
      expect(screen.getByTestId("zoom-value").textContent).toContain("100%");
    });

    await fireEvent.click(screen.getByTestId("zoom-fit-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("720");
      expect(svg?.getAttribute("height")).toBe("480");
      expect(diagramContainer.scrollLeft).toBe(fittedScrollLeft);
      expect(diagramContainer.scrollTop).toBe(fittedScrollTop);
    });
  });

  it("resets back to 100 percent and recenters on the diagram content", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    const diagramContainer = await screen.findByTestId("diagram-container");
    const svg = diagramContainer.querySelector("svg");

    await fireEvent.click(screen.getByTestId("zoom-fit-button"));
    await fireEvent.click(screen.getByTestId("zoom-one-hundred-button"));

    await waitFor(() => {
      expect(svg?.getAttribute("width")).toBe("960");
      expect(svg?.getAttribute("height")).toBe("640");
      expect(screen.getByTestId("zoom-value").textContent).toContain("100%");
      expect(diagramContainer.scrollLeft).toBe(300);
      expect(diagramContainer.scrollTop).toBe(234);
    });
  });

  it("navigates between teleprompter steps and updates the URL", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour,
    });

    expect(
      readLastStepTextElement(await screen.findAllByTestId("step-text"))?.textContent,
    ).toContain(
      "public edge of the checkout system",
    );
    expect(screen.getAllByText("Step 1 of 4")[0]).toBeDefined();

    await fireEvent.click(screen.getByTestId("next-button"));
    await fireEvent.click(screen.getByTestId("next-button"));

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=3", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true,
      });
    });
  });

  it("allows arrow navigation when diagram is the active interaction context", async () => {
    document.documentElement.setAttribute(ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE, "diagram");

    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    await screen.findByTestId("step-text");
    await fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=2", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true
      });
    });
  });

  it("blocks arrow navigation when browse is the active interaction context", async () => {
    document.documentElement.setAttribute(ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE, "browse");

    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    await screen.findByTestId("step-text");
    await fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("blocks arrow navigation when diagnostics is the active interaction context", async () => {
    document.documentElement.setAttribute(ACTIVE_INTERACTION_CONTEXT_ATTRIBUTE, "diagnostics");

    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    await screen.findByTestId("step-text");
    await fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(gotoMock).not.toHaveBeenCalled();
  });

  it("falls back to diagram behavior when context marker is missing", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: resolvedPaymentFlowTour
    });

    await screen.findByTestId("step-text");
    await fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      expect(gotoMock).toHaveBeenLastCalledWith("/payment-flow?step=2", {
        invalidateAll: false,
        keepFocus: true,
        noScroll: true
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

    expect(readLastStepTextElement(screen.getAllByTestId("step-text"))?.textContent).toContain(
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
  it("renders literal br markers in step text as visible line breaks instead of raw markup", async () => {
    render(TourPlayer, {
      initialStepIndex: 0,
      selectedSlug: "payment-flow",
      tour: {
        ...resolvedPaymentFlowTour,
        steps: [
          {
            ...resolvedPaymentFlowTour.steps[0],
            text: "Line one<br/>Line two"
          },
          ...resolvedPaymentFlowTour.steps.slice(1)
        ]
      }
    });

    const stepText = await screen.findByTestId("step-text");

    expect(stepText.innerHTML).toContain("<br>");
    expect(stepText.textContent).toContain("Line one");
    expect(stepText.textContent).toContain("Line two");
    expect(stepText.textContent).not.toContain("<br");
  });
});

function renderDiagramForTest(input: {
  container: HTMLElement;
  diagram: typeof resolvedPaymentFlowTour.diagram;
}): Promise<void> {
  const parent = input.container.parentElement as HTMLElement;
  const positions = createNodePositions();
  const svgOrigin = { left: 180, top: 140 };

  input.container.innerHTML = `<svg data-testid="diagram-svg" width="960" height="640" data-intrinsic-width="960" data-intrinsic-height="640">${input.diagram.elements
    .map(
      (node) => `
        <g data-node-id="${node.id}" data-node-label="${node.label}">
          <rect width="120" height="72"></rect>
          <text>${node.label}</text>
        </g>
      `,
    )
    .join("")}<path class="flowchart-link"></path></svg>`;

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
    createDomRect({
      height: readRenderedSvgDimension(svg, "height"),
      left: svgOrigin.left,
      top: svgOrigin.top,
      width: readRenderedSvgDimension(svg, "width"),
    });

  input.container
    .querySelectorAll<SVGGElement>("[data-node-id]")
    .forEach((element) => {
      const nodeId = element.dataset.nodeId ?? "";
      const rect = positions[nodeId];

      element.getBoundingClientRect = () =>
        createScaledNodeRect(rect, readRenderedZoomScale(svg), svgOrigin);
      Object.assign(element, {
        getBBox() {
          return createSvgRect(rect);
        },
      });
    });

  const connector = input.container.querySelector(".flowchart-link") as SVGElement;
  const connectorPoints = [
    { x: 108, y: 188 },
    { x: 200, y: 188 },
    { x: 400, y: 192 }
  ];

  Object.assign(connector, {
    getPointAtLength(distance: number) {
      return interpolateConnectorPoint(connectorPoints, distance);
    },
    getTotalLength() {
      return readConnectorLength(connectorPoints);
    }
  });

  return Promise.resolve();
}

function createNodePositions(): Record<string, RectInput> {
  return {
    api_gateway: { height: 82, left: 220, top: 292, width: 122 },
    client: { height: 76, left: 40, top: 294, width: 118 },
    payment_provider: { height: 84, left: 690, top: 292, width: 136 },
    payment_service: { height: 84, left: 540, top: 292, width: 126 },
    response: { height: 76, left: 812, top: 294, width: 108 },
    validation_service: { height: 84, left: 370, top: 292, width: 142 },
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

function interpolateConnectorPoint(
  points: Array<{ x: number; y: number }>,
  distance: number
): { x: number; y: number } {
  const lengths = readConnectorLengths(points);

  if (isConnectorBoundaryDistance(lengths, distance)) {
    return readConnectorBoundaryPoint(points, distance);
  }

  return interpolateConnectorSegment(points, lengths, distance);
}

function readConnectorLength(points: Array<{ x: number; y: number }>): number {
  return readConnectorLengths(points).at(-1) ?? 0;
}

function readConnectorLengths(points: Array<{ x: number; y: number }>): number[] {
  return points.slice(1).reduce<number[]>(
    (accumulator, point, index) => [
      ...accumulator,
      (accumulator.at(-1) ?? 0) + Math.hypot(point.x - points[index].x, point.y - points[index].y)
    ],
    [0]
  );
}

function readConnectorBoundaryPoint(
  points: Array<{ x: number; y: number }>,
  distance: number
): { x: number; y: number } {
  return distance <= 0 ? points[0] : (points.at(-1) as { x: number; y: number });
}

function isConnectorBoundaryDistance(lengths: number[], distance: number): boolean {
  const totalLength = lengths.at(-1) ?? 0;

  return distance <= 0 || distance >= totalLength;
}

function interpolateConnectorSegment(
  points: Array<{ x: number; y: number }>,
  lengths: number[],
  distance: number
): { x: number; y: number } {
  const segmentIndex = Math.max(0, lengths.findIndex((value) => value >= distance) - 1);
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const offset = distance - lengths[segmentIndex];
  const segmentLength = lengths[segmentIndex + 1] - lengths[segmentIndex];
  const ratio = segmentLength === 0 ? 0 : offset / segmentLength;

  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio
  };
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

function readLastStepTextElement(elements: HTMLElement[]): HTMLElement | undefined {
  return elements.at(-1);
}

function mockElementAnimate(): void {
  Element.prototype.animate ??= vi.fn(() => ({
    cancel: vi.fn(),
    finished: Promise.resolve(),
    pause: vi.fn(),
    play: vi.fn()
  })) as unknown as typeof Element.prototype.animate;
}

interface RectInput {
  height: number;
  left: number;
  top: number;
  width: number;
}

function createScaledNodeRect(
  input: RectInput,
  zoomScale: number,
  svgOrigin: { left: number; top: number },
): DOMRect {
  return createDomRect({
    height: input.height * zoomScale,
    left: svgOrigin.left + input.left * zoomScale,
    top: svgOrigin.top + input.top * zoomScale,
    width: input.width * zoomScale,
  });
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

function createSvgRect(input: RectInput): SVGRect {
  return {
    height: input.height,
    width: input.width,
    x: input.left,
    y: input.top,
  } as SVGRect;
}

function mockElementRect(element: Element, input: RectInput): void {
  element.getBoundingClientRect = () => createDomRect(input);
}

function readRenderedZoomScale(svg: SVGSVGElement): number {
  return Number(svg.dataset.zoomScale ?? 1);
}

function readRenderedSvgDimension(
  svg: SVGSVGElement,
  axis: "height" | "width",
): number {
  return Number(svg.getAttribute(axis));
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
