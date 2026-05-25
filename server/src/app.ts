import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import type { RealtimeHub } from "./realtime/socket.js";
import { createApiRouter } from "./http/routes.js";
import { getConfig } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(realtime: RealtimeHub) {
  const app = express();

  app.use(cors({ origin: [getConfig().publicOrigin, "http://localhost:5173"], credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(realtime));

  const publicDir = path.resolve(__dirname, "../public");
  app.use(express.static(publicDir));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  });

  return app;
}
