const HELP = `Usage: diagram-tours <command> [options]

Commands:
  serve [target]       Serve a diagram, tour, or directory (default: current directory)
  setup                Create repository-local authoring guidance
  init <target>        Create an authored tour scaffold
  validate [target]    Validate authored tours
  help                 Show this help

Run "diagram-tours help serve" for serve options.
`;

const SERVE_HELP = `Usage: diagram-tours serve [target] [options]

Serve a diagram, authored tour, or directory. Without a target, serves the current directory.

Options:
  --host <value>       Bind to host
  --port <value>       Use an explicit port
  --open               Open browser after startup
  --no-open            Do not open browser
`;

export function writeHelp(topic: "serve" | null): void {
  process.stdout.write(topic === "serve" ? SERVE_HELP : HELP);
}
