export type BrowserPreference = "always" | "never" | "prompt";

export type StartupMode = "direct" | "validate" | "version" | "wizard";

export interface ParsedCliArgs {
  browser: BrowserPreference;
  hasExplicitTarget: boolean;
  host: string;
  mode: StartupMode;
  port: number | null;
  target: string | null;
  targets: string[];
}

export interface ResolvedLaunchOptions {
  browser: Exclude<BrowserPreference, "prompt">;
  host: string;
  port: number | null;
  target: string;
}

export interface ServerBinding {
  host: string;
  port: number;
}
