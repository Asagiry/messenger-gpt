import { describe, expect, it } from "vitest";
import { extensionFromContentType, publicUploadPath } from "../src/users/avatar-storage.js";

describe("avatar local storage helpers", () => {
  it("maps supported image content types to safe file extensions", () => {
    expect(extensionFromContentType("image/png")).toBe(".png");
    expect(extensionFromContentType("image/jpeg")).toBe(".jpg");
    expect(extensionFromContentType("image/webp")).toBe(".webp");
  });

  it("returns a browser-visible upload path", () => {
    expect(publicUploadPath("avatar-1.png")).toBe("/uploads/avatar-1.png");
  });
});
