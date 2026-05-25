import { io, type Socket } from "socket.io-client";
import type { Message } from "./types";

export type SocketEvents = {
  onMessage(message: Message): void;
  onMessageUpdate(message: Message): void;
  onRead(payload: { readerId: number; peerId: number; messageIds: number[] }): void;
  onPresence(payload: { userId: number; online: boolean }): void;
  onTyping(payload: { userId: number; typing: boolean }): void;
};

export function createSocket(token: string, events: SocketEvents): Socket {
  const socket = io({
    auth: { token },
    transports: ["websocket", "polling"]
  });

  socket.on("message:new", ({ message }: { message: Message }) => events.onMessage(message));
  socket.on("message:update", ({ message }: { message: Message }) => events.onMessageUpdate(message));
  socket.on("messages:read", events.onRead);
  socket.on("presence:update", events.onPresence);
  socket.on("typing:update", events.onTyping);

  return socket;
}
