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
  import type { ResolvedDiagramTour } from "@diagram-tour/core";

  const MINIMAP_BREAKPOINT = 720;
  const MINIMAP_STORAGE_KEY = "diagram-tour:minimap-collapsed";
  const MINIMAP_SIZE = {
    maxHeight: 160,
    maxWidth: 220
  } as const;

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
  let diagramContainer: HTMLDivElement;
  let diagramContent: HTMLDivElement;
  let minimapSurface: HTMLDivElement;
  let diagramError = "";
  let hasRenderedDiagram = false;
  let isCompactViewport = false;
  let isMinimapCollapsed = false;
  let minimapGeometry: DiagramMinimapGeometry | null = null;
  let optimisticViewportRect: DiagramMinimapRect | null = null;
  let previousInitialStepIndex = initialStepIndex;
  let renderedViewportRect: DiagramMinimapRect | null = null;
  let viewportDragState: ViewportDragState | null = null;

  async function goPrevious(): Promise<void> {
    state = player.goPrevious();
    await syncFocusState();
    await navigateToStep(state.step.index);
  }

  async function goNext(): Promise<void> {
    state = player.goNext();
    await syncFocusState();
    await navigateToStep(state.step.index);
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

    const focusGroup = createFocusGroup(state.focusedNodeIds);

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
    void syncFocusState();
  }

  $: renderedViewportRect = optimisticViewportRect ?? minimapGeometry?.viewportRect ?? null;

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
  } | null): void {
    const container = readBoundElement(diagramContainer);

    if (container === null || position === null) {
      return;
    }

    applyDiagramScrollPosition(container, position);
    updateMinimapGeometry();
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
            focusedNodeIds: tour.diagram.nodes.map((node) => node.id)
          }),
          focusedNodeRects: readDiagramMinimapNodeRects({
            content: currentContext.content,
            focusedNodeIds: state.focusedNodeIds
          }),
          metrics: readDiagramMinimapMetrics({
            container: currentContext.container,
            content: currentContext.content
          }),
          minimapSize: MINIMAP_SIZE
        });
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
    }
  ): void {
    if (typeof container.scrollTo === "function") {
      scrollDiagramContainer(container, position);

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
    }
  ): void {
    container.scrollTo({
      behavior: "auto",
      left: position.scrollLeft,
      top: position.scrollTop
    });
  }
</script>

<section class="player-canvas" data-testid="player-canvas">
  <div class="diagram-shell diagram-shell--canvas" data-testid="diagram-shell">
    <button
      type="button"
      class="tour-identity"
      data-testid="tour-identity"
      on:click={handleTourIdentityClick}
    >
      <p class="tour-identity__label">Current tour</p>
      <p class="tour-identity__title">{tour.title}</p>
    </button>

    <div bind:this={diagramContainer} data-testid="diagram-container" class="diagram">
      <div
        bind:this={diagramContent}
        data-testid="diagram-stage-inner"
        class="diagram-stage-inner"
      ></div>
    </div>

    <div class="canvas-overlay-stack" data-testid="canvas-overlay-stack">
      <aside class="step-panel step-panel--overlay" data-testid="step-overlay">
        <p class="step-count">Step {state.step.index} of {tour.steps.length}</p>
        <p data-testid="step-text" class="step-text">{state.step.text}</p>

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
