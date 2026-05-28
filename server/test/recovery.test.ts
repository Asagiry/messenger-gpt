import { describe, expect, it } from "vitest";
import { createRecoveryToken, hashRecoveryToken, isRecoveryTokenExpired } from "../src/auth/recovery.js";

describe("password recovery tokens", () => {
  it("creates a temporary plain token and stores only a hashable value", () => {
    const token = createRecoveryToken();
    expect(token).toHaveLength(48);
    expect(hashRecoveryToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRecoveryToken(token)).toBe(hashRecoveryToken(token));
  });

  it("treats past expiry dates as expired", () => {
    expect(isRecoveryTokenExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isRecoveryTokenExpired(new Date(Date.now() + 1000))).toBe(false);
  });
});
