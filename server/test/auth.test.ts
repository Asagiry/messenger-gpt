import { describe, expect, it } from "vitest";
import { createAccessToken, readAccessToken } from "../src/auth/tokens.js";
import { normalizeNickname, validateRegistration } from "../src/auth/validation.js";

describe("auth validation", () => {
  it("normalizes nicknames and rejects weak registration payloads", () => {
    expect(normalizeNickname("  MiRa  ")).toBe("mira");
    const result = validateRegistration({ email: "bad", nickname: "ab", password: "123" });
    expect(result.success).toBe(false);
  });

  it("creates access tokens that resolve back to the authenticated user", () => {
    const token = createAccessToken({ userId: 42, nickname: "mira" }, "test-secret", "15m");
    expect(readAccessToken(token, "test-secret")).toEqual({ userId: 42, nickname: "mira" });
  });
});
