import { describe, expect, it } from "vitest";
import { decodeConversationExport, encodeConversationExport } from "../src/historyExport";
import type { Message } from "../src/types";

describe("conversation export", () => {
  it("round-trips messages through a base64 serialized JSON string", () => {
    const messages: Message[] = [
      {
        id: 1,
        senderId: 2,
        recipientId: 3,
        body: "hello",
        createdAt: "2026-05-28T10:00:00.000Z",
        editedAt: null,
        deliveredAt: null,
        readAt: null,
        deletedForAllAt: null
      }
    ];

    const encoded = encodeConversationExport({ peerId: 3, messages });
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decodeConversationExport(encoded)).toEqual({ peerId: 3, messages });
  });
});
