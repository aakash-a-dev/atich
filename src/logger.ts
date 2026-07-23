import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "./session.js";

const LOG_FILE = path.join(CONFIG_DIR, "atich.log");

// Defaults on for now, so logs and chat messages interleave on screen until we
// decide on a better default — toggle with /debug.
let debugMode = true;

export function getLogFilePath(): string {
  return LOG_FILE;
}

export function isDebugMode(): boolean {
  return debugMode;
}

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function logToFile(line: string): void {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
}

// Some dependencies (e.g. libsignal) call console.error/warn directly, bypassing any
// logger we pass to Baileys — patching console is the only way to keep that off the
// default chat view while still capturing it for debugging.
export function initLogger(): void {
  (["log", "error", "warn", "info", "debug"] as const).forEach((name) => {
    const original = console[name].bind(console);
    console[name] = (...args: unknown[]) => {
      logToFile(`[${name}] ${args.map(String).join(" ")}`);
      if (debugMode) original(...args);
    };
  });
}
