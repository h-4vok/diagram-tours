import { expect, test, type Page } from "@playwright/test";

import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("Mermaid 11.13 ER syntax maps metadata, inline attributes, and native edge identities", async ({ page }, testInfo) => {
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-er-syntax-${testInfo.workerIndex}` });
  const tourPath = `${process.cwd()}/test/fixtures/entity-relationship/mermaid-syntax-regression.tour.yaml`;
  const server = await startDevServer({ args: [tourPath], port });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.locator('[data-testid="diagram-container"] .nodes .node')).toHaveCount(12);
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="X"], [data-testid="diagram-container"] [data-node-id="Y"]'))
      .toHaveCount(0);
    await expectFocused(page, "A");
    await expect(page.getByTestId("step-text")).toContainText("First");
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id="J"]')).toContainText("J");
    await expect(page.locator('[data-testid="diagram-container"] [data-node-id^="relationship-a-to-a-earlier-loop"]'))
      .toHaveCount(0);

    await page.getByTestId("next-button").click();
    await expectFocused(page, "attribute-a-id-2");
    await expectFocused(page, "attribute-a-id-3");
    await expectFocused(page, "attribute-a-tags");
    await expectFocused(page, "attribute-a-pk-id");
    await expectFocused(page, "attribute-a-prenom");
    await expectFocused(page, "attribute-a-name");
    await expectFocused(page, "attribute-a-codes");
    await expectFocused(page, "attribute-a-code");
    await expectFocused(page, "attribute-a-note");
    await expectFocused(page, "attribute-h-id");

    for (const [step, id, role, source, target, renderOrder, pattern, nativeIds, markerStart, markerEnd] of [
      [2, "relationship-a-to-b-owns-one-identifying-zero-or-more", "owns", "entity-A-0", "entity-B-3", 0, "solid", ["id_entity-A-0_entity-B-3_0"], "onlyOneStart", "zeroOrMoreEnd"],
      [3, "relationship-a-to-b-owns-one-identifying-zero-or-more-2", "owns", "entity-A-0", "entity-B-3", 1, "solid", ["id_entity-A-0_entity-B-3_1"], "onlyOneStart", "zeroOrMoreEnd"],
      [4, "relationship-a-to-b-optional-link-one-non-identifying-zero-or-more", "optional link", "entity-A-0", "entity-B-3", 2, "dashed", ["id_entity-A-0_entity-B-3_2"], "onlyOneStart", "zeroOrMoreEnd"],
      [5, "relationship-a-to-c-extends-unknown-identifying-one", "extends", "entity-A-0", "entity-C-4", 3, "solid", ["id_entity-A-0_entity-C-4_3"], null, "onlyOneEnd"],
      [6, "relationship-a-to-b-dotted-link-one-non-identifying-one-or-more", "dotted link", "entity-A-0", "entity-B-3", 4, "dashed", ["id_entity-A-0_entity-B-3_4"], "onlyOneStart", "oneOrMoreEnd"],
      [7, "relationship-a-to-a-latest-loop-one-identifying-zero-or-more", "latest loop", "entity-A-0", "entity-A-0", 6, "solid", ["entity-A-0-cyclic-special-1", "entity-A-0-cyclic-special-mid", "entity-A-0-cyclic-special-2"], "onlyOneStart", "zeroOrMoreEnd"],
      [8, "relationship-a-to-b-follows-loops-one-identifying-zero-or-more", "follows loops", "entity-A-0", "entity-B-3", 7, "solid", ["id_entity-A-0_entity-B-3_7"], "onlyOneStart", "zeroOrMoreEnd"]
      , [9, "relationship-a-to-b-see-x-o-y-one-identifying-zero-or-more", "see X ||--o{ Y", "entity-A-0", "entity-B-3", 8, "solid", ["id_entity-A-0_entity-B-3_8"], "onlyOneStart", "zeroOrMoreEnd"]
      , [10, "relationship-a-to-b-later-one-identifying-zero-or-more", "later", "entity-A-0", "entity-B-3", 9, "solid", ["id_entity-A-0_entity-B-3_9"], "onlyOneStart", "zeroOrMoreEnd"]
      , [11, "relationship-a-to-b-after-block-one-non-identifying-zero-or-more", "after block", "entity-A-0", "entity-B-3", 10, "dashed", ["id_entity-A-0_entity-B-3_10"], "onlyOneStart", "zeroOrMoreEnd"]
    ] as const) {
      await page.getByTestId("next-button").click();
      await expect(page).toHaveURL(new RegExp(`/mermaid-syntax-regression\\?step=${step + 1}$`));
      await expectFocused(page, id);
      await expectNativeRelationshipPair({
        id,
        markerEnd,
        markerStart,
        nativeIds,
        page,
        pattern,
        renderOrder,
        role,
        sourceNativeId: source,
        targetNativeId: target
      });
      if (id === "relationship-a-to-b-later-one-identifying-zero-or-more") {
        await expectFocused(page, "NEXT");
        await expectFocused(page, "attribute-next-code");
      }
    }

    await page.getByTestId("next-button").click();
    await expectFocused(page, "attribute-a-id");
    await page.getByTestId("next-button").click();
    await expectFocused(page, "relationship-k-to-l-follows-block-one-identifying-zero-or-more");
    await expectFocused(page, "K");
    await expectFocused(page, "attribute-k-id");
    const path = page.locator('[data-testid="diagram-container"] .relationshipLine[data-node-id="relationship-k-to-l-follows-block-one-identifying-zero-or-more"]');
    const nativeIds = await path.evaluateAll((paths) => paths.map((candidate) => candidate.getAttribute("data-id")));
    const sourceNativeId = await page.locator('[data-testid="diagram-container"] [data-node-id="K"]').getAttribute("id");
    const targetNativeId = await page.locator('[data-testid="diagram-container"] [data-node-id="L"]').getAttribute("id");
    expect(nativeIds).toEqual([`id_${sourceNativeId}_${targetNativeId}_11`]);
    await expectNativeRelationshipPair({
      id: "relationship-k-to-l-follows-block-one-identifying-zero-or-more",
      markerEnd: "zeroOrMoreEnd",
      markerStart: "onlyOneStart",
      nativeIds: [`id_${sourceNativeId}_${targetNativeId}_11`],
      page,
      pattern: "solid",
      renderOrder: 11,
      role: "follows block",
      sourceNativeId: sourceNativeId!,
      targetNativeId: targetNativeId!
    });
  } finally {
    await server.stop();
  }
});

async function expectFocused(page: Page, id: string): Promise<void> {
  await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${id}"]`).first()).toHaveAttribute(
    "data-focus-state",
    "focused"
  );
}

async function expectNativeRelationshipPair(input: {
  id: string;
  markerEnd: string | null;
  markerStart: string | null;
  nativeIds: readonly string[];
  page: Page;
  pattern: string;
  renderOrder: number;
  role: string;
  sourceNativeId: string;
  targetNativeId: string;
}): Promise<void> {
  const { id, markerEnd, markerStart, nativeIds, page, pattern, renderOrder, role, sourceNativeId, targetNativeId } = input;
  const path = page.locator(`[data-testid="diagram-container"] .relationshipLine[data-node-id="${id}"]`);
  await expect(path).toHaveCount(nativeIds.length);
  const actualIds = await path.evaluateAll((paths) => paths.map((candidate) => candidate.getAttribute("data-id")));
  expect(actualIds).toEqual(expect.arrayContaining(nativeIds));
  expectNativeOrdinal({ nativeIds, renderOrder, sourceNativeId, targetNativeId });
  await expect(path.first()).toHaveClass(new RegExp(`edge-pattern-${pattern}`));
  if (sourceNativeId === targetNativeId) {
    await expectSelfLoopMarkers({ id, markerEnd, markerStart, nativeIds, page });
  } else {
    await expectNativeMarkerPair({ markerEnd, markerStart, target: path.first() });
  }
  const nativeEdgeId = readNativeRelationshipLabelId(sourceNativeId, targetNativeId, nativeIds);
  const label = page.locator(
    `[data-testid="diagram-container"] .edgeLabels .label[data-id="${nativeEdgeId}"]`
  );
  await expect(label).toHaveAttribute("data-node-id", id);
  await expect(label).toContainText(role);
}

function expectNativeOrdinal(input: {
  nativeIds: readonly string[];
  renderOrder: number;
  sourceNativeId: string;
  targetNativeId: string;
}): void {
  const { nativeIds, renderOrder, sourceNativeId, targetNativeId } = input;
  if (sourceNativeId !== targetNativeId) {
    expect(nativeIds).toEqual([`id_${sourceNativeId}_${targetNativeId}_${renderOrder}`]);
  }
}

function readNativeRelationshipLabelId(sourceNativeId: string, targetNativeId: string, nativeIds: readonly string[]): string {
  return sourceNativeId === targetNativeId
    ? `${sourceNativeId}-cyclic-special-mid`
    : nativeIds[0]!;
}

async function expectSelfLoopMarkers(input: {
  id: string;
  markerEnd: string | null;
  markerStart: string | null;
  nativeIds: readonly string[];
  page: Page;
}): Promise<void> {
  const { id, markerEnd, markerStart, nativeIds, page } = input;
  const selector = `[data-testid="diagram-container"] .relationshipLine[data-node-id="${id}"]`;
  await expectNativeMarkerPair({ markerEnd: null, markerStart, target: page.locator(`${selector}[data-id="${nativeIds[0]}"]`) });
  await expectNativeMarkerPair({ markerEnd: null, markerStart: null, target: page.locator(`${selector}[data-id="${nativeIds[1]}"]`) });
  await expectNativeMarkerPair({ markerEnd, markerStart: null, target: page.locator(`${selector}[data-id="${nativeIds[2]}"]`) });
}

async function expectNativeMarkerPair(input: {
  markerEnd: string | null;
  markerStart: string | null;
  target: ReturnType<Page["locator"]>;
}): Promise<void> {
  const { markerEnd, markerStart, target } = input;
  const actual = await target.evaluate(readNativeMarkerReferences);
  expectMarkerSuffix(actual.start, markerStart);
  expectMarkerSuffix(actual.end, markerEnd);
}

function expectMarkerSuffix(actual: string | null, expected: string | null): void {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }
  expect(actual).toContain(expected);
}

function readNativeMarkerReferences(path: Element): { end: string | null; start: string | null } {
  const markerStart = path.getAttribute("marker-start");
  const markerEnd = path.getAttribute("marker-end");
  return {
    end: markerEnd === null ? null : markerEnd.slice(markerEnd.indexOf("#") + 1, -1),
    start: markerStart === null ? null : markerStart.slice(markerStart.indexOf("#") + 1, -1)
  };
}
