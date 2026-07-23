import { homedir } from "node:os";
import path from "node:path";
import fs from "node:fs";

export const CONFIG_DIR = path.join(homedir(), ".config", "atich");
export const SESSION_DIR = path.join(CONFIG_DIR, "session");

export function ensureSessionDir(): void {
  fs.mkdirSync(SESSION_DIR, { recursive: true, mode: 0o700 });
}
