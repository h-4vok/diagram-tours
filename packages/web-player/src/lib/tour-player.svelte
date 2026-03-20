<svelte:options runes={false} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { createEventDispatcher } from "svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  import {
    applyFocusState,
    getMermaidErrorMessage,
    renderMermaidDiagram
  } from "$lib/mermaid-diagram";
  import {
    applySvgZoom,
    canZoomIn,
    canZoomOut,
    createNextZoomScale,
    createPreservedZoomScrollPosition,
    DEFAULT_ZOOM_SCALE,
    formatZoomPercentage
  } from "$lib/diagram-zoom";
  import {
    createDiagramMinimapGeometry,
    createMinimapCenterScrollPosition,
    createMinimapViewportScrollPosition,
    readDiagramMinimapMetrics,
    readDiagramMinimapNodeRects,
    type DiagramMinimapGeometry,
    type DiagramMinimapRect,
    type DiagramMinimapMetrics
  } from "$lib/diagram-minimap";
  import { focusDiagramViewport } from "$lib/diagram-viewport";
  import { createFocusGroup } from "$lib/focus-group";
  import { createTourPlayer } from "$lib/player-state";
  import {
    createNodeStepChoices,
    createDiagramElementStepIndex,
    hasNodeStepMatches,
    readDiagramElementStepMatches,
    type NodeStepChoice
  } from "$lib/tour-step-links";
  import type { ResolvedDiagramTour } from "@diagram-tour/core";

  const MINIMAP_BREAKPOINT = 720;
  const MINIMAP_STORAGE_KEY = "diagram-tour:minimap-collapsed";
  const MINIMAP_SIZE = {
    maxHeight: 160,
    maxWidth: 220
  } as const;
  const NODE_CHOOSER_WIDTH = 240;

  type NodeStepChooser = {
    label: string;
    left: number;
    nodeId: string;
    options: NodeStepChoice[];
    top: number;
  };

  type ViewportDragState = {
    didDrag: boolean;
    offsetX: number;
    offsetY: number;
    pointerId: number;
    rectHeight: number;
    rectWidth: number;
  };

  type ViewportOrigin = {
    x: number;
    y: number;
  };

  type DiagramNodeElement = HTMLElement | SVGElement;
  const INTERACTIVE_DIAGRAM_ELEMENT_SELECTOR = [
    '[data-diagram-element-id]:not([data-diagram-element-auxiliary="true"])',
    '[data-node-id]:not([data-diagram-element-auxiliary="true"])'
  ].join(", ");

  type ViewportDragInput = {
    dragState: ViewportDragState;
    metrics: DiagramMinimapMetrics;
    viewportOrigin: ViewportOrigin;
  };

  export let initialStepIndex: number;
  export let selectedSlug: string;
  export let tour: ResolvedDiagramTour;
  const dispatch = createEventDispatcher<{
    togglebrowse: void;
  }>();
  const player = createTourPlayer(tour, initialStepIndex);

  let state = player.getState();
  let diagramShell: HTMLDivElement;
  let diagramContainer: HTMLDivElement;
  let diagramContent: HTMLDivElement;
  let minimapSurface: HTMLDivElement;
  let diagramError = "";
  let hasRenderedDiagram = false;
  let isCompactViewport = false;
  let isMinimapCollapsed = false;
  let minimapGeometry: DiagramMinimapGeometry | null = null;
  let nodeStepChooser: NodeStepChooser | null = null;
  let nodeStepIndex = createDiagramElementStepIndex(tour);
  let optimisticViewportRect: DiagramMinimapRect | null = null;
  let previousInitialStepIndex = initialStepIndex;
  let renderedViewportRect: DiagramMinimapRect | null = null;
  let viewportDragState: ViewportDragState | null = null;
  let zoomScale = DEFAULT_ZOOM_SCALE;
  $: stepTextLines = readStepTextLines(state.step.text);

  async function goPrevious(): Promise<void> {
    await goToStepIndex(state.stepIndex - 1);
  }

  async function goNext(): Promise<void> {
    await goToStepIndex(state.stepIndex + 1);
  }

  async function zoomIn(): Promise<void> {
    await updateZoomScale(createNextZoomScale(zoomScale, "in"));
  }

  async function zoomOut(): Promise<void> {
    await updateZoomScale(createNextZoomScale(zoomScale, "out"));
  }

  async function resetZoom(): Promise<void> {
    await updateZoomScale(createNextZoomScale(zoomScale, "reset"));
  }

  async function syncFocusState(): Promise<void> {
    if (!hasRenderedDiagram) {
      return;
    }

    await waitForDiagramLayout();

    const currentContext = readDiagramContext();

    if (currentContext === null) {
      return;
    }

    const focusGroup = createFocusGroup(state.focusedElementIds);

    applyFocusState({
      container: currentContext.container,
      focusGroup
    });
    focusDiagramViewport({
      container: currentContext.container,
      content: currentContext.content,
      focusGroup
    });
    updateMinimapGeometry();
  }

  onMount(() => {
    hydrateViewportMode();
    hydrateMinimapState();

    const cleanupWindow = attachWindowListeners();
    const cleanupScroll = attachDiagramScrollListener();
    const cleanupResizeObserver = attachDiagramResizeObserver();

    void renderInitialDiagram();

    return () => {
      cleanupWindow();
      cleanupScroll();
      cleanupResizeObserver();
      detachViewportDrag();
    };
  });

  $: if (initialStepIndex !== previousInitialStepIndex) {
    previousInitialStepIndex = initialStepIndex;
    state = player.setStepIndex(initialStepIndex);
    closeNodeStepChooser();
    void syncFocusState();
  }

  $: nodeStepIndex = createDiagramElementStepIndex(tour);
  $: renderedViewportRect = optimisticViewportRect ?? minimapGeometry?.viewportRect ?? null;

  async function goToStepIndex(stepIndex: number): Promise<void> {
    closeNodeStepChooser();
    state = player.setStepIndex(stepIndex);
    await syncFocusState();
    await navigateToStep(state.step.index);
  }

  async function navigateToStep(stepIndex: number): Promise<void> {
    await goto(resolve(`/${selectedSlug}?step=${stepIndex}`), {
      invalidateAll: false,
      keepFocus: true,
      noScroll: true
    });
  }

  function waitForDiagramLayout(): Promise<void> {
    return new Promise((resolveLayout) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolveLayout();
        });
      });
    });
  }

  function readDiagramContext(): {
    container: HTMLDivElement;
    content: HTMLDivElement;
  } | null {
    const container = readBoundElement(diagramContainer);
    const content = readBoundElement(diagramContent);

    return container !== null && content !== null ? { container, content } : null;
  }

  function readBoundElement<T extends HTMLElement>(value: T | undefined): T | null {
    return value ?? null;
  }

  function handleTourIdentityClick(): void {
    dispatch("togglebrowse");
  }

  function handleWindowPointerDown(event: PointerEvent): void {
    if (!shouldCloseNodeStepChooser(event)) {
      return;
    }

    closeNodeStepChooser();
  }

  function toggleMinimap(): void {
    isMinimapCollapsed = !isMinimapCollapsed;
    persistMinimapState();
  }

  async function renderInitialDiagram(): Promise<void> {
    try {
      await renderMermaidDiagram({
        container: diagramContent,
        diagram: tour.diagram
      });
      hasRenderedDiagram = true;
      syncRenderedSvgZoom();
      refreshNavigableNodeState();
      await syncFocusState();
    } catch (_error) {
      diagramError = getMermaidErrorMessage();
      toast.error(diagramError);
    }
  }

  function hydrateViewportMode(): void {
    isCompactViewport = typeof window !== "undefined" && window.innerWidth < MINIMAP_BREAKPOINT;
  }

  function hydrateMinimapState(): void {
    if (typeof window === "undefined") {
      return;
    }

    isMinimapCollapsed = window.localStorage.getItem(MINIMAP_STORAGE_KEY) === "true";
  }

  function persistMinimapState(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(MINIMAP_STORAGE_KEY, String(isMinimapCollapsed));
  }

  function attachWindowListeners(): () => void {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    const handleResize = (): void => {
      hydrateViewportMode();
      updateMinimapGeometry();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }

  function attachDiagramScrollListener(): () => void {
    const container = readBoundElement(diagramContainer);

    if (container === null) {
      return () => undefined;
    }

    const handleScroll = (): void => {
      updateMinimapGeometry();
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }

  function attachDiagramResizeObserver(): () => void {
    if (typeof ResizeObserver === "undefined") {
      return () => undefined;
    }

    const currentContext = readDiagramContext();

    if (currentContext === null) {
      return () => undefined;
    }

    const observer = new ResizeObserver(() => {
      updateMinimapGeometry();
    });

    observer.observe(currentContext.container);
    observer.observe(currentContext.content);

    return () => {
      observer.disconnect();
    };
  }

  function updateMinimapGeometry(): void {
    minimapGeometry = shouldHideMinimapGeometry() ? null : createCurrentMinimapGeometry();
  }

  async function updateZoomScale(nextZoomScale: number): Promise<void> {
    const zoomContext = readZoomContext();

    if (zoomContext === null) {
      return;
    }

    const previousMetrics = readDiagramMinimapMetrics(zoomContext.context);

    if (!applyZoomScaleToSvg(zoomContext.svg, nextZoomScale)) {
      return;
    }

    zoomScale = nextZoomScale;
    await waitForDiagramLayout();
    preserveZoomViewport(zoomContext.context, previousMetrics);
  }

  function readZoomContext():
    | {
        context: { container: HTMLDivElement; content: HTMLDivElement };
        svg: SVGSVGElement;
      }
    | null {
    const context = readDiagramContext();

    if (context === null) {
      return null;
    }

    return createZoomContext(context);
  }

  function applyZoomScaleToSvg(svg: SVGSVGElement, nextZoomScale: number): boolean {
    return applySvgZoom(svg, nextZoomScale);
  }

  function preserveZoomViewport(context: {
    container: HTMLDivElement;
    content: HTMLDivElement;
  }, previousMetrics: DiagramMinimapMetrics): void {
    const nextPosition = createPreservedZoomScrollPosition({
      nextMetrics: readCurrentMetrics(context),
      previousMetrics
    });

    writeDiagramScrollPosition(nextPosition, "auto");
  }

  function readCurrentMetrics(context: {
    container: HTMLDivElement;
    content: HTMLDivElement;
  }): DiagramMinimapMetrics {
    return readDiagramMinimapMetrics(context);
  }

  async function handleDiagramClick(event: MouseEvent): Promise<void> {
    const nodeElement = readClickedNodeElement(event);
    const nodeClickInput = readNodeClickInput(nodeElement);

    if (nodeClickInput === null) {
      closeNodeStepChooser();

      return;
    }

    if (shouldNavigateDirectly(nodeClickInput.matchingSteps)) {
      await goToSingleNodeStep(nodeClickInput.matchingSteps);

      return;
    }

    nodeStepChooser = createNodeStepChooser(nodeClickInput);
    refreshNavigableNodeState();
  }

  function handleMinimapSurfacePointerDown(event: PointerEvent): void {
    const metrics = readCurrentMinimapMetrics();
    const minimapPoint = readMinimapPoint(event);

    if (metrics === null || minimapPoint === null) {
      return;
    }

    const nextPosition = createMinimapCenterScrollPosition({
      metrics,
      minimapPoint,
      minimapSize: MINIMAP_SIZE
    });

    writeDiagramScrollPosition(nextPosition);
  }

  function handleViewportPointerDown(event: PointerEvent): void {
    const nextDragState = readViewportDragState(event);

    if (nextDragState === null) {
      return;
    }

    viewportDragState = nextDragState;
    captureViewportPointer(event);
    window.addEventListener("pointermove", handleViewportPointerMove);
    window.addEventListener("pointerup", handleViewportPointerUp);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleViewportPointerMove(event: PointerEvent): void {
    const dragInput = readViewportDragInput(event);

    if (dragInput === null) {
      return;
    }

    viewportDragState = markViewportDragStateAsDragged(dragInput.dragState);
    optimisticViewportRect = createOptimisticViewportRect(dragInput);

    const nextPosition = createMinimapViewportScrollPosition({
      metrics: dragInput.metrics,
      minimapSize: MINIMAP_SIZE,
      viewportOrigin: dragInput.viewportOrigin
    });

    writeDiagramScrollPosition(nextPosition);
  }

  function handleViewportPointerUp(event: PointerEvent): void {
    if (viewportDragState?.pointerId !== event.pointerId) {
      return;
    }

    detachViewportDrag();
  }

  function detachViewportDrag(): void {
    optimisticViewportRect = null;
    viewportDragState = null;
    window.removeEventListener("pointermove", handleViewportPointerMove);
    window.removeEventListener("pointerup", handleViewportPointerUp);
  }

  function readCurrentMinimapMetrics(): DiagramMinimapMetrics | null {
    const currentContext = readDiagramContext();

    return currentContext === null
      ? null
      : readDiagramMinimapMetrics({
          container: currentContext.container,
          content: currentContext.content
        });
  }

  function readMinimapPoint(event: MouseEvent | PointerEvent): { x: number; y: number } | null {
    const surface = readBoundElement(minimapSurface);

    if (surface === null) {
      return null;
    }

    const rect = surface.getBoundingClientRect();

    return {
      x: clampMinimapCoordinate(event.clientX - rect.left, rect.width),
      y: clampMinimapCoordinate(event.clientY - rect.top, rect.height)
    };
  }

  function clampMinimapCoordinate(value: number, maxValue: number): number {
    if (value < 0) {
      return 0;
    }

    if (value > maxValue) {
      return maxValue;
    }

    return value;
  }

  function writeDiagramScrollPosition(position: {
    scrollLeft: number;
    scrollTop: number;
  } | null, behavior: ScrollBehavior = "auto"): void {
    const scrollTarget = readScrollTarget(position);

    if (scrollTarget === null) {
      return;
    }

    applyDiagramScrollPosition(scrollTarget.container, scrollTarget.position, behavior);
    updateMinimapGeometry();
  }

  function readScrollTarget(
    position: { scrollLeft: number; scrollTop: number } | null
  ): { container: HTMLDivElement; position: { scrollLeft: number; scrollTop: number } } | null {
    const container = readBoundElement(diagramContainer);

    return container === null || position === null ? null : { container, position };
  }

  function formatMinimapRectStyle(rect: {
    height: number;
    left: number;
    top: number;
    width: number;
  }): string {
    return `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
  }

  function formatMinimapBoundsStyle(bounds: {
    height: number;
    width: number;
  }): string {
    return `width:${bounds.width}px;height:${bounds.height}px;`;
  }

  function shouldHideMinimapGeometry(): boolean {
    return isCompactViewport || !hasRenderedDiagram || readDiagramContext() === null;
  }

  function createCurrentMinimapGeometry(): DiagramMinimapGeometry | null {
    const currentContext = readDiagramContext();

    return currentContext === null
      ? null
      : createDiagramMinimapGeometry({
          nodeRects: readDiagramMinimapNodeRects({
            content: currentContext.content,
            focusedElementIds: tour.diagram.elements.map((element) => element.id)
          }),
          focusedNodeRects: readDiagramMinimapNodeRects({
            content: currentContext.content,
            focusedElementIds: state.focusedElementIds
          }),
          metrics: readDiagramMinimapMetrics({
            container: currentContext.container,
            content: currentContext.content
          }),
          minimapSize: MINIMAP_SIZE
        });
  }

  function refreshNavigableNodeState(): void {
    const content = readBoundElement(diagramContent);

    if (content === null) {
      return;
    }

    content
      .querySelectorAll<DiagramNodeElement>(INTERACTIVE_DIAGRAM_ELEMENT_SELECTOR)
      .forEach((element) => {
        applyNodeStepTargetState(element);
      });
  }

  function applyNodeStepTargetState(element: DiagramNodeElement): void {
    const nodeId = readNodeStepTargetId(element);

    if (!hasNodeStepMatches(nodeStepIndex, nodeId)) {
      clearNodeStepTargetState(element);

      return;
    }

    element.dataset.stepTarget = "true";
    setNodeStepTargetActiveState(element, nodeId);
  }

  function clearNodeStepTargetState(element: DiagramNodeElement): void {
    element.removeAttribute("data-step-target");
    element.removeAttribute("data-step-target-active");
  }

  function setNodeStepTargetActiveState(element: DiagramNodeElement, nodeId: string): void {
    if (nodeStepChooser?.nodeId === nodeId) {
      element.dataset.stepTargetActive = "true";

      return;
    }

    element.removeAttribute("data-step-target-active");
  }

  function readViewportDragState(event: PointerEvent): ViewportDragState | null {
    const viewportRect = event.currentTarget;

    if (minimapGeometry === null || !(viewportRect instanceof HTMLElement)) {
      return null;
    }

    return {
      didDrag: false,
      offsetX: event.clientX - viewportRect.getBoundingClientRect().left,
      offsetY: event.clientY - viewportRect.getBoundingClientRect().top,
      pointerId: event.pointerId,
      rectHeight: minimapGeometry.viewportRect.height,
      rectWidth: minimapGeometry.viewportRect.width
    };
  }

  function captureViewportPointer(event: PointerEvent): void {
    const viewportRect = event.currentTarget;

    if (viewportRect instanceof HTMLElement && typeof viewportRect.setPointerCapture === "function") {
      viewportRect.setPointerCapture(event.pointerId);
    }
  }

  function matchesViewportDragPointer(event: PointerEvent): boolean {
    return viewportDragState !== null && event.pointerId === viewportDragState.pointerId;
  }

  function readCurrentViewportDragState(event: PointerEvent): ViewportDragState | null {
    return matchesViewportDragPointer(event) ? viewportDragState : null;
  }

  function markViewportDragStateAsDragged(input: ViewportDragState): ViewportDragState {
    return {
      ...input,
      didDrag: true
    };
  }

  function createOptimisticViewportRect(input: ViewportDragInput): DiagramMinimapRect | null {
    if (minimapGeometry === null) {
      return null;
    }

    return clampViewportRectToBounds({
      bounds: minimapGeometry.bounds,
      height: input.dragState.rectHeight,
      left: input.viewportOrigin.x,
      top: input.viewportOrigin.y,
      width: input.dragState.rectWidth
    });
  }

  function readViewportDragInput(event: PointerEvent): ViewportDragInput | null {
    const dragState = readCurrentViewportDragState(event);
    const metrics = readCurrentMinimapMetrics();
    const viewportOrigin = readDraggedViewportOrigin(event);

    if (hasMissingViewportDragInput(dragState, metrics, viewportOrigin)) {
      return null;
    }

    return createViewportDragInputPayload({
      dragState,
      metrics,
      viewportOrigin
    });
  }

  function hasMissingViewportDragInput(
    dragState: ViewportDragState | null,
    metrics: DiagramMinimapMetrics | null,
    viewportOrigin: ViewportOrigin | null
  ): boolean {
    return [dragState, metrics, viewportOrigin].some((value) => value === null);
  }

  function createViewportDragInputPayload(input: {
    dragState: ViewportDragState | null;
    metrics: DiagramMinimapMetrics | null;
    viewportOrigin: ViewportOrigin | null;
  }): ViewportDragInput {
    return {
      dragState: input.dragState as ViewportDragState,
      metrics: input.metrics as DiagramMinimapMetrics,
      viewportOrigin: input.viewportOrigin as ViewportOrigin
    };
  }

  function readDraggedViewportOrigin(event: PointerEvent): ViewportOrigin | null {
    const minimapPoint = readMinimapPoint(event);

    if (minimapPoint === null || viewportDragState === null) {
      return null;
    }

    return {
      x: minimapPoint.x - viewportDragState.offsetX,
      y: minimapPoint.y - viewportDragState.offsetY
    };
  }

  function readClickedNodeElement(event: MouseEvent): DiagramNodeElement | null {
    const target = event.target;

    return target instanceof Element
      ? target.closest<DiagramNodeElement>(INTERACTIVE_DIAGRAM_ELEMENT_SELECTOR)
      : null;
  }

  function createNodeStepChooser(
    input: {
      matchingSteps: number[];
      nodeElement: DiagramNodeElement;
    }
  ): NodeStepChooser | null {
    const shell = readBoundElement(diagramShell);

    if (shell === null) {
      return null;
    }

    return {
      label: readChooserNodeLabel(input.nodeElement),
      ...readNodeChooserPosition(shell, input.nodeElement),
      nodeId: readNodeStepTargetId(input.nodeElement),
      options: createNodeStepChoices(tour, input.matchingSteps)
    };
  }

  function readChooserNodeLabel(nodeElement: DiagramNodeElement): string {
    return readFirstDefinedNodeStepTargetValue([
      nodeElement.dataset.diagramElementLabel,
      nodeElement.dataset.nodeLabel,
      nodeElement.dataset.diagramElementId,
      nodeElement.dataset.nodeId,
      "Element"
    ]);
  }

  function readNodeStepTargetId(nodeElement: DiagramNodeElement): string {
    return readFirstDefinedNodeStepTargetValue([
      nodeElement.dataset.diagramElementId,
      nodeElement.dataset.nodeId,
      ""
    ]);
  }

  function readFirstDefinedNodeStepTargetValue(values: Array<string | undefined>): string {
    return values.find((value) => value !== undefined) ?? "";
  }

  function readNodeChooserPosition(
    shell: HTMLDivElement,
    nodeElement: DiagramNodeElement
  ): { left: number; top: number } {
    const shellRect = shell.getBoundingClientRect();
    const nodeRect = nodeElement.getBoundingClientRect();

    return {
      left: clampNodeChooserLeft(nodeRect.left - shellRect.left),
      top: nodeRect.bottom - shellRect.top + 10
    };
  }

  function clampNodeChooserLeft(value: number): number {
    const shell = readBoundElement(diagramShell);

    if (shell === null) {
      return value;
    }

    return clampMinimapCoordinate(value, shell.clientWidth - NODE_CHOOSER_WIDTH - 12);
  }

  function closeNodeStepChooser(): void {
    nodeStepChooser = null;
    refreshNavigableNodeState();
  }

  function syncRenderedSvgZoom(): void {
    const svg = readRenderedZoomSvg(readDiagramContext());

    if (svg === null) {
      return;
    }

    applySvgZoom(svg, zoomScale);
  }

  function shouldCloseNodeStepChooser(event: PointerEvent): boolean {
    if (nodeStepChooser === null) {
      return false;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return true;
    }

    return (
      target.closest(`[data-testid='node-step-chooser'], ${INTERACTIVE_DIAGRAM_ELEMENT_SELECTOR}`) ===
      null
    );
  }

  function readNodeClickInput(
    nodeElement: DiagramNodeElement | null
  ): { matchingSteps: number[]; nodeElement: DiagramNodeElement } | null {
    if (nodeElement === null) {
      return null;
    }

    return createNodeClickInputPayload(nodeElement, readNodeStepMatchesForElement(nodeElement));
  }

  function shouldNavigateDirectly(matchingSteps: number[]): boolean {
    return matchingSteps.length === 1;
  }

  async function goToSingleNodeStep(matchingSteps: number[]): Promise<void> {
    await goToStepIndex(matchingSteps[0]);
  }

  function readNodeStepMatchesForElement(nodeElement: DiagramNodeElement): number[] {
    return readDiagramElementStepMatches(
      nodeStepIndex,
      nodeElement.dataset.diagramElementId ?? nodeElement.dataset.nodeId ?? ""
    );
  }

  function createNodeClickInputPayload(
    nodeElement: DiagramNodeElement,
    matchingSteps: number[]
  ): { matchingSteps: number[]; nodeElement: DiagramNodeElement } | null {
    return matchingSteps.length === 0 ? null : { matchingSteps, nodeElement };
  }

  function clampViewportRectToBounds(input: {
    bounds: DiagramMinimapRect;
    height: number;
    left: number;
    top: number;
    width: number;
  }): DiagramMinimapRect {
    return {
      height: input.height,
      left: clampMinimapCoordinate(input.left, input.bounds.width - input.width),
      top: clampMinimapCoordinate(input.top, input.bounds.height - input.height),
      width: input.width
    };
  }

  function applyDiagramScrollPosition(
    container: HTMLDivElement,
    position: {
      scrollLeft: number;
      scrollTop: number;
    },
    behavior: ScrollBehavior
  ): void {
    if (typeof container.scrollTo === "function") {
      scrollDiagramContainer(container, position, behavior);

      return;
    }

    container.scrollLeft = position.scrollLeft;
    container.scrollTop = position.scrollTop;
  }

  function scrollDiagramContainer(
    container: HTMLDivElement,
    position: {
      scrollLeft: number;
      scrollTop: number;
    },
    behavior: ScrollBehavior
  ): void {
    container.scrollTo({
      behavior,
      left: position.scrollLeft,
      top: position.scrollTop
    });
  }

  function readRenderedSvg(content: HTMLDivElement | null | undefined): SVGSVGElement | null {
    return content?.querySelector("svg") ?? null;
  }

  function readRenderedZoomSvg(
    context: { container: HTMLDivElement; content: HTMLDivElement } | null
  ): SVGSVGElement | null {
    return context === null ? null : readRenderedSvg(context.content);
  }

  function createZoomContext(context: {
    container: HTMLDivElement;
    content: HTMLDivElement;
  }): {
    context: { container: HTMLDivElement; content: HTMLDivElement };
    svg: SVGSVGElement;
  } | null {
    const svg = readRenderedZoomSvg(context);

    return svg === null ? null : { context, svg };
  }

  function readStepTextLines(text: string): string[] {
    return normalizeStepText(text).split("\n");
  }

  function normalizeStepText(text: string): string {
    return text.replace(/<br\s*\/?>/giu, "\n");
  }
</script>

<svelte:window on:pointerdown={handleWindowPointerDown} />

<section class="player-canvas" data-testid="player-canvas">
  <div
    bind:this={diagramShell}
    class="diagram-shell diagram-shell--canvas"
    data-testid="diagram-shell"
  >
    <button
      type="button"
      class="tour-identity"
      data-testid="tour-identity"
      on:click={handleTourIdentityClick}
    >
      <p class="tour-identity__label">Current tour</p>
      <p class="tour-identity__title">{tour.title}</p>
    </button>

    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      bind:this={diagramContainer}
      data-testid="diagram-container"
      class="diagram"
      on:click={handleDiagramClick}
    >
      <div
        bind:this={diagramContent}
        data-testid="diagram-stage-inner"
        class="diagram-stage-inner"
      ></div>
    </div>

    {#if nodeStepChooser !== null}
      <div
        class="node-step-chooser"
        data-testid="node-step-chooser"
        style={`left:${nodeStepChooser.left}px;top:${nodeStepChooser.top}px;`}
      >
        <p class="node-step-chooser__title">{nodeStepChooser.label}</p>
        <div class="node-step-chooser__list">
          {#each nodeStepChooser.options as option (option.stepIndex)}
            <button
              type="button"
              class="node-step-chooser__option"
              data-testid="node-step-choice"
              on:click={() => void goToStepIndex(option.stepIndex)}
            >
              <span class="node-step-chooser__step">Step {option.stepNumber}</span>
              <span class="node-step-chooser__preview">{option.preview}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="canvas-overlay-stack" data-testid="canvas-overlay-stack">
      <aside class="viewport-toolbar" data-testid="viewport-toolbar">
        <p class="viewport-toolbar__label">Zoom</p>
        <div class="viewport-toolbar__actions">
          <button
            type="button"
            class="viewport-toolbar__button"
            data-testid="zoom-out-button"
            aria-label="Zoom out"
            disabled={!canZoomOut(zoomScale)}
            on:click={() => void zoomOut()}
          >
            -
          </button>
          <button
            type="button"
            class="viewport-toolbar__button viewport-toolbar__button--value"
            data-testid="zoom-reset-button"
            aria-label="Reset zoom to 100%"
            disabled={zoomScale === DEFAULT_ZOOM_SCALE}
            on:click={() => void resetZoom()}
          >
            {formatZoomPercentage(zoomScale)}
          </button>
          <button
            type="button"
            class="viewport-toolbar__button"
            data-testid="zoom-in-button"
            aria-label="Zoom in"
            disabled={!canZoomIn(zoomScale)}
            on:click={() => void zoomIn()}
          >
            +
          </button>
        </div>
      </aside>

      <aside class="step-panel step-panel--overlay" data-testid="step-overlay">
        <p class="step-count">Step {state.step.index} of {tour.steps.length}</p>
        <div class="step-timeline" data-testid="step-timeline">
          {#each tour.steps as step, stepIndex (step.index)}
            <button
              type="button"
              class:step-timeline__pill--current={stepIndex === state.stepIndex}
              class:step-timeline__pill--complete={stepIndex < state.stepIndex}
              class="step-timeline__pill"
              data-testid="timeline-step-button"
              aria-current={stepIndex === state.stepIndex ? "step" : undefined}
              on:click={() => void goToStepIndex(stepIndex)}
            >
              {step.index}
            </button>
          {/each}
        </div>
        <p data-testid="step-text" class="step-text">
          {#each stepTextLines as line, index (index)}
            {line}
            {#if index < stepTextLines.length - 1}<br />{/if}
          {/each}
        </p>

        <div class="controls">
          <button
            type="button"
            class="button button--secondary"
            on:click={goPrevious}
            disabled={!state.canGoPrevious}
            data-testid="previous-button"
          >
            Previous
          </button>
          <button
            type="button"
            class="button"
            on:click={goNext}
            disabled={!state.canGoNext}
            data-testid="next-button"
          >
            Next
          </button>
        </div>
      </aside>

      {#if !isCompactViewport}
        <aside
          class:minimap-shell--collapsed={isMinimapCollapsed}
          class="minimap-shell"
          data-testid="minimap-shell"
        >
          <div class="minimap-shell__header">
            <p class="minimap-shell__label">Navigation minimap</p>
            <div class="minimap-shell__actions">
              <button
                type="button"
                class="minimap-shell__toggle"
                data-testid="minimap-toggle"
                aria-expanded={!isMinimapCollapsed}
                on:click={toggleMinimap}
              >
                {isMinimapCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          </div>

          {#if !isMinimapCollapsed && minimapGeometry !== null}
            <div
              bind:this={minimapSurface}
              class="minimap-surface"
              role="group"
              aria-label="Navigation minimap"
              data-testid="minimap-surface"
              style={formatMinimapBoundsStyle(minimapGeometry.bounds)}
              on:pointerdown={handleMinimapSurfacePointerDown}
            >
              {#each minimapGeometry.nodeRects as rect, index (`node-${index}`)}
                <div
                  class="minimap-node-marker"
                  data-testid="minimap-node-marker"
                  style={formatMinimapRectStyle(rect)}
                ></div>
              {/each}

              {#each minimapGeometry.focusRects as rect, index (index)}
                <div
                  class="minimap-focus-marker"
                  data-testid="minimap-focus-marker"
                  style={formatMinimapRectStyle(rect)}
                ></div>
              {/each}

              {#if renderedViewportRect !== null}
                <button
                  type="button"
                  class="minimap-viewport-rect"
                  data-testid="minimap-viewport-rect"
                  aria-label="Drag viewport"
                  style={formatMinimapRectStyle(renderedViewportRect)}
                  on:pointerdown={handleViewportPointerDown}
                ></button>
              {/if}
            </div>
          {/if}
        </aside>
      {/if}
    </div>

    {#if diagramError.length > 0}
      <p data-testid="diagram-error" class="diagram-error diagram-error--overlay">{diagramError}</p>
    {/if}
  </div>
</section>
