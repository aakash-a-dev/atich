# Atich

A terminal WhatsApp client that renders every message as a structured JSON
event, like tailing a webhook/queue consumer log — not a chat UI.

```
{"ts":"14:22:03.912","event":"msg","from":"john.d","body":"hey are you free later"}
{"ts":"14:22:41.204","event":"sent","to":"john.d","body":"yeah give me 10"}
```

## Install

As a global CLI from npm:

```
npm install -g atich
atich
```

Or without installing, via `npx`:

```
npx atich
```

Or from source:

```
git clone https://github.com/aakash-a-dev/atich.git
cd atich
npm install
npm run build
npm start
```

On first run it prints a QR code — scan it from WhatsApp on your phone under
**Linked devices**. The session is saved to `~/.config/atich/session` so you
won't need to re-scan on later runs.

## Usage

Once connected, the process streams incoming/outgoing messages, one line per
event. By default this shows raw JSON plus internal diagnostics
(`/debug` toggles a clean `Name: message` view instead). Type into the same
terminal to send:

- `/list` — show every known contact; ↑/↓ to move, **Enter** to open, **Esc**
  to cancel. Populated by actively pulling your WhatsApp app-state
  (`sock.resyncAppState`) right after connecting, plus anyone who messages you
  or you message. Only shows contacts saved in your phone's address book that
  are also on WhatsApp, not arbitrary WhatsApp users.
- `/open <name or number fragment>` — open a contact directly; if more than
  one matches, the same ↑/↓ picker as `/list` opens to disambiguate.
- `/search <name or number fragment>` — same as `/open`, but always opens the
  picker even for a single match.
- `/close` (alias `/leave`) — deactivate the current chat without quitting.
- `/debug` — toggle between the raw event/diagnostic view and a clean,
  human-readable chat view. Everything is logged to
  `~/.config/atich/atich.log` regardless of this setting.
- `/logout` — unlink this device from WhatsApp and clear the local session.
- `/login` — reconnect and re-pair (prompts a fresh QR code) after `/logout`.
- anything else — sent as a message to the active chat
- `/quit` (alias `/exit`) — exit

## Testing

**Run this from your own laptop's regular network, not a cloud VM/CI/sandbox
environment.** WhatsApp's servers reject WebSocket handshakes from known
datacenter/hosting-provider IP ranges as a bot-mitigation measure — this
shows up as an immediate `"connection closed (Connection Failure)"` before
the QR code ever appears, and no code change fixes it. It's an IP-reputation
check on WhatsApp's side, not a bug in this client.

To verify end to end:

1. `npm start` on your laptop → a QR code should print within a few seconds.
2. Scan it from WhatsApp → **Linked devices** on your phone.
3. Confirm `{"event":"status","body":"connected"}` appears.
4. Send yourself (or have someone send you) a WhatsApp message — confirm a
   `{"event":"msg", ...}` line appears.
5. Run `/list`, then `/open <name>`, then type a message — confirm it arrives
   on the recipient's phone and a `{"event":"sent", ...}` line prints locally.

## Notes

- Contacts arrive via an actively-triggered app-state resync
  (`sock.resyncAppState`), not by passively waiting for WhatsApp to send a
  history-sync notification — the latter often never arrives on a reconnect
  to an already-linked session, which is why contacts could come up empty
  even minutes after connecting in earlier versions of this client.
- Uses [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys),
  an unofficial WhatsApp Web protocol implementation. This is not an official
  WhatsApp client — accounts using unofficial clients can occasionally be
  flagged or temporarily restricted by WhatsApp.
- Pinned to the `6.7.23` "legacy" line (CommonJS-era predecessor patched for
  the message-spoofing advisory GHSA-qvv5-jq5g-4cgg). `7.x` is the actively
  developed line if you want to track upstream more closely later.
- No message history is persisted to disk beyond the current process's
  in-memory contact list — restarting loses the `/list` cache (not the
  WhatsApp session itself).
