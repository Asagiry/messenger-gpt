import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.resolve(__dirname, "../../public/uploads");

export function extensionFromContentType(contentType: string) {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "image/png") return ".png";
  if (type === "image/jpeg" || type === "image/jpg") return ".jpg";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  throw new Error("Unsupported avatar image type");
}

export function publicUploadPath(filename: string) {
  return `/uploads/${filename}`;
}

export async function downloadAvatarToUploads(avatarUrl: string, userId: number) {
  if (!avatarUrl.trim()) {
    return "";
  }

  const parsed = new URL(avatarUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Avatar URL must be HTTP or HTTPS");
  }

  const response = await fetch(parsed);
  if (!response.ok) {
    throw new Error("Avatar download failed");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension = extensionFromContentType(contentType);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const maxBytes = 3 * 1024 * 1024;
  if (bytes.byteLength > maxBytes) {
    throw new Error("Avatar image is too large");
  }

  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `avatar-${userId}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  await fs.writeFile(path.join(uploadsDir, filename), bytes);
  return publicUploadPath(filename);
}
