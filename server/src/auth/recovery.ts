import crypto from "node:crypto";

export function createRecoveryToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashRecoveryToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function recoveryTokenExpiry() {
  return new Date(Date.now() + 1000 * 60 * 30);
}

export function isRecoveryTokenExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}
