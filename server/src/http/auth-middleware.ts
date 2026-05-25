import type { NextFunction, Request, Response } from "express";
import { getConfig } from "../config.js";
import { readAccessToken } from "../auth/tokens.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: number;
    nickname: string;
  };
};

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = readAccessToken(token, getConfig().jwtSecret);
    (request as AuthenticatedRequest).user = { id: user.userId, nickname: user.nickname };
    next();
  } catch {
    response.status(401).json({ error: "Invalid or expired token" });
  }
}
