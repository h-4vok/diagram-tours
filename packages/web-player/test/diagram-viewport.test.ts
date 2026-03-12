import { describe, expect, it } from "vitest";

import {
  createViewportInstruction,
  focusDiagramViewport
} from "../src/lib/diagram-viewport";
import { createFocusGroup } from "../src/lib/focus-group";

describe("diagram viewport helpers", () => {
  it("computes a bounded pan target for a single focused node", () => {
    expect(
      createViewportInstruction({
        focusedNodeRects: [
          {
            left: 420,
            top: 250,
            width: 80,
            height: 40
          }
        ],
        metrics: {
          viewportHeight: 400,
          viewportWidth: 600
        }
      })
    ).toEqual({
      mode: "focus",
      offsetX: -120,
      offsetY: -70
    });
  });

  it("computes a combined pan target for multiple focused nodes", () => {
    const forwardInstruction =
      createViewportInstruction({
        focusedNodeRects: [
          {
            left: 140,
            top: 180,
            width: 80,
            height: 40
          },
          {
            left: 380,
            top: 260,
            width: 100,
            height: 50
          }
        ],
        metrics: {
          viewportHeight: 400,
          viewportWidth: 600
        }
      });
    const reversedInstruction = createViewportInstruction({
      focusedNodeRects: [
        {
          left: 380,
          top: 260,
          width: 100,
          height: 50
        },
        {
          left: 140,
          top: 180,
          width: 80,
          height: 40
        }
      ],
      metrics: {
        viewportHeight: 400,
        viewportWidth: 600
      }
    });

    expect(forwardInstruction).toEqual({
      mode: "focus",
      offsetX: -10,
      offsetY: -45
    });
    expect(reversedInstruction).toEqual(forwardInstruction);
  });

  it("clamps positive pan offsets when a focused node is too far toward the top-left", () => {
    expect(
      createViewportInstruction({
        focusedNodeRects: [
          {
            left: 10,
            top: 10,
            width: 40,
            height: 40
          }
        ],
        metrics: {
          viewportHeight: 400,
          viewportWidth: 600
        }
      })
    ).toEqual({
      mode: "focus",
      offsetX: 120,
      offsetY: 80
    });
  });

  it("returns a neutral viewport for empty focus and preserves on unstable measurements", () => {
    expect(
      createViewportInstruction({
        focusedNodeRects: [],
        metrics: {
          viewportHeight: 400,
          viewportWidth: 600
        }
      })
    ).toEqual({
      mode: "neutral",
      offsetX: 0,
      offsetY: 0
    });

    expect(
      createViewportInstruction({
        focusedNodeRects: [
          {
            left: 200,
            top: 120,
            width: 0,
            height: 40
          }
        ],
        metrics: {
          viewportHeight: 400,
          viewportWidth: 600
        }
      })
    ).toEqual({
      mode: "preserve"
    });
  });

  it("applies a pan offset when the focus target changes meaningfully", () => {
    const container = createContainer();

    container.innerHTML = '<div data-node-id="focus"></div>';
    mockRect(container, {
      height: 400,
      left: 0,
      top: 0,
      width: 600
    });
    mockRect(container.querySelector("[data-node-id='focus']") as HTMLElement, {
      height: 80,
      left: 460,
      top: 300,
      width: 100
    });

    focusDiagramViewport({
      container,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(container.style.getPropertyValue("--diagram-pan-x")).toBe("-120px");
    expect(container.style.getPropertyValue("--diagram-pan-y")).toBe("-80px");
  });

  it("preserves the current viewport when focus measurements are missing or unstable", () => {
    const container = createContainer();

    container.style.setProperty("--diagram-pan-x", "18px");
    container.style.setProperty("--diagram-pan-y", "-24px");

    focusDiagramViewport({
      container,
      focusGroup: createFocusGroup(["missing"])
    });

    expect(container.style.getPropertyValue("--diagram-pan-x")).toBe("18px");
    expect(container.style.getPropertyValue("--diagram-pan-y")).toBe("-24px");

    container.innerHTML = '<div data-node-id="focus"></div>';
    mockRect(container, {
      height: 400,
      left: 0,
      top: 0,
      width: 600
    });
    mockRect(container.querySelector("[data-node-id='focus']") as HTMLElement, {
      height: 0,
      left: 100,
      top: 100,
      width: 40
    });

    focusDiagramViewport({
      container,
      focusGroup: createFocusGroup(["focus"])
    });

    expect(container.style.getPropertyValue("--diagram-pan-x")).toBe("18px");
    expect(container.style.getPropertyValue("--diagram-pan-y")).toBe("-24px");
  });

  it("returns to neutral focus only when the target difference is meaningful", () => {
    const container = createContainer();

    container.style.setProperty("--diagram-pan-x", "2px");
    container.style.setProperty("--diagram-pan-y", "-3px");

    focusDiagramViewport({
      container,
      focusGroup: createFocusGroup([])
    });

    expect(container.style.getPropertyValue("--diagram-pan-x")).toBe("2px");
    expect(container.style.getPropertyValue("--diagram-pan-y")).toBe("-3px");

    container.style.setProperty("--diagram-pan-x", "20px");
    container.style.setProperty("--diagram-pan-y", "-24px");

    focusDiagramViewport({
      container,
      focusGroup: createFocusGroup([])
    });

    expect(container.style.getPropertyValue("--diagram-pan-x")).toBe("0px");
    expect(container.style.getPropertyValue("--diagram-pan-y")).toBe("0px");
  });
});

function createContainer(): HTMLElement {
  const container = document.createElement("div");

  Object.defineProperties(container, {
    clientHeight: { value: 400 },
    clientWidth: { value: 600 }
  });

  return container;
}

function mockRect(element: HTMLElement, input: {
  height: number;
  left: number;
  top: number;
  width: number;
}): void {
  element.getBoundingClientRect = () =>
    ({
      bottom: input.top + input.height,
      height: input.height,
      left: input.left,
      right: input.left + input.width,
      top: input.top,
      width: input.width
    }) as DOMRect;
}
