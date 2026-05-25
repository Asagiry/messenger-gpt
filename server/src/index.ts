import http from "node:http";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";
import { attachRealtime } from "./realtime/socket.js";

const server = http.createServer();
const realtime = attachRealtime(server);
const app = createApp(realtime);

server.on("request", app);
server.listen(getConfig().port, "0.0.0.0", () => {
  console.log(`Messenger server listening on port ${getConfig().port}`);
});
