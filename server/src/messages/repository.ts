import type { DbPool } from "../db/pool.js";

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

type MessageRow = {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  created_at: Date;
  edited_at: Date | null;
  delivered_at: Date | null;
  read_at: Date | null;
  deleted_for_all_at: Date | null;
};

export type DialogRow = {
  peerId: number;
  nickname: string;
  avatarUrl: string;
  bio: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.deleted_for_all_at ? "Message deleted" : row.body,
    createdAt: row.created_at.toISOString(),
    editedAt: iso(row.edited_at),
    deliveredAt: iso(row.delivered_at),
    readAt: iso(row.read_at),
    deletedForAllAt: iso(row.deleted_for_all_at)
  };
}

export async function listDialogs(db: DbPool, userId: number): Promise<DialogRow[]> {
  const result = await db.query<{
    peer_id: number;
    nickname: string;
    avatar_url: string;
    bio: string;
    last_message: string;
    last_message_at: Date;
    unread_count: string;
  }>(
    `WITH visible_messages AS (
       SELECT *,
         CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS peer_id
       FROM messages
       WHERE (sender_id = $1 AND deleted_for_sender_at IS NULL)
          OR (recipient_id = $1 AND deleted_for_recipient_at IS NULL)
     ),
     ranked AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY peer_id ORDER BY created_at DESC, id DESC) AS rank
       FROM visible_messages
     )
     SELECT r.peer_id, u.nickname, u.avatar_url, u.bio,
       CASE WHEN r.deleted_for_all_at IS NULL THEN r.body ELSE 'Message deleted' END AS last_message,
       r.created_at AS last_message_at,
       COALESCE(unread.count, 0) AS unread_count
     FROM ranked r
     JOIN users u ON u.id = r.peer_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count FROM visible_messages vm
       WHERE vm.peer_id = r.peer_id AND vm.recipient_id = $1 AND vm.read_at IS NULL AND vm.deleted_for_all_at IS NULL
     ) unread ON TRUE
     WHERE r.rank = 1
     ORDER BY r.created_at DESC, r.id DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    peerId: row.peer_id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at.toISOString(),
    unreadCount: Number(row.unread_count)
  }));
}

export async function listMessages(db: DbPool, userId: number, peerId: number, before?: number, limit = 30) {
  const result = await db.query<MessageRow>(
    `SELECT * FROM messages
     WHERE ((sender_id = $1 AND recipient_id = $2 AND deleted_for_sender_at IS NULL)
       OR (sender_id = $2 AND recipient_id = $1 AND deleted_for_recipient_at IS NULL))
       AND ($3::integer IS NULL OR id < $3)
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [userId, peerId, before ?? null, limit]
  );
  return result.rows.map(toMessage).reverse();
}

export async function createMessage(db: DbPool, senderId: number, recipientId: number, body: string) {
  const result = await db.query<MessageRow>(
    `INSERT INTO messages(sender_id, recipient_id, body, delivered_at)
     VALUES($1, $2, $3, NOW())
     RETURNING *`,
    [senderId, recipientId, body]
  );
  return toMessage(result.rows[0]);
}

export async function editMessage(db: DbPool, userId: number, messageId: number, body: string) {
  const result = await db.query<MessageRow>(
    `UPDATE messages
     SET body = $3, edited_at = NOW()
     WHERE id = $1 AND sender_id = $2 AND deleted_for_all_at IS NULL
     RETURNING *`,
    [messageId, userId, body]
  );
  return result.rows[0] ? toMessage(result.rows[0]) : null;
}

export async function deleteMessage(db: DbPool, userId: number, messageId: number, mode: "me" | "both") {
  const result = await db.query<MessageRow>(
    `UPDATE messages
     SET deleted_for_all_at = CASE WHEN $3 = 'both' AND sender_id = $2 THEN NOW() ELSE deleted_for_all_at END,
         deleted_for_sender_at = CASE WHEN sender_id = $2 THEN NOW() ELSE deleted_for_sender_at END,
         deleted_for_recipient_at = CASE WHEN recipient_id = $2 THEN NOW() ELSE deleted_for_recipient_at END
     WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)
     RETURNING *`,
    [messageId, userId, mode]
  );
  return result.rows[0] ? toMessage(result.rows[0]) : null;
}

export async function markDialogRead(db: DbPool, userId: number, peerId: number) {
  const result = await db.query<MessageRow>(
    `UPDATE messages
     SET read_at = COALESCE(read_at, NOW())
     WHERE recipient_id = $1 AND sender_id = $2 AND deleted_for_all_at IS NULL
     RETURNING *`,
    [userId, peerId]
  );
  return result.rows.map(toMessage);
}
