import bcrypt from "bcryptjs";
import { pool } from "./pool.js";
import { migrate } from "./migrate.js";

const seedUsers = [
  ["mira@example.com", "mira", "123456", "https://i.pravatar.cc/160?img=5", "Product-minded and fast to reply."],
  ["leo@example.com", "leo", "123456", "https://i.pravatar.cc/160?img=12", "Backend engineer. Usually online."],
  ["nina@example.com", "nina", "qwerty", "https://i.pravatar.cc/160?img=20", "Design notes, coffee, and clean threads."],
  ["igor@example.com", "igor", "123456", "https://i.pravatar.cc/160?img=33", "DevOps and deployment windows."],
  ["sofia@example.com", "sofia", "qwerty", "https://i.pravatar.cc/160?img=47", "Keeps the team moving."],
  ["max@example.com", "max", "123456", "https://i.pravatar.cc/160?img=56", "Frontend polish and bug hunts."],
  ["alisa@example.com", "alisa", "alisa", "https://i.pravatar.cc/160?img=25", "QA with sharp notes."],
  ["dan@example.com", "dan", "dan123", "https://i.pravatar.cc/160?img=14", "Always testing edge cases."],
  ["vera@example.com", "vera", "123456", "https://i.pravatar.cc/160?img=31", "Writes concise specs."],
  ["tim@example.com", "tim", "qwerty", "https://i.pravatar.cc/160?img=61", "Likes short messages."]
] as const;

const seedMessages = [
  ["mira", "leo", "Hey Leo, did the VM check pass?"],
  ["leo", "mira", "Yes. Node, npm, Postgres, and PM2 are ready."],
  ["mira", "nina", "Can you review the messenger layout later?"],
  ["nina", "mira", "Send me the first build and I will look at spacing."],
  ["igor", "mira", "Port 80 is free on the server."],
  ["mira", "igor", "Great, I will bind Express directly there."],
  ["sofia", "max", "The chat list needs unread state."],
  ["max", "sofia", "I will make it visible but quiet."],
  ["alisa", "mira", "Seed users are useful for smoke testing."],
  ["mira", "alisa", "Agreed. I added ten accounts."]
] as const;

export async function seed() {
  await migrate();
  await pool.query("TRUNCATE password_reset_tokens, messages, users RESTART IDENTITY CASCADE");

  const ids = new Map<string, number>();
  for (const [email, nickname, password, avatarUrl, bio] of seedUsers) {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query<{ id: number }>(
      `INSERT INTO users(email, nickname, password_hash, avatar_url, bio)
       VALUES($1, $2, $3, $4, $5)
       RETURNING id`,
      [email, nickname, passwordHash, avatarUrl, bio]
    );
    ids.set(nickname, result.rows[0].id);
  }

  let offset = seedMessages.length;
  for (const [sender, recipient, body] of seedMessages) {
    await pool.query(
      `INSERT INTO messages(sender_id, recipient_id, body, created_at, delivered_at)
       VALUES($1, $2, $3, NOW() - ($4 || ' minutes')::interval, NOW())`,
      [ids.get(sender), ids.get(recipient), body, offset * 12]
    );
    offset -= 1;
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  seed()
    .then(async () => {
      console.log("Database seeded with users and chat history.");
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
