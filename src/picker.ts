import readline from "node:readline";
import type { Contact } from "./types.js";
import { nowStamp } from "./render.js";
import { isDebugMode } from "./logger.js";

function renderLine(c: Contact, selected: boolean): string {
  const line = isDebugMode()
    ? JSON.stringify({ ts: nowStamp(), event: "result", name: c.name, jid: c.jid })
    : `${selected ? "❯" : " "} ${c.name}`;
  return selected ? `\x1b[7m${line}\x1b[0m` : line;
}

export function pickContact(matches: Contact[]): Promise<Contact | null> {
  const items = matches;

  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(items[0] ?? null);
      return;
    }

    let idx = 0;

    const print = () => {
      items.forEach((c, i) => process.stdout.write(renderLine(c, i === idx) + "\n"));
    };

    const redraw = () => {
      process.stdout.write(`\x1b[${items.length}A`);
      items.forEach((c, i) => process.stdout.write(`\x1b[2K${renderLine(c, i === idx)}\n`));
    };

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(false);
    };

    const onKeypress = (_str: string, key: readline.Key) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(0);
      } else if (key.name === "up") {
        idx = (idx - 1 + items.length) % items.length;
        redraw();
      } else if (key.name === "down") {
        idx = (idx + 1) % items.length;
        redraw();
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(items[idx] ?? null);
      } else if (key.name === "escape") {
        cleanup();
        resolve(null);
      }
    };

    print();
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    // repl.ts calls rl.close() before opening the picker, which pauses stdin — and an
    // explicit pause isn't undone by merely adding a new listener, so resume it here.
    process.stdin.resume();
    process.stdin.on("keypress", onKeypress);
  });
}
