import { expect, test, type Page } from "@playwright/test";

import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";
import { resolveSmokeServerPort } from "./smoke-port";

test.setTimeout(60_000);

test("ER statement boundaries and formatted roles retain native focus identities", async ({ page }, testInfo) => {
  const port = await resolveSmokeServerPort({ worktreePath: `${process.cwd()}-er-header-${testInfo.workerIndex}` });
  const tourPath = `${process.cwd()}/test/fixtures/entity-relationship/header-and-keywords.tour.yaml`;
  const server = await startDevServer({ args: [tourPath], port });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.locator('[data-testid="diagram-container"] .nodes .node')).toHaveCount(7);
    await verifyRelationshipSteps(page);
    await page.getByTestId("next-button").click();
    await verifyEntitySteps(page);
  } finally {
    await server.stop();
  }
});

async function verifyRelationshipSteps(page: Page): Promise<void> {
  await expectNativeRelationship({
    id: "relationship-a-to-b-header-relation-one-identifying-zero-or-more",
    ordinal: 0,
    page,
    role: "header relation",
    pattern: "solid",
    markerStart: "onlyOneStart",
    markerEnd: "zeroOrMoreEnd"
  });
  await page.getByTestId("next-button").click();
  await expectNativeRelationship({
    id: "relationship-a-to-b-metadata-relation-one-identifying-zero-or-more",
    ordinal: 1,
    page,
    role: "metadata relation",
    pattern: "solid",
    markerStart: "onlyOneStart",
    markerEnd: "zeroOrMoreEnd"
  });

  for (const [ordinal, id, role, markerEnd, pattern] of [
    [2, "relationship-a-to-b-owns-one-identifying-zero-or-more", "owns", "zeroOrMoreEnd", "solid"],
    [3, "relationship-a-to-b-owns-one-non-identifying-zero-or-more", "owns", "zeroOrMoreEnd", "dashed"],
    [4, "relationship-a-to-b-owns-one-non-identifying-one-or-more", "owns", "oneOrMoreEnd", "dashed"],
    [5, "relationship-a-to-b-owns-one-identifying-zero-or-more-2", "owns", "zeroOrMoreEnd", "solid"],
    [6, "relationship-a-to-b-owns-many-one-identifying-zero-or-more", "owns many", "zeroOrMoreEnd", "solid"],
    [7, "relationship-a-to-b-owns-many-one-identifying-zero-or-more-2", "owns", "zeroOrMoreEnd", "solid"]
  ] as const) {
    await page.getByTestId("next-button").click();
    await expectNativeRelationship({ id, ordinal, page, role, pattern, markerStart: "onlyOneStart", markerEnd });
  }
}

async function verifyEntitySteps(page: Page): Promise<void> {
  for (const id of ["attribute-b-name", "attribute-a-id-2", "attribute-a-id"]) {
    await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${id}"]`).first())
      .toHaveAttribute("data-focus-state", "focused");
  }
  await page.getByTestId("next-button").click();
  for (const id of ["click", "href", "subgraph", "end"]) {
    await expect(page.locator(`[data-testid="diagram-container"] [data-node-id="${id}"]`).first())
      .toHaveAttribute("data-focus-state", "focused");
  }
}

async function expectNativeRelationship(input: {
  id: string;
  markerEnd: string;
  markerStart: string;
  ordinal: number;
  page: Page;
  pattern: "dashed" | "solid";
  role: string;
}): Promise<void> {
  const { id, markerEnd, markerStart, ordinal, page, pattern, role } = input;
  const nativeId = `id_entity-A-0_entity-B-1_${ordinal}`;
  const path = page.locator(`[data-testid="diagram-container"] .relationshipLine[data-id="${nativeId}"]`);
  const label = page.locator(`[data-testid="diagram-container"] .edgeLabels .label[data-id="${nativeId}"]`);
  await expect(path).toHaveCount(1);
  await expect(path).toHaveAttribute("data-node-id", id);
  await expect(path).toHaveAttribute("data-focus-state", "focused");
  await expect(path).toHaveClass(new RegExp(`edge-pattern-${pattern}`));
  await expectNativeMarker(path, "marker-start", markerStart);
  await expectNativeMarker(path, "marker-end", markerEnd);
  await expect(label).toHaveAttribute("data-node-id", id);
  await expect(label).toContainText(role);
}

async function expectNativeMarker(
  path: ReturnType<Page["locator"]>,
  attribute: "marker-end" | "marker-start",
  suffix: string
): Promise<void> {
  await expect.poll(() => path.getAttribute(attribute)).toContain(suffix);
}
