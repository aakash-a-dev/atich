import type { ChatEvent } from "./types.js";
import { isDebugMode, logToFile } from "./logger.js";

export function nowStamp(): string {
  return new Date().toISOString().split("T")[1]!.replace("Z", "");
}

function humanLine(event: ChatEvent): string {
  switch (event.event) {
    case "msg":
      return `${event.from}: ${event.body}`;
    case "sent":
      return `you → ${event.to}: ${event.body}`;
    case "status":
      return `• ${event.body}`;
    case "contact":
      return event.body;
  }
}

export function emit(event: ChatEvent): void {
  logToFile(JSON.stringify(event));
  process.stdout.write((isDebugMode() ? JSON.stringify(event) : humanLine(event)) + "\n");
}

export function status(body: string): void {
  emit({ ts: nowStamp(), event: "status", body });
}
