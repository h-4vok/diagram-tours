export type BrowserPreference = "always" | "never" | "prompt";

export type StartupMode = "direct" | "version" | "wizard";

export interface ParsedStartupArgs {
  browser: BrowserPreference;
  hasExplicitTarget: boolean;
  host: string;
  mode: StartupMode;
  port: number | null;
  target: string | null;
}

export interface ParsedSetupArgs {
  agent: "default" | "none" | "prompt";
  agentPath: string | null;
  overwrite: boolean;
}

export interface ParsedValidateArgs {
  target: string | null;
}

export interface ParsedInitArgs {
  overwrite: boolean;
  target: string;
}

export interface PromptIo {
  question(prompt: string): Promise<string>;
  write(text: string): void;
}

export type ParsedCliArgs =
  | { command: "init"; options: ParsedInitArgs }
  | { command: "setup"; options: ParsedSetupArgs }
  | { command: "startup"; options: ParsedStartupArgs }
  | { command: "validate"; options: ParsedValidateArgs }
  | { command: "version" };

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
