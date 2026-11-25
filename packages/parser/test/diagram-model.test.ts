import { afterEach, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadResolvedTour } from "../src/authored-tour-loader.js";

import {
  createDiagramModel,
  createElementIndex,
  createGeneratedSteps,
  resolveLoadedTour
} from "../src/diagram-model.js";
import { createTourContext } from "../src/tour-context.js";
import { restoreParserTestState } from "./parser-test-support.js";

afterEach(restoreParserTestState);

describe("@diagram-tour/parser diagram model", () => {
  it("extracts unique flowchart nodes in source order", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  api_gateway[API Gateway] --> payment_service[Payment Service]",
        "  api_gateway --> response[Response]"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model).toMatchObject({
      type: "flowchart",
      elements: [
        { id: "api_gateway", kind: "node", label: "API Gateway" },
        { id: "payment_service", kind: "node", label: "Payment Service" },
        { id: "response", kind: "node", label: "Response" }
      ]
    });
  });

  it("extracts flowchart nodes from common shapes and metadata syntax", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  start(Start) --> decision{Decision}",
        "  decision --> cache[(Cache)]",
        "  cache --> worker((Worker))",
        "  worker --> stadium([Stadium])",
        "  stadium --> subroutine[[Subroutine]]",
        "  subroutine --> hexagon{{Hexagon}}",
        "  hexagon --> trapezoid[/Trapezoid\\]",
        "  trapezoid --> parallelogram[\\Parallelogram/]",
        "  metadata@{ shape: rect, label: Metadata Node }"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model).toMatchObject({
      type: "flowchart",
      elements: [
        { id: "start", kind: "node", label: "Start" },
        { id: "decision", kind: "node", label: "Decision" },
        { id: "cache", kind: "node", label: "Cache" },
        { id: "worker", kind: "node", label: "Worker" },
        { id: "stadium", kind: "node", label: "Stadium" },
        { id: "subroutine", kind: "node", label: "Subroutine" },
        { id: "hexagon", kind: "node", label: "Hexagon" },
        { id: "trapezoid", kind: "node", label: "Trapezoid" },
        { id: "parallelogram", kind: "node", label: "Parallelogram" },
        { id: "metadata", kind: "node", label: "Metadata Node" }
      ]
    });
    expect(model.renderSource).toContain("metadata@{ shape: rect, label: Metadata Node }");
  });

  it("extracts flowchart nodes from a full addressability sample with clickable annotations", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  intake[Inbound Intake] --> decision{Decision}",
        "  decision -- Approved --> archive",
        "  decision -- Review --> manual_review[/Manual Review\\]",
        "  manual_review --> queue[(Review Queue)]",
        "  queue --> worker((Worker))",
        '  worker --> done@{ shape: rect, label: "Done" }',
        '  click decision "https://example.com/decision" "Decision rule details"'
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "intake", kind: "node", label: "Inbound Intake" },
      { id: "decision", kind: "node", label: "Decision" },
      { id: "archive", kind: "node", label: "archive" },
      { id: "manual_review", kind: "node", label: "Manual Review" },
      { id: "queue", kind: "node", label: "Review Queue" },
      { id: "worker", kind: "node", label: "Worker" },
      { id: "done", kind: "node", label: "Done" }
    ]);
  });

  it("extracts bare flowchart link endpoints with id fallback labels", () => {
    const model = createDiagramModel(
      ["flowchart LR", "  source --> target", "  target -- Approved --> archive"].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "source", kind: "node", label: "source" },
      { id: "target", kind: "node", label: "target" },
      { id: "archive", kind: "node", label: "archive" }
    ]);
  });

  it("ignores flowchart metadata nodes that do not provide labels", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  unlabeled@{ shape: rect }",
        '  empty@{ shape: rect, label: "" }',
        "  -- detached --> orphan"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([{ id: "orphan", kind: "node", label: "orphan" }]);
  });

  it("keeps first flowchart order and updates duplicate explicit labels", () => {
    const model = createDiagramModel(
      ["flowchart LR", "  source --> target", "  target[Latest Target] --> done[Done]"].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "source", kind: "node", label: "source" },
      { id: "target", kind: "node", label: "Latest Target" },
      { id: "done", kind: "node", label: "Done" }
    ]);
  });

  it("creates generated overview and node focus steps", () => {
    expect(
      createGeneratedSteps([{ id: "api_gateway", kind: "node", label: "API Gateway" }], "Payment Flow")
    ).toEqual([
      {
        focus: [],
        index: 1,
        text: "Overview of Payment Flow."
      },
      {
        focus: [{ id: "api_gateway", kind: "node", label: "API Gateway" }],
        index: 2,
        text: "Focus on API Gateway."
      }
    ]);
  });

  it("ignores flowchart non-node statements", () => {
    const model = createDiagramModel(
      [
        "flowchart LR",
        "  start[Start] --> finish[Finish]",
        "  class start primary",
        "  classDef primary fill:#fff",
        "  style finish stroke:#333",
        "  linkStyle 0 stroke:#333",
        "  click start call callback()",
        "  subgraph cluster",
        "  direction TB",
        "  end"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "start", kind: "node", label: "Start" },
      { id: "finish", kind: "node", label: "Finish" }
    ]);
  });

  it("extracts sequence participants and strips tagged message ids from render source", () => {
    const model = createDiagramModel(
      [
        "sequenceDiagram",
        "  participant user as User",
        "  participant api as API Gateway",
        "  user->>api: [request_sent] Send request"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.type).toBe("sequence");
    expect(model.elements).toEqual([
      { id: "user", kind: "participant", label: "User" },
      { id: "api", kind: "participant", label: "API Gateway" },
      { id: "request_sent", kind: "message", label: "Send request" }
    ]);
    expect(model.renderSource).toContain("user->>api: [request_sent] Send request");
  });

  it("extracts named and nested states plus deterministic transition focus keys", () => {
    const source = [
      "stateDiagram-v2",
      "[*] --> Draft",
      'state "Needs review" as Review',
      "Draft --> Review : submit [complete] / notify",
      "Draft --> Review : submit [complete] / notify",
      "Review --> Review : request changes",
      "state Processing {",
      "  state choice <<choice>>",
      "  [*] --> choice",
      "  choice --> Complete : approved",
      "}",
      "Review --> Processing"
    ].join("\n");
    const model = createDiagramModel(source, createTourContext("/tmp/state.mmd"));

    expect(model.type).toBe("stateDiagram");
    expect(model.renderSource).toBe(source);
    expect(model.elements).toEqual([
      { id: "state-draft", kind: "state", label: "Draft", renderId: "Draft" },
      { id: "transition-start-marker-to-state-draft-unlabeled", kind: "transition", label: "Start → Draft", renderOrder: 0, renderSourceId: "start-marker", renderTargetId: "state-draft" },
      { id: "state-review", kind: "state", label: "Needs review", renderId: "Review" },
      {
        id: "transition-state-draft-to-state-review-submit-complete-notify",
        kind: "transition",
        label: "Draft → Needs review: submit [complete] / notify",
        renderOrder: 1,
        renderSourceId: "state-draft",
        renderTargetId: "state-review"
      },
      {
        id: "transition-state-draft-to-state-review-submit-complete-notify-2",
        kind: "transition",
        label: "Draft → Needs review: submit [complete] / notify",
        renderOrder: 2,
        renderSourceId: "state-draft",
        renderTargetId: "state-review"
      },
      {
        id: "transition-state-review-to-state-review-request-changes",
        kind: "transition",
        label: "Needs review → Needs review: request changes",
        renderOrder: 3,
        renderSourceId: "state-review",
        renderTargetId: "state-review"
      },
      { id: "state-processing", kind: "state", label: "Processing", renderId: "Processing" },
      { id: "state-processing-choice", kind: "state", label: "choice", renderId: "choice" },
      {
        id: "transition-start-marker-to-state-processing-choice-unlabeled",
        kind: "transition",
        label: "Start → choice",
        renderOrder: 4,
        renderSourceId: "start-marker",
        renderTargetId: "state-processing-choice"
      },
      { id: "state-processing-complete", kind: "state", label: "Complete", renderId: "Complete" },
      {
        id: "transition-state-processing-choice-to-state-processing-complete-approved",
        kind: "transition",
        label: "choice → Complete: approved",
        renderOrder: 5,
        renderSourceId: "state-processing-choice",
        renderTargetId: "state-processing-complete"
      },
      {
        id: "transition-state-review-to-state-processing-unlabeled",
        kind: "transition",
        label: "Needs review → Processing",
        renderOrder: 6,
        renderSourceId: "state-review",
        renderTargetId: "state-processing"
      }
    ]);
  });

  it("resolves authored state focus and text references from the player fixture pair", async () => {
    const tour = await loadResolvedTour(
      resolve(process.cwd(), "../web-player/test/fixtures/state/review-lifecycle.tour.yaml")
    );

    expect(tour.diagram.type).toBe("stateDiagram");
    expect(tour.steps[0]).toMatchObject({
      focus: [{ id: "state-draft", kind: "state", label: "Draft" }],
      text: "A change begins in Draft."
    });
    expect(tour.steps[7]).toMatchObject({
      focus: [{ id: "transition-state-in-review-reviewing-to-state-in-review-reviewing-retry", kind: "transition" }]
    });
    expect(tour.steps[10]).toMatchObject({
      focus: [{ id: "state-in-review-review-decision", kind: "state", label: "review_decision" }],
      text: "The review_decision pseudostate selects a review outcome."
    });
  });

  it("parses Mermaid state labels, compact arrows, and empty transition labels", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "Active: Sending request", "First-->Second", "First --> Second :"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([
      { id: "state-active", kind: "state", label: "Sending request", renderId: "Active" },
      { id: "state-first", kind: "state", label: "First", renderId: "First" },
      { id: "state-second", kind: "state", label: "Second", renderId: "Second" },
      { id: "transition-state-first-to-state-second-unlabeled", kind: "transition", label: "First → Second", renderOrder: 0, renderSourceId: "state-first", renderTargetId: "state-second" },
      { id: "transition-state-first-to-state-second-unlabeled-2", kind: "transition", label: "First → Second", renderOrder: 1, renderSourceId: "state-first", renderTargetId: "state-second" }
    ]);
  });

  it("parses styled state endpoints without turning Mermaid metadata into states", () => {
    const model = createDiagramModel(
      [
        "stateDiagram-v2",
        "accTitle: State metadata",
        "title: Workflow metadata",
        "Active: Sending request",
        "A:::important --> B"
      ].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([
      { id: "state-active", kind: "state", label: "Sending request", renderId: "Active" },
      { id: "state-a", kind: "state", label: "A", renderId: "A" },
      { id: "state-b", kind: "state", label: "B", renderId: "B" },
      {
        id: "transition-state-a-to-state-b-unlabeled",
        kind: "transition",
        label: "A → B",
        renderOrder: 0,
        renderSourceId: "state-a",
        renderTargetId: "state-b"
      }
    ]);
  });

  it("parses styled endpoints after inline accessibility metadata", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "accDescr { Accessible caption }", "A:::important --> B"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "transition")).toMatchObject([
      { id: "transition-state-a-to-state-b-unlabeled", renderOrder: 0 }
    ]);
  });

  it("ignores frontmatter and multiline accessibility blocks", () => {
    const model = createDiagramModel(
      ["---", "title: Workflow", "---", "stateDiagram-v2", "accDescr {", "Accessible caption", "}", "Still"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([
      { id: "state-still", kind: "state", label: "Still", renderId: "Still" }
    ]);
  });

  it("counts comments after unlabeled transitions but preserves comments inside labels", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "A --> B %% comment", "B --> C : label %% text"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "transition")).toEqual([
      {
        id: "transition-state-a-to-state-b-unlabeled",
        kind: "transition",
        label: "A → B",
        renderOrder: 0,
        renderSourceId: "state-a",
        renderTargetId: "state-b"
      },
      {
        id: "transition-state-b-to-state-c-label-text",
        kind: "transition",
        label: "B → C: label %% text",
        renderOrder: 1,
        renderSourceId: "state-b",
        renderTargetId: "state-c"
      }
    ]);
  });

  it("keeps a quoted state title when later descriptions appear", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", 'state "Nice state" as A', "A: note 1", "A: note 2"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([
      { id: "state-a", kind: "state", label: "Nice state", renderId: "A" }
    ]);
  });

  it("keeps the first description as the state title", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "A: title", "A: detail"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([
      { id: "state-a", kind: "state", label: "title", renderId: "A" }
    ]);
  });

  it("supports state IDs that begin with an underscore", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "state _Waiting", "_Waiting --> Done"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.map(({ id }) => id)).toEqual([
      "state-waiting",
      "state-done",
      "transition-state-waiting-to-state-done-unlabeled"
    ]);
  });

  it("keeps dotted root IDs distinct from same-named nested states", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "A.B", "state A {", "B --> C", "}", "A.B --> Final"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "state").map(({ id }) => id)).toEqual([
      "state-a-b",
      "state-a",
      "state-a-b-2",
      "state-a-c",
      "state-final"
    ]);
    expect(model.elements.filter((element) => element.kind === "transition").map(({ renderSourceId }) => renderSourceId)).toEqual([
      "state-a-b-2",
      "state-a-b"
    ]);
  });

  it("uses one focus key when Mermaid merges a raw state ID across composites", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "state A {", "Shared --> Left", "}", "state B {", "Shared --> Right", "}"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.renderId === "Shared")).toEqual([
      { id: "state-a-shared", kind: "state", label: "Shared", renderId: "Shared" }
    ]);
    expect(model.elements.filter((element) => element.kind === "transition").map(({ renderSourceId }) => renderSourceId)).toEqual([
      "state-a-shared",
      "state-a-shared"
    ]);
  });

  it("does not route legacy stateDiagram headers to the v2 parser", () => {
    const model = createDiagramModel(
      ["stateDiagram", "Still", "Moving"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.type).toBe("flowchart");
    expect(model.elements.every((element) => element.kind !== "state" && element.kind !== "transition")).toBe(true);
  });

  it("preserves Mermaid edge order when note connectors are interleaved", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "A --> B : first", "note right of B : context", "B --> C : next"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "transition").map(({ renderOrder }) => renderOrder)).toEqual([
      0,
      2
    ]);
  });

  it("ignores multiline note text that resembles Mermaid targets and transitions", () => {
    const model = createDiagramModel(
      [
        "stateDiagram-v2",
        "A --> B",
        "note right of B",
        "Example: revise",
        "C --> D : used in docs",
        "end note",
        "B --> Z : finish"
      ].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "transition")).toMatchObject([
      { id: "transition-state-a-to-state-b-unlabeled", renderOrder: 0 },
      { id: "transition-state-b-to-state-z-finish", renderOrder: 2 }
    ]);
    expect(model.elements.filter((element) => element.kind === "state").map(({ id }) => id)).toEqual([
      "state-a",
      "state-b",
      "state-z"
    ]);
  });

  it("supports numeric state IDs", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "state 1", "1 --> 2"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([
      { id: "state-1", kind: "state", label: "1", renderId: "1" },
      { id: "state-2", kind: "state", label: "2", renderId: "2" },
      {
        id: "transition-state-1-to-state-2-unlabeled",
        kind: "transition",
        label: "1 → 2",
        renderOrder: 0,
        renderSourceId: "state-1",
        renderTargetId: "state-2"
      }
    ]);
  });

  it("focuses standalone states and bracket pseudostates but skips an unrendered state declaration", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "Still", "Moving", "state Decision [[choice]]", "state Waiting"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([
      { id: "state-still", kind: "state", label: "Still", renderId: "Still" },
      { id: "state-moving", kind: "state", label: "Moving", renderId: "Moving" },
      { id: "state-decision", kind: "state", label: "Decision", renderId: "Decision" }
    ]);
  });

  it("uses final declared state labels for transition text references", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "A --> B : go", "B: Ready to publish"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toContainEqual({ id: "state-b", kind: "state", label: "Ready to publish", renderId: "B" });
    expect(model.elements).toContainEqual({
      id: "transition-state-a-to-state-b-go",
      kind: "transition",
      label: "A → Ready to publish: go",
      renderOrder: 0,
      renderSourceId: "state-a",
      renderTargetId: "state-b"
    });
  });

  it("keeps colliding normalized state keys unique even when a natural key uses the suffix", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "FooBar --> [*]", "foo_bar --> [*]", "foo_bar_2 --> [*]"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "state")).toEqual([
      { id: "state-foo-bar", kind: "state", label: "FooBar", renderId: "FooBar" },
      { id: "state-foo-bar-2", kind: "state", label: "foo_bar", renderId: "foo_bar" },
      { id: "state-foo-bar-2-2", kind: "state", label: "foo_bar_2", renderId: "foo_bar_2" }
    ]);
  });

  it("keeps naturally suffixed and repeated transition keys unique", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "A --> B : go", "A --> B : go-2", "A --> B : go"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "transition").map(({ id }) => id)).toEqual([
      "transition-state-a-to-state-b-go",
      "transition-state-a-to-state-b-go-2",
      "transition-state-a-to-state-b-go-3"
    ]);
  });

  it("exposes only the self-loop Mermaid Dagre actually renders", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "A --> A : first", "A --> A : second", "A --> B : next"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements.filter((element) => element.kind === "transition")).toEqual([
      { id: "transition-state-a-to-state-a-second", kind: "transition", label: "A → A: second", renderOrder: 1, renderSourceId: "state-a", renderTargetId: "state-a" },
      { id: "transition-state-a-to-state-b-next", kind: "transition", label: "A → B: next", renderOrder: 2, renderSourceId: "state-a", renderTargetId: "state-b" }
    ]);
  });

  it("does not create focus targets for reverse arrows Mermaid rejects", () => {
    const model = createDiagramModel(
      ["stateDiagram-v2", "First <-- Second : returned"].join("\n"),
      createTourContext("/tmp/state.mmd")
    );

    expect(model.elements).toEqual([]);
  });

  it("explains that state focus references must use state or transition keys", () => {
    expect(() =>
      resolveLoadedTour({
        context: createTourContext("/tmp/state.tour.yaml"),
        diagramPath: "./state.mmd",
        diagramSource: "stateDiagram-v2\n[*] --> Draft",
        rawTour: {
          version: 1,
          title: "State Tour",
          diagram: "./state.mmd",
          steps: [{ focus: ["Draft"], text: "Start at Draft." }]
        }
      })
    ).toThrow('references unknown Mermaid state or transition key "Draft"');
  });

  it("detects sankey diagrams and extracts unique nodes in first-seen source order", () => {
    const model = createDiagramModel(
      [
        "sankey-beta",
        "Checkout,Gateway,120",
        "Gateway,Fraud Review,20",
        "Gateway,Settlement,100",
        "Fraud Review,Settlement,15",
        "Settlement,Bank,115"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model).toMatchObject({
      type: "sankey",
      elements: [
        { id: "Checkout", kind: "node", label: "Checkout" },
        { id: "Gateway", kind: "node", label: "Gateway" },
        { id: "Fraud Review", kind: "node", label: "Fraud Review" },
        { id: "Settlement", kind: "node", label: "Settlement" },
        { id: "Bank", kind: "node", label: "Bank" }
      ]
    });
  });

  it("parses common sankey csv details including decimals, quotes, commas, comments, and blank lines", () => {
    const model = createDiagramModel(
      [
        "sankey-beta",
        "%% source,target,value",
        "\"North, America\",Gateway,120.5",
        "",
        "Gateway,\"Quoted \"\"Review\"\"\",20.25",
        "Gateway,Settlement,100"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "North, America", kind: "node", label: "North, America" },
      { id: "Gateway", kind: "node", label: "Gateway" },
      { id: 'Quoted "Review"', kind: "node", label: 'Quoted "Review"' },
      { id: "Settlement", kind: "node", label: "Settlement" }
    ]);
  });

  it("ignores malformed or non-standard sankey rows that do not produce a valid common-case triple", () => {
    const model = createDiagramModel(
      [
        "sankey-beta",
        "Checkout,Gateway,not-a-number",
        "\"Unclosed,Gateway,20",
        "Too,Many,Columns,10",
        ",Gateway,20",
        "Checkout,Gateway,120"
      ].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(model.elements).toEqual([
      { id: "Checkout", kind: "node", label: "Checkout" },
      { id: "Gateway", kind: "node", label: "Gateway" }
    ]);
  });

  it("creates sankey generated steps as overview plus one step per unique node", () => {
    const model = createDiagramModel(
      ["sankey-beta", "Gateway,Settlement,100", "Gateway,Bank,20"].join("\n"),
      createTourContext("/tmp/diagram.mmd")
    );

    expect(createGeneratedSteps(model.elements, "Sankey Example").map((step) => step.text)).toEqual([
      "Overview of Sankey Example.",
      "Focus on Gateway.",
      "Focus on Settlement.",
      "Focus on Bank."
    ]);
  });

  it("fails on duplicate sequence ids", () => {
    expect(() =>
      createDiagramModel(
        ["sequenceDiagram", "  participant user as User", "  user->>user: [user] Recursive"].join(
          "\n"
        ),
        createTourContext("/tmp/diagram.mmd")
      )
    ).toThrow('Tour "/tmp/diagram.mmd": diagram contains duplicate Mermaid sequence id "user"');
  });

  it("resolves authored tour references into player-ready text and focus", () => {
    const resolved = resolveLoadedTour({
      context: createTourContext("/tmp/tour.tour.yaml"),
      diagramPath: "./diagram.mmd",
      diagramSource: "flowchart LR\n  api_gateway[API Gateway]",
      rawTour: {
        version: 1,
        title: "Valid Tour",
        diagram: "./diagram.mmd",
        steps: [
          {
            focus: ["api_gateway"],
            text: "Focus on {{api_gateway}}."
          }
        ]
      }
    });

    expect(resolved.steps).toEqual([
      {
        focus: [{ id: "api_gateway", kind: "node", label: "API Gateway" }],
        index: 1,
        text: "Focus on API Gateway."
      }
    ]);
  });

  it("resolves sankey authored references by visible label and picks first duplicate match", () => {
    const resolved = resolveLoadedTour({
      context: createTourContext("/tmp/tour.tour.yaml"),
      diagramPath: "./diagram.mmd",
      diagramSource: ["sankey-beta", "Gateway,Settlement,100", "Gateway,Bank,20"].join("\n"),
      rawTour: {
        version: 1,
        title: "Valid Tour",
        diagram: "./diagram.mmd",
        steps: [
          {
            focus: ["Gateway"],
            text: "Focus on {{Gateway}}."
          }
        ]
      }
    });

    expect(resolved.steps).toEqual([
      {
        focus: [{ id: "Gateway", kind: "node", label: "Gateway" }],
        index: 1,
        text: "Focus on Gateway."
      }
    ]);
  });

  it("indexes sankey labels when authored labels differ from internal ids", () => {
    const element = { id: "gateway__internal", kind: "node" as const, label: "Gateway" };
    const index = createElementIndex([element], "sankey");

    expect(index.get("gateway__internal")).toEqual(element);
    expect(index.get("Gateway")).toEqual(element);
  });
});
