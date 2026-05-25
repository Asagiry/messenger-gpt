import { describe, expect, it } from "vitest";
import { summarizeDialogs } from "../src/messages/dialogs.js";

describe("dialog summaries", () => {
  it("sorts dialogs by newest message and marks unread incoming messages", () => {
    const dialogs = summarizeDialogs(1, [
      { id: 1, senderId: 2, recipientId: 1, body: "older unread", createdAt: "2026-05-25T10:00:00.000Z", readAt: null, editedAt: null },
      { id: 2, senderId: 1, recipientId: 3, body: "new sent", createdAt: "2026-05-25T12:00:00.000Z", readAt: null, editedAt: null },
      { id: 3, senderId: 4, recipientId: 1, body: "newest unread", createdAt: "2026-05-25T13:00:00.000Z", readAt: null, editedAt: null }
    ]);

    expect(dialogs.map((dialog) => dialog.peerId)).toEqual([4, 3, 2]);
    expect(dialogs[0]).toMatchObject({ lastMessage: "newest unread", unreadCount: 1 });
    expect(dialogs[1]).toMatchObject({ lastMessage: "new sent", unreadCount: 0 });
  });
});
