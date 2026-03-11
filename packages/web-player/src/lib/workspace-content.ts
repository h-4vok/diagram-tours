export interface WorkspacePackage {
  name: string;
  description: string;
}

export const pageTitle = "Diagram Tour";
export const pageDescription = "Initial SvelteKit scaffold for the Diagram Tour web player.";

export const workspacePackages: WorkspacePackage[] = [
  {
    name: "core",
    description: "Shared domain model and future tour engine."
  },
  {
    name: "parser",
    description: "Mermaid and YAML parsing plus validation."
  },
  {
    name: "web-player",
    description: "Minimal SvelteKit app shell for future playback UI."
  }
];
