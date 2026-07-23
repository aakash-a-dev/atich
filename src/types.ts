export interface ChatEvent {
  ts: string;
  event: "msg" | "sent" | "status" | "contact";
  from?: string;
  to?: string;
  body: string;
}

export interface Contact {
  jid: string;
  name: string;
  lastSeen: string;
}
