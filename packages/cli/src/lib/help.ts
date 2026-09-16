const HELP = `Usage: diagram-tours <command> [options]

Commands:
  serve [target]       Serve a diagram, tour, or directory (default: current directory)
  build [target]       Build a static site (default output: dist)
  setup                Create repository-local authoring guidance
  init <target>        Create an authored tour scaffold
  validate [target]    Validate authored tours
  help                 Show this help

Run "diagram-tours help serve" or "diagram-tours help build" for options.
`;

const SERVE_HELP = `Usage: diagram-tours serve [target] [options]

Serve a diagram, authored tour, or directory. Without a target, serves the current directory.

Options:
  --host <value>       Bind to host
  --port <value>       Use an explicit port
  --open               Open browser after startup
  --no-open            Do not open browser
`;

const BUILD_HELP = `Usage: diagram-tours build [target] [options]

Build a static site. Without a target, builds the current directory.

Options:
  --out <path>        Output directory (default: dist)
  --overwrite         Replace existing output directory
  --continue          Build despite invalid tours
  --quiet             Silence validation warnings
  --verbose           Print validation details
  --open              Open generated index.html
  --no-open           Do not open generated site
`;

export function writeHelp(topic: "serve" | "build" | null): void {
  process.stdout.write(topic === "serve" ? SERVE_HELP : topic === "build" ? BUILD_HELP : HELP);
}
