import type { Message } from "./types";

export type ConversationExport = {
  peerId: number;
  messages: Message[];
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeConversationExport(exportData: ConversationExport) {
  const json = JSON.stringify(exportData);
  return bytesToBase64(new TextEncoder().encode(json));
}

export function decodeConversationExport(value: string): ConversationExport {
  const json = new TextDecoder().decode(base64ToBytes(value.trim()));
  const parsed = JSON.parse(json) as ConversationExport;
  if (!Number.isFinite(parsed.peerId) || !Array.isArray(parsed.messages)) {
    throw new Error("Invalid conversation export");
  }
  return parsed;
}
