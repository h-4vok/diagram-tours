import { expect, test, type Page } from "@playwright/test";
import { expectDiagramVisible } from "./smoke-test-helpers";
import { startDevServer } from "./dev-server";

test("generated fallback tours focus expanded flowchart node syntaxes", async ({ page }) => {
  const server = await startDevServer({
    args: ["./packages/web-player/smoke/fixtures/flowchart-addressability.mmd"],
    port: 4194
  });

  try {
    await page.goto(server.baseUrl);
    await expectDiagramVisible(page);
    await expect(page.getByTestId("step-text-container")).toContainText(
      "Overview of Flowchart Addressability."
    );

    await expectGeneratedStep({ baseUrl: server.baseUrl, label: "Decision", nodeId: "decision", page, stepIndex: 3 });
    await expectGeneratedStep({ baseUrl: server.baseUrl, label: "archive", nodeId: "archive", page, stepIndex: 4 });
    await expectGeneratedStep({ baseUrl: server.baseUrl, label: "Done", nodeId: "done", page, stepIndex: 8 });
  } finally {
    await server.stop();
  }
});

async function expectGeneratedStep(input: {
  baseUrl: string;
  label: string;
  nodeId: string;
  page: Page;
  stepIndex: number;
}): Promise<void> {
  await input.page.goto(`${input.baseUrl}/flowchart-addressability?step=${input.stepIndex}`);
  await expect(input.page.getByTestId("step-text-container")).toContainText(`Focus on ${input.label}.`);
  await expect(input.page.locator(`[data-testid="diagram-container"] [data-node-id="${input.nodeId}"]`)).toHaveAttribute(
    "data-focus-state",
    "focused"
  );
}
