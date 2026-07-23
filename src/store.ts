import fs from "node:fs";
import path from "node:path";
import type { Contact } from "./types.js";
import { nowStamp } from "./render.js";
import { SESSION_DIR } from "./session.js";

const CONTACTS_FILE = path.join(SESSION_DIR, "contacts.json");

const contacts = new Map<string, Contact>();

export function loadContacts(): void {
  try {
    const saved: Contact[] = JSON.parse(fs.readFileSync(CONTACTS_FILE, "utf8"));
    for (const c of saved) contacts.set(c.jid, c);
  } catch {
    // no cache yet
  }
}

function persist(): void {
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify([...contacts.values()]));
}

export function upsertContact(jid: string, name: string): void {
  contacts.set(jid, { jid, name: name || jid, lastSeen: nowStamp() });
  persist();
}

export function clearContacts(): void {
  contacts.clear();
  persist();
}

export function listContacts(): Contact[] {
  return [...contacts.values()].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}

export function searchContacts(query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listContacts().filter(
    (c) => c.name.toLowerCase().includes(q) || c.jid.toLowerCase().includes(q)
  );
}
