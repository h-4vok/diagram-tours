import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const packageRoot = resolve(root, "packages/web-player");
const stagingDir = await mkdtemp(resolve(tmpdir(), "diagram-tours-template-"));
const templatePayload = {
  version: 1,
  collection: {
    entries: [{
      slug: "template",
      sourcePath: "template.tour.yaml",
      title: "Template",
      tour: {
        sourceKind: "generated",
        version: 1,
        title: "Template",
        diagram: {
          elements: [{ id: "node", kind: "node", label: "Node" }],
          path: "template.mmd",
          source: "flowchart TD\n  node[Node]",
          type: "flowchart"
        },
        steps: [{
          focus: [{ id: "node", kind: "node", label: "Node" }],
          index: 1,
          text: "Template step"
        }]
      }
    }],
    skipped: []
  }
};

try {
  await writeFile(resolve(stagingDir, "tours-data.json"), JSON.stringify(templatePayload));
  const command = process.platform === "win32" ? "bun.cmd" : "bun";
  await execFileAsync(command, ["run", "build:static"], {
    cwd: packageRoot,
    env: {
      ...process.env,
      DIAGRAM_TOUR_STATIC_OUT: resolve(packageRoot, "build-static"),
      DIAGRAM_TOUR_STATIC_DATA: resolve(stagingDir, "tours-data.json"),
      DIAGRAM_TOUR_SOURCE_TARGET: resolve(root, "examples"),
      PUBLIC_DIAGRAM_TOUR_STATIC: "true"
    },
    shell: true
  });
} finally {
  await rm(stagingDir, { recursive: true, force: true });
}
