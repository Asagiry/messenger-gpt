import bcrypt from "bcryptjs";
import type { DbPool } from "../db/pool.js";

export type PublicUser = {
  id: number;
  email?: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
};

type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  nickname: string;
  avatar_url: string;
  bio: string;
  created_at: Date;
};

export function toPublicUser(row: UserRow, includeEmail = false): PublicUser {
  return {
    id: row.id,
    ...(includeEmail ? { email: row.email } : {}),
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    createdAt: row.created_at.toISOString()
  };
}

export async function createUser(db: DbPool, input: { email: string; nickname: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const result = await db.query<UserRow>(
    `INSERT INTO users(email, nickname, password_hash)
     VALUES($1, $2, $3)
     RETURNING *`,
    [input.email.toLowerCase(), input.nickname, passwordHash]
  );
  return toPublicUser(result.rows[0], true);
}

export async function verifyUserPassword(db: DbPool, email: string, password: string) {
  const result = await db.query<UserRow>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return null;
  }
  return toPublicUser(user, true);
}

export async function getUserById(db: DbPool, userId: number, includeEmail = false) {
  const result = await db.query<UserRow>("SELECT * FROM users WHERE id = $1", [userId]);
  return result.rows[0] ? toPublicUser(result.rows[0], includeEmail) : null;
}

export async function searchUsers(db: DbPool, currentUserId: number, search = "") {
  const result = await db.query<UserRow>(
    `SELECT * FROM users
     WHERE id <> $1 AND nickname ILIKE $2
     ORDER BY nickname ASC
     LIMIT 30`,
    [currentUserId, `%${search}%`]
  );
  return result.rows.map((row) => toPublicUser(row));
}

export async function updateUserProfile(
  db: DbPool,
  userId: number,
  input: { nickname?: string; avatarUrl?: string; bio?: string; password?: string }
) {
  const current = await getUserById(db, userId, true);
  if (!current) {
    return null;
  }

  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null;
  const result = await db.query<UserRow>(
    `UPDATE users
     SET nickname = COALESCE($2, nickname),
         avatar_url = COALESCE($3, avatar_url),
         bio = COALESCE($4, bio),
         password_hash = COALESCE($5, password_hash),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [userId, input.nickname, input.avatarUrl, input.bio, passwordHash]
  );
  return toPublicUser(result.rows[0], true);
}
