export type User = {
  id: number;
  email?: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
};

export type Dialog = {
  peerId: number;
  nickname: string;
  avatarUrl: string;
  bio: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  online: boolean;
};

export type Message = {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  deletedForAllAt: string | null;
};
