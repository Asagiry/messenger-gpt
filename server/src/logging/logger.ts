import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const logPath = path.join(projectRoot, "server.log");

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export async function logEvent(event: string, context: LogContext = {}) {
  const safeContext = Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));
  const line = JSON.stringify({
    at: new Date().toISOString(),
    event,
    ...safeContext
  });
  await fs.appendFile(logPath, `${line}\n`, "utf8").catch((error) => {
    console.error("Failed to write server log", error);
  });
}
