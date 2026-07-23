import readline from "node:readline";
import type { WASocket } from "@whiskeysockets/baileys";
import { emit, nowStamp, status } from "./render.js";
import { listContacts, searchContacts } from "./store.js";
import { pickContact } from "./picker.js";
import { isDebugMode, setDebugMode } from "./logger.js";

export interface ReplHooks {
  getSock: () => WASocket | undefined;
  login: () => Promise<string>;
  logout: () => Promise<string>;
}

export function startRepl({ getSock, login, logout }: ReplHooks): void {
  let activeJid: string | undefined;
  let activeName: string | undefined;
  let rl: readline.Interface;

  function attach(): void {
    rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on("line", (raw) => handleLine(raw.trim()));
  }

  function openContact(match: { jid: string; name: string }): void {
    activeJid = match.jid;
    activeName = match.name;
    status(`opened ${match.name}`);
  }

  function handleCommand(line: string): void {
    if (line === "/list") {
      const contacts = listContacts();
      if (!contacts.length) {
        status("no contacts yet");
        return;
      }
      status("↑/↓ to move, enter to select, esc to cancel");
      rl.close();
      pickContact(contacts).then((picked) => {
        attach();
        if (picked) {
          openContact(picked);
        } else {
          status("list cancelled");
        }
      });
      return;
    }

    if (line.startsWith("/open ")) {
      const query = line.slice("/open ".length).trim();
      if (!query) {
        status("usage: /open <name>");
        return;
      }
      const matches = searchContacts(query);
      if (!matches.length) {
        status(`no contact matching "${query}" — try /list`);
        return;
      }
      if (matches.length === 1) {
        openContact(matches[0]);
        return;
      }
      status("↑/↓ to move, enter to select, esc to cancel");
      rl.close();
      pickContact(matches).then((picked) => {
        attach();
        if (picked) {
          openContact(picked);
        } else {
          status("open cancelled");
        }
      });
      return;
    }

    if (line.startsWith("/search ")) {
      const query = line.slice("/search ".length).trim();
      if (!query) {
        status("usage: /search <name>");
        return;
      }
      const matches = searchContacts(query);
      if (!matches.length) {
        status(`no matches for "${query}"`);
        return;
      }
      status("↑/↓ to move, enter to select, esc to cancel");
      rl.close();
      pickContact(matches).then((picked) => {
        attach();
        if (picked) {
          openContact(picked);
        } else {
          status("search cancelled");
        }
      });
      return;
    }

    if (line === "/close" || line === "/leave") {
      if (!activeJid) {
        status("no active chat to close");
        return;
      }
      status(`closed ${activeName}`);
      activeJid = undefined;
      activeName = undefined;
      return;
    }

    if (line === "/logout") {
      activeJid = undefined;
      activeName = undefined;
      logout().then((msg) => status(msg));
      return;
    }

    if (line === "/login") {
      login().then((msg) => status(msg));
      return;
    }

    if (line === "/debug") {
      const next = !isDebugMode();
      setDebugMode(next);
      status(next ? "debug mode on — raw logs shown here" : "debug mode off — clean chat view");
      return;
    }

    if (line === "/quit" || line === "/exit") {
      process.exit(0);
      return;
    }

    status(`unknown command "${line}" — not sent as a message`);
  }

  function handleLine(line: string): void {
    if (!line) return;

    if (line.startsWith("/")) {
      handleCommand(line);
      return;
    }

    if (!activeJid) {
      status(`no active chat — use /open <name> or /search <name> first`);
      return;
    }

    const sock = getSock();
    if (!sock) {
      status("not connected yet — try again in a moment");
      return;
    }

    sock
      .sendMessage(activeJid, { text: line })
      .then(() => emit({ ts: nowStamp(), event: "sent", to: activeName, body: line }))
      .catch((err) => status(`send failed: ${(err as Error).message}`));
  }

  attach();
}
