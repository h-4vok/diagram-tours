import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { loadResolvedTour } from "../src/authored-tour-loader.js";
import { createDiagramModel, resolveLoadedTour } from "../src/diagram-model.js";
import { createMindmapDiagramModel } from "../src/mindmap-diagram-model.js";
import { createTourContext } from "../src/tour-context.js";

describe("Mindmap diagram model", () => {
  it("extracts source IDs and derives keys from the complete parent path", () => {
    const source = [
      "mindmap",
      "  plan((Release plan))",
      "    research[Customer research]",
      "      Interview users",
      "      Define needs",
      "    design(Design the solution)",
      "      prototype{{Prototype}}",
      "    Measure adoption"
    ].join("\n");

    expect(createDiagramModel(source, createTourContext("/tmp/mindmap.mmd"))).toMatchObject({
      type: "mindmap",
      renderSource: source,
      elements: [
        { id: "plan", kind: "node", label: "Release plan" },
        { id: "research", kind: "node", label: "Customer research" },
        { id: "mindmap-plan-research-interview-users", kind: "node", label: "Interview users" },
        { id: "mindmap-plan-research-define-needs", kind: "node", label: "Define needs" },
        { id: "design", kind: "node", label: "Design the solution" },
        { id: "prototype", kind: "node", label: "Prototype" },
        { id: "mindmap-plan-measure-adoption", kind: "node", label: "Measure adoption" }
      ]
    });
  });

  it("uses relative indentation and parent paths for unshaped labels", () => {
    const model = createMindmapDiagramModel(["mindmap", " Root ", "      A", "  B", "      C"].join("\n"));

    expect(model.elements.map(({ id }) => id)).toEqual([
      "mindmap-root",
      "mindmap-root-a",
      "mindmap-root-b",
      "mindmap-root-b-c"
    ]);
  });

  it("does not detect a mindmap from a flowchart node or frontmatter title", () => {
    expect(
      createDiagramModel("flowchart LR\n  mindmap[Mindmap]\n  mindmap --> todo[To do]", createTourContext("/tmp/flowchart.mmd"))
    ).toMatchObject({ type: "flowchart" });
    expect(
      createDiagramModel("---\ntitle: |\n  mindmap\n---\nflowchart LR\n  A --> B", createTourContext("/tmp/flowchart.mmd"))
    ).toMatchObject({ type: "flowchart" });
    expect(
      createDiagramModel("%%{\n  init: {\n    theme: 'default'\n  }\n}%%\nmindmap Root\n  Child", createTourContext("/tmp/mindmap.mmd"))
    ).toMatchObject({
      type: "mindmap",
      elements: [
        { id: "mindmap-root", label: "Root" },
        { id: "mindmap-root-child", label: "Child" }
      ]
    });
  });

  it("detects only the first Mermaid header in source order", () => {
    expect(
      createDiagramModel("flowchart LR\n  mindmap\n  mindmap --> todo[To do]", createTourContext("/tmp/flowchart.mmd"))
    ).toMatchObject({ type: "flowchart" });
    expect(
      createDiagramModel("mindmap %% my tree\n  Root\n    Child", createTourContext("/tmp/mindmap.mmd"))
    ).toMatchObject({
      type: "mindmap",
      elements: [
        { id: "mindmap-root", label: "Root" },
        { id: "mindmap-root-child", label: "Child" }
      ]
    });
    expect(
      createDiagramModel("mindmap root((Root))\n    Child", createTourContext("/tmp/mindmap.mmd"))
    ).toMatchObject({
      type: "mindmap",
      elements: [
        { id: "root", label: "Root" },
        { id: "mindmap-root-child", label: "Child" }
      ]
    });
    expect(
      createDiagramModel("\uFEFFmindmap\n  Root\n    Child", createTourContext("/tmp/mindmap.mmd"))
    ).toMatchObject({ type: "mindmap" });
    expect(
      createDiagramModel('mindmap root["100%% complete"]\n    Child', createTourContext("/tmp/mindmap.mmd"))
    ).toMatchObject({
      type: "mindmap",
      elements: [
        { id: "root", label: "100%% complete" },
        { id: "mindmap-root-child", label: "Child" }
      ]
    });
  });

  it("disambiguates repeated siblings and carries the disambiguated path to children", () => {
    const model = createMindmapDiagramModel(["mindmap", " Root", "   A", "   A", "     B"].join("\n"));

    expect(model.elements.map(({ id }) => id)).toEqual([
      "mindmap-root",
      "mindmap-root-a",
      "mindmap-root-a-2",
      "mindmap-root-a-2-b"
    ]);
  });

  it("extracts every Mermaid mindmap shape and keeps emoji in the topic label", () => {
    const model = createMindmapDiagramModel([
      "mindmap",
      "  square[Square]",
      "  round(Rounded)",
      "  circle((Circle))",
      "  hex{{Hexagon}}",
      "  cloud)Cloud(",
      "  altCloud(-Cloud-)",
      "  bang))Bang((",
      "  seed[🌱 Plant strategy]",
      '  quote["Label with (parentheses) and [brackets]"]'
    ].join("\n"));

    expect(model.elements).toEqual([
      { id: "square", kind: "node", label: "Square" },
      { id: "round", kind: "node", label: "Rounded" },
      { id: "circle", kind: "node", label: "Circle" },
      { id: "hex", kind: "node", label: "Hexagon" },
      { id: "cloud", kind: "node", label: "Cloud" },
      { id: "altCloud", kind: "node", label: "Cloud-" },
      { id: "bang", kind: "node", label: "Bang" },
      { id: "seed", kind: "node", label: "🌱 Plant strategy" },
      { id: "quote", kind: "node", label: "Label with (parentheses) and [brackets]" }
    ]);
  });

  it("ignores frontmatter, comments, and icon/class decoration lines", () => {
    const source = [
      "---",
      "config:",
      "  layout: tidy-tree",
      "---",
      "mindmap",
      "  Root",
      "    A",
      "    ::icon(fa fa-book)",
      "    :::urgent large",
      "    %% TODO (priority list",
      "    B"
    ].join("\n");

    expect(createMindmapDiagramModel(source).elements.map(({ label }) => label)).toEqual([
      "Root",
      "A",
      "B"
    ]);
  });

  it("keeps indented metadata-like topics and merges multiline Markdown labels", () => {
    const model = createMindmapDiagramModel([
      "mindmap",
      "  Root",
      "    Title screen",
      "    title: A readable title",
      "    accTitle: A readable title",
      "    accDescr: A readable description",
      '    detail["`A **bold**',
      '      second line`"]',
      '    item id["`Square label',
      '      with space ID`"]',
      '    tagged["first [tag]',
      '      second line"]',
      '    round("`Round label',
      '      across two lines`")',
      "    unquoted[First line",
      "      across two lines]",
      "    ---",
      '    snake["`snake_case`"]',
      "    Next"
    ].join("\n"));

    expect(model.elements).toEqual([
      { id: "mindmap-root", kind: "node", label: "Root" },
      { id: "mindmap-root-title-screen", kind: "node", label: "Title screen" },
      { id: "mindmap-root-title-a-readable-title", kind: "node", label: "title: A readable title" },
      { id: "mindmap-root-acc-title-a-readable-title", kind: "node", label: "accTitle: A readable title" },
      { id: "mindmap-root-acc-descr-a-readable-description", kind: "node", label: "accDescr: A readable description" },
      { id: "detail", kind: "node", label: "A bold second line" },
      { id: "item id", kind: "node", label: "Square label with space ID" },
      { id: "tagged", kind: "node", label: "first [tag] second line" },
      { id: "round", kind: "node", label: "Round label across two lines" },
      { id: "unquoted", kind: "node", label: "First line across two lines" },
      { id: "mindmap-root-topic", kind: "node", label: "---" },
      { id: "snake", kind: "node", label: "snake_case" },
      { id: "mindmap-root-next", kind: "node", label: "Next" }
    ]);
  });

  it("removes multiline Mermaid directives before reading mindmap topic nodes", () => {
    const model = createMindmapDiagramModel([
      "%%{",
      "  init: {",
      "    theme: 'default'",
      "  }",
      "}%%",
      "mindmap",
      "  Root",
      "    Next"
    ].join("\n"));

    expect(model.elements.map(({ id }) => id)).toEqual(["mindmap-root", "mindmap-root-next"]);
  });

  it("treats accessibility-like text in the diagram body as focusable topics", () => {
    const model = createMindmapDiagramModel("mindmap\naccTitle: Topic root\n    Child");

    expect(model.elements).toEqual([
      { id: "mindmap-acc-title-topic-root", kind: "node", label: "accTitle: Topic root" },
      { id: "mindmap-acc-title-topic-root-child", kind: "node", label: "Child" }
    ]);
  });

  it("disambiguates duplicate explicit IDs and IDs that already use a numeric suffix", () => {
    const model = createMindmapDiagramModel([
      "mindmap",
      "  Root",
      "    item[First]",
      "    item[Second]",
      "    item-2[Named suffix]",
      "    item[Third]"
    ].join("\n"));

    expect(model.elements.map(({ id }) => id)).toEqual([
      "mindmap-root",
      "item",
      "item-2",
      "item-2-2",
      "item-3"
    ]);
  });

  it("resolves authored focus and label references for derived mindmap targets", () => {
    const source = ["mindmap", "  plan((Release plan))", "    Research", "      Interviews"].join("\n");
    const resolved = resolveLoadedTour({
      context: createTourContext("/tmp/release-plan.tour.yaml"),
      diagramPath: "/tmp/release-plan.mmd",
      diagramSource: source,
      rawTour: {
        version: 1,
        title: "Release plan",
        diagram: "./release-plan.mmd",
        steps: [
          {
            focus: ["mindmap-plan-research-interviews"],
            text: "The next step is {{mindmap-plan-research-interviews}}."
          }
        ]
      }
    });

    expect(resolved.steps[0]).toMatchObject({
      focus: [{ id: "mindmap-plan-research-interviews", label: "Interviews" }],
      text: "The next step is Interviews."
    });
  });

  it("reports actionable diagnostics for unknown topic keys", () => {
    expect(() =>
      resolveLoadedTour({
        context: createTourContext("/tmp/release-plan.tour.yaml"),
        diagramPath: "/tmp/release-plan.mmd",
        diagramSource: "mindmap\n  Root",
        rawTour: {
          version: 1,
          title: "Release plan",
          diagram: "./release-plan.mmd",
          steps: [{ focus: ["missing-topic"], text: "A step." }]
        }
      })
    ).toThrow('references unknown Mermaid mindmap topic key "missing-topic"');
  });

  it("loads the shared web-player mindmap fixture pair through the authored parser", async () => {
    const tour = await loadResolvedTour(
      resolve(process.cwd(), "../web-player/test/fixtures/mindmap/release-plan.tour.yaml")
    );

    expect(tour.diagram.type).toBe("mindmap");
    expect(tour.steps.map((step) => step.focus[0]?.id)).toEqual([
      "plan",
      "research",
      "mindmap-plan-research-interviews",
      "validation",
      "design",
      "prototype",
      "mindmap-plan-measure-adoption",
      "outcomes"
    ]);
    expect(tour.diagram.source).toContain("  plan((Release plan))");
  });

  it("returns no targets for empty diagrams and ignores empty shaped labels", () => {
    expect(createMindmapDiagramModel("mindmap\n  empty[]")).toMatchObject({
      type: "mindmap",
      elements: []
    });
    expect(createMindmapDiagramModel("mindmap\n  []").elements).toEqual([
      { id: "mindmap-topic", kind: "node", label: "[]" }
    ]);
  });

  it("uses a stable fallback for non-word topics and malformed shapes", () => {
    const model = createMindmapDiagramModel(["mindmap", "  Root", "    🌱", "    [unclosed"].join("\n"));

    expect(model.elements.map(({ id, label }) => [id, label])).toEqual([
      ["mindmap-root", "Root"],
      ["mindmap-root-topic", "🌱"],
      ["mindmap-root-unclosed", "[unclosed"]
    ]);
  });
});
