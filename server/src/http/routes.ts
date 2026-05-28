import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { createAccessToken } from "../auth/tokens.js";
import { loginSchema, normalizeNickname, profileSchema, validateRegistration } from "../auth/validation.js";
import { createRecoveryToken, hashRecoveryToken, recoveryTokenExpiry } from "../auth/recovery.js";
import { getConfig } from "../config.js";
import { pool } from "../db/pool.js";
import {
  createPasswordResetToken,
  createUser,
  getUserByEmail,
  getUserById,
  searchUsers,
  updatePasswordWithResetToken,
  updateUserProfile,
  verifyUserPassword
} from "../users/repository.js";
import { createMessage, deleteMessage, editMessage, listDialogs, listMessages, markDialogRead } from "../messages/repository.js";
import { requireAuth, type AuthenticatedRequest } from "./auth-middleware.js";
import type { RealtimeHub } from "../realtime/socket.js";
import { downloadAvatarToUploads } from "../users/avatar-storage.js";
import { logEvent } from "../logging/logger.js";

const messageBodySchema = z.object({ body: z.string().trim().min(1).max(4000) });
const deleteSchema = z.object({ mode: z.enum(["me", "both"]).default("me") });
const recoveryRequestSchema = z.object({ email: z.string().trim().email().max(254) });
const recoveryResetSchema = z.object({ token: z.string().trim().min(16), password: z.string().min(6).max(128) });

export function createApiRouter(realtime: RealtimeHub): Router {
  const router = express.Router();

  router.post("/auth/register", async (request, response, next) => {
    try {
      const parsed = validateRegistration(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Invalid registration data", details: parsed.error.flatten() });
        return;
      }
      const user = await createUser(pool, parsed.data);
      await logEvent("auth.register.success", { userId: user.id, email: user.email ?? parsed.data.email });
      const token = createAccessToken({ userId: user.id, nickname: user.nickname }, getConfig().jwtSecret);
      response.status(201).json({ user, token });
    } catch (error: any) {
      if (error?.code === "23505") {
        await logEvent("auth.register.conflict", { email: request.body?.email ?? null });
        response.status(409).json({ error: "Email or nickname is already taken" });
        return;
      }
      next(error);
    }
  });

  router.post("/auth/login", async (request, response, next) => {
    try {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        await logEvent("auth.login.invalid_payload", { email: request.body?.email ?? null });
        response.status(400).json({ error: "Invalid login data" });
        return;
      }
      const user = await verifyUserPassword(pool, parsed.data.email, parsed.data.password);
      if (!user) {
        await logEvent("auth.login.failed", { email: parsed.data.email });
        response.status(401).json({ error: "Invalid email or password" });
        return;
      }
      await logEvent("auth.login.success", { userId: user.id, email: user.email ?? parsed.data.email });
      const token = createAccessToken({ userId: user.id, nickname: user.nickname }, getConfig().jwtSecret);
      response.json({ user, token });
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/logout", requireAuth, (_request, response) => {
    response.status(204).send();
  });

  router.post("/auth/recovery/request", async (request, response, next) => {
    try {
      const parsed = recoveryRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Valid email is required" });
        return;
      }

      const user = await getUserByEmail(pool, parsed.data.email, true);
      if (!user) {
        await logEvent("auth.recovery.request.unknown_email", { email: parsed.data.email });
        response.json({ ok: true });
        return;
      }

      const recoveryToken = createRecoveryToken();
      await createPasswordResetToken(pool, user.id, hashRecoveryToken(recoveryToken), recoveryTokenExpiry());
      await logEvent("auth.recovery.request.created", { userId: user.id, email: user.email ?? parsed.data.email });
      response.json({ ok: true, recoveryToken });
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/recovery/reset", async (request, response, next) => {
    try {
      const parsed = recoveryResetSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Valid recovery token and password are required" });
        return;
      }

      const user = await updatePasswordWithResetToken(pool, hashRecoveryToken(parsed.data.token), parsed.data.password);
      if (!user) {
        await logEvent("auth.recovery.reset.failed");
        response.status(400).json({ error: "Invalid or expired recovery token" });
        return;
      }

      await logEvent("auth.recovery.reset.success", { userId: user.id, email: user.email ?? null });
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (request, response, next) => {
    try {
      const user = await getUserById(pool, (request as AuthenticatedRequest).user.id, true);
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", requireAuth, async (request, response, next) => {
    try {
      const parsed = profileSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Invalid profile data", details: parsed.error.flatten() });
        return;
      }
      const input = {
        ...parsed.data,
        nickname: parsed.data.nickname ? normalizeNickname(parsed.data.nickname) : undefined,
        avatarUrl: parsed.data.avatarUrl
          ? await downloadAvatarToUploads(parsed.data.avatarUrl, (request as AuthenticatedRequest).user.id)
          : parsed.data.avatarUrl
      };
      const user = await updateUserProfile(pool, (request as AuthenticatedRequest).user.id, input);
      await logEvent("user.profile.updated", {
        userId: (request as AuthenticatedRequest).user.id,
        changedPassword: Boolean(parsed.data.password),
        changedAvatar: parsed.data.avatarUrl !== undefined
      });
      response.json({ user });
    } catch (error: any) {
      if (error?.code === "23505") {
        response.status(409).json({ error: "Nickname is already taken" });
        return;
      }
      if (error instanceof Error && error.message.toLowerCase().includes("avatar")) {
        response.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/users", requireAuth, async (request, response, next) => {
    try {
      await logEvent("users.search", {
        userId: (request as AuthenticatedRequest).user.id,
        query: String(request.query.search ?? "")
      });
      const users = await searchUsers(pool, (request as AuthenticatedRequest).user.id, String(request.query.search ?? ""));
      response.json({ users });
    } catch (error) {
      next(error);
    }
  });

  router.get("/users/:id", requireAuth, async (request, response, next) => {
    try {
      const user = await getUserById(pool, Number(request.params.id));
      if (!user) {
        response.status(404).json({ error: "User not found" });
        return;
      }
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dialogs", requireAuth, async (request, response, next) => {
    try {
      const dialogs = await listDialogs(pool, (request as AuthenticatedRequest).user.id);
      response.json({ dialogs: dialogs.map((dialog) => ({ ...dialog, online: realtime.isOnline(dialog.peerId) })) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/messages/:peerId", requireAuth, async (request, response, next) => {
    try {
      const before = request.query.before ? Number(request.query.before) : undefined;
      const limit = Math.min(Number(request.query.limit ?? 30), 50);
      const messages = await listMessages(pool, (request as AuthenticatedRequest).user.id, Number(request.params.peerId), before, limit);
      response.json({ messages });
    } catch (error) {
      next(error);
    }
  });

  router.post("/messages/:peerId", requireAuth, async (request, response, next) => {
    try {
      const parsed = messageBodySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Message body is required" });
        return;
      }
      const senderId = (request as AuthenticatedRequest).user.id;
      const message = await createMessage(pool, senderId, Number(request.params.peerId), parsed.data.body);
      await logEvent("message.created", { senderId, recipientId: Number(request.params.peerId), messageId: message.id });
      realtime.emitMessage(message);
      response.status(201).json({ message });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/messages/:id", requireAuth, async (request, response, next) => {
    try {
      const parsed = messageBodySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Message body is required" });
        return;
      }
      const message = await editMessage(pool, (request as AuthenticatedRequest).user.id, Number(request.params.id), parsed.data.body);
      if (!message) {
        response.status(404).json({ error: "Message not found" });
        return;
      }
      realtime.emitMessageUpdated(message);
      response.json({ message });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/messages/:id", requireAuth, async (request, response, next) => {
    try {
      const parsed = deleteSchema.safeParse(request.body ?? {});
      const message = await deleteMessage(pool, (request as AuthenticatedRequest).user.id, Number(request.params.id), parsed.success ? parsed.data.mode : "me");
      if (!message) {
        response.status(404).json({ error: "Message not found" });
        return;
      }
      realtime.emitMessageUpdated(message);
      response.json({ message });
    } catch (error) {
      next(error);
    }
  });

  router.post("/messages/:peerId/read", requireAuth, async (request, response, next) => {
    try {
      const messages = await markDialogRead(pool, (request as AuthenticatedRequest).user.id, Number(request.params.peerId));
      realtime.emitMessagesRead((request as AuthenticatedRequest).user.id, Number(request.params.peerId), messages.map((message) => message.id));
      response.json({ messages });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
