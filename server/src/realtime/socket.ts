import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { getConfig } from "../config.js";
import { readAccessToken } from "../auth/tokens.js";
import type { Message } from "../messages/repository.js";

export type RealtimeHub = {
  isOnline(userId: number): boolean;
  emitMessage(message: Message): void;
  emitMessageUpdated(message: Message): void;
  emitMessagesRead(readerId: number, peerId: number, messageIds: number[]): void;
};

export function attachRealtime(httpServer: HttpServer): RealtimeHub {
  const io = new Server(httpServer, {
    cors: {
      origin: [getConfig().publicOrigin, "http://localhost:5173"],
      credentials: true
    }
  });
  const socketsByUser = new Map<number, Set<string>>();

  function userRoom(userId: number) {
    return `user:${userId}`;
  }

  function setOnline(userId: number, socketId: string) {
    const sockets = socketsByUser.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    socketsByUser.set(userId, sockets);
    io.emit("presence:update", { userId, online: true });
  }

  function setOffline(userId: number, socketId: string) {
    const sockets = socketsByUser.get(userId);
    if (!sockets) {
      return;
    }
    sockets.delete(socketId);
    if (sockets.size === 0) {
      socketsByUser.delete(userId);
      io.emit("presence:update", { userId, online: false });
    }
  }

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (typeof token !== "string") {
        next(new Error("Authentication required"));
        return;
      }
      const user = readAccessToken(token, getConfig().jwtSecret);
      socket.data.userId = user.userId;
      socket.data.nickname = user.nickname;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = Number(socket.data.userId);
    socket.join(userRoom(userId));
    setOnline(userId, socket.id);

    socket.on("typing:start", ({ peerId }: { peerId: number }) => {
      socket.to(userRoom(peerId)).emit("typing:update", { userId, typing: true });
    });

    socket.on("typing:stop", ({ peerId }: { peerId: number }) => {
      socket.to(userRoom(peerId)).emit("typing:update", { userId, typing: false });
    });

    socket.on("disconnect", () => {
      setOffline(userId, socket.id);
    });
  });

  return {
    isOnline(userId: number) {
      return socketsByUser.has(userId);
    },
    emitMessage(message: Message) {
      io.to(userRoom(message.senderId)).to(userRoom(message.recipientId)).emit("message:new", { message });
    },
    emitMessageUpdated(message: Message) {
      io.to(userRoom(message.senderId)).to(userRoom(message.recipientId)).emit("message:update", { message });
    },
    emitMessagesRead(readerId: number, peerId: number, messageIds: number[]) {
      io.to(userRoom(readerId)).to(userRoom(peerId)).emit("messages:read", { readerId, peerId, messageIds });
    }
  };
}
