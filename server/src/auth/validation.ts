import { z } from "zod";

export function normalizeNickname(value: string): string {
  return value.trim().toLowerCase();
}

export const registrationSchema = z.object({
  email: z.string().trim().email().max(254),
  nickname: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(128)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

export const profileSchema = z.object({
  nickname: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatarUrl: z.string().trim().url().max(1000).or(z.literal("")).optional(),
  bio: z.string().trim().max(280).optional(),
  password: z.string().min(6).max(128).optional()
});

export function validateRegistration(input: unknown) {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return parsed;
  }

  return registrationSchema.safeParse({
    ...parsed.data,
    nickname: normalizeNickname(parsed.data.nickname)
  });
}
