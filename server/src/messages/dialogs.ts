export type MessageLike = {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  readAt: string | null;
};

export type DialogSummary = {
  peerId: number;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export function summarizeDialogs(currentUserId: number, messages: MessageLike[]): DialogSummary[] {
  const dialogs = new Map<number, DialogSummary>();

  for (const message of [...messages].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))) {
    const peerId = message.senderId === currentUserId ? message.recipientId : message.senderId;
    const existing = dialogs.get(peerId);
    if (!existing) {
      dialogs.set(peerId, {
        peerId,
        lastMessage: message.body,
        lastMessageAt: message.createdAt,
        unreadCount: 0
      });
    }

    if (message.recipientId === currentUserId && !message.readAt) {
      dialogs.get(peerId)!.unreadCount += 1;
    }
  }

  return [...dialogs.values()].sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
}
