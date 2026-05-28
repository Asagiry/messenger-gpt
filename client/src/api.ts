import type { Dialog, Message, User } from "./types";

const TOKEN_KEY = "gpt-messenger-token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token = getStoredToken()): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(payload.error ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  login(input: { email: string; password: string }) {
    return request<{ user: User; token: string }>("/auth/login", { method: "POST", body: JSON.stringify(input) }, null);
  },
  register(input: { email: string; nickname: string; password: string }) {
    return request<{ user: User; token: string }>("/auth/register", { method: "POST", body: JSON.stringify(input) }, null);
  },
  requestPasswordRecovery(input: { email: string }) {
    return request<{ ok: boolean; recoveryToken?: string }>("/auth/recovery/request", { method: "POST", body: JSON.stringify(input) }, null);
  },
  resetPassword(input: { token: string; password: string }) {
    return request<{ ok: boolean }>("/auth/recovery/reset", { method: "POST", body: JSON.stringify(input) }, null);
  },
  me() {
    return request<{ user: User }>("/me");
  },
  updateProfile(input: { nickname?: string; avatarUrl?: string; bio?: string; password?: string }) {
    return request<{ user: User }>("/me", { method: "PUT", body: JSON.stringify(input) });
  },
  users(search: string) {
    return request<{ users: User[] }>(`/users?search=${encodeURIComponent(search)}`);
  },
  user(id: number) {
    return request<{ user: User }>(`/users/${id}`);
  },
  dialogs() {
    return request<{ dialogs: Dialog[] }>("/dialogs");
  },
  messages(peerId: number, before?: number) {
    const query = before ? `?before=${before}` : "";
    return request<{ messages: Message[] }>(`/messages/${peerId}${query}`);
  },
  sendMessage(peerId: number, body: string) {
    return request<{ message: Message }>(`/messages/${peerId}`, { method: "POST", body: JSON.stringify({ body }) });
  },
  editMessage(messageId: number, body: string) {
    return request<{ message: Message }>(`/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ body }) });
  },
  deleteMessage(messageId: number, mode: "me" | "both") {
    return request<{ message: Message }>(`/messages/${messageId}`, { method: "DELETE", body: JSON.stringify({ mode }) });
  },
  markRead(peerId: number) {
    return request<{ messages: Message[] }>(`/messages/${peerId}/read`, { method: "POST" });
  }
};
