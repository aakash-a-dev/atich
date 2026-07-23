#!/usr/bin/env node
import makeWASocket, {
  ALL_WA_PATCH_NAMES,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import { pino } from "pino";
import fs from "node:fs";
import { ensureSessionDir, SESSION_DIR } from "./session.js";
import { emit, nowStamp, status } from "./render.js";
import { clearContacts, listContacts, loadContacts, upsertContact } from "./store.js";
import { startRepl } from "./repl.js";
import { printBanner } from "./banner.js";
import { initLogger } from "./logger.js";

const logger = pino({ level: "silent" });

let currentSock: WASocket | undefined;

async function connect() {
  ensureSessionDir();
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  status("connecting to whatsapp");

  const sock = makeWASocket({
    auth: state,
    logger,
    syncFullHistory: false,
    shouldSyncHistoryMessage: (msg) =>
      msg.syncType !== proto.Message.HistorySyncNotification.HistorySyncType.FULL,
    version,
    browser: Browsers.macOS("Desktop"),
    connectTimeoutMs: 45_000,
    appStateMacVerification: { patch: true, snapshot: true },
  });
  currentSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      status("scan the QR above with WhatsApp > Linked devices");
    }

    if (connection === "open") {
      status("connected");
      // WhatsApp's app-state sync only sends patches since our last known version, so if
      // we have no cached contacts, our local version checkpoint must be reset first —
      // otherwise the server has nothing new to send and contacts.upsert never fires.
      const resync = listContacts().length
        ? sock.resyncAppState(ALL_WA_PATCH_NAMES, false)
        : Promise.resolve(
            state.keys.set({
              "app-state-sync-version": Object.fromEntries(
                ALL_WA_PATCH_NAMES.map((name) => [name, null])
              ),
            })
          ).then(() => sock.resyncAppState(ALL_WA_PATCH_NAMES, true));
      resync.catch((err: Error) => status(`contact sync failed: ${err.message}`));
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const reason = lastDisconnect?.error?.message ?? "unknown reason";
      if (loggedOut) {
        currentSock = undefined;
        status("logged out — use /login to pair again");
      } else {
        status(`connection closed (${reason}), reconnecting`);
        connect().catch((err) => status(`fatal: ${(err as Error).message}`));
      }
    }
  });

  sock.ev.on("messaging-history.set", (data) => {
    console.error(`[HISTORY.SET] ${data.contacts.length} contacts from history, syncType=${data.syncType}, progress=${data.progress}`);
    for (const c of data.contacts) {
      if (!c.id) continue;
      upsertContact(c.id, c.name || c.notify || c.id);
    }
  });

  sock.ev.on("contacts.upsert", (contacts) => {
    console.error(`[CONTACTS.UPSERT] ${contacts.length} contacts`);
    for (const c of contacts) {
      console.error(`  -> ${c.id} name="${c.name}" notify="${c.notify}"`);
      upsertContact(c.id, c.name || c.notify || c.id);
    }
  });

  sock.ev.on("contacts.update", (updates) => {
    console.error(`[CONTACTS.UPDATE] ${updates.length} updates`);
    for (const c of updates) {
      if (!c.id) continue;
      upsertContact(c.id, c.name || c.notify || c.id);
    }
  });

  sock.ev.on("messages.upsert", ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || !msg.key.remoteJid) continue;

      const jid = msg.key.remoteJid;
      const name = msg.pushName || jid;
      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "[non-text message]";

      upsertContact(jid, name);

      if (msg.key.fromMe) {
        emit({ ts: nowStamp(), event: "sent", to: name, body });
      } else {
        emit({ ts: nowStamp(), event: "msg", from: name, body });
      }
    }
  });
}

async function doLogin(): Promise<string> {
  if (currentSock) return "already connected — /logout first";
  connect().catch((err) => status(`fatal: ${(err as Error).message}`));
  return "logging in — scan the QR if shown";
}

async function doLogout(): Promise<string> {
  if (!currentSock) return "not connected";
  try {
    await currentSock.logout();
  } catch {
    // best effort — proceed to wipe local state regardless
  }
  currentSock = undefined;
  clearContacts();
  fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  return "logged out — use /login to pair again";
}

printBanner();
ensureSessionDir();
initLogger();
loadContacts();

connect().catch((err) => {
  status(`fatal: ${(err as Error).message}`);
  process.exit(1);
});

startRepl({ getSock: () => currentSock, login: doLogin, logout: doLogout });
