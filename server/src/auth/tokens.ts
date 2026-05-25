import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

export type TokenUser = {
  userId: number;
  nickname: string;
};

export function createAccessToken(user: TokenUser, secret: string, expiresIn: SignOptions["expiresIn"] = "7d"): string {
  return jwt.sign({ nickname: user.nickname }, secret, {
    subject: String(user.userId),
    expiresIn
  });
}

export function readAccessToken(token: string, secret: string): TokenUser {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== "object" || !decoded.sub || typeof decoded.nickname !== "string") {
    throw new Error("Invalid token payload");
  }

  return {
    userId: Number(decoded.sub),
    nickname: decoded.nickname
  };
}
