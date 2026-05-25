import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Edit3, LogOut, MessageCircle, Search, Send, Settings, Trash2, UserPlus, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { api, getStoredToken, storeToken } from "./api";
import { createSocket } from "./socket";
import type { Dialog, Message, User } from "./types";

type AuthMode = "login" | "register";

function avatar(user: Pick<User, "avatarUrl" | "nickname"> | Pick<Dialog, "avatarUrl" | "nickname">) {
  return user.avatarUrl || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.nickname)}`;
}

function time(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function App() {
  const [token, setToken] = useState(getStoredToken());
  const [me, setMe] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState("");
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [activePeer, setActivePeer] = useState<User | Dialog | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Message | null>(null);
  const [typingUser, setTypingUser] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activePeerId = activePeer?.id ?? (activePeer as Dialog | null)?.peerId;

  async function refreshDialogs() {
    const result = await api.dialogs();
    setDialogs(result.dialogs);
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    api.me()
      .then(({ user }) => {
        setMe(user);
        return Promise.all([refreshDialogs(), api.users("")]);
      })
      .then(([, directory]) => setUsers(directory.users))
      .catch(() => {
        storeToken(null);
        setToken(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = createSocket(token, {
      onMessage(message) {
        setMessages((current) => {
          if (!activePeerId || ![message.senderId, message.recipientId].includes(activePeerId)) {
            return current;
          }
          return current.some((item) => item.id === message.id) ? current : [...current, message];
        });
        refreshDialogs().catch(console.error);
      },
      onMessageUpdate(message) {
        setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
        refreshDialogs().catch(console.error);
      },
      onRead({ messageIds }) {
        setMessages((current) => current.map((message) => (messageIds.includes(message.id) ? { ...message, readAt: message.readAt ?? new Date().toISOString() } : message)));
        refreshDialogs().catch(console.error);
      },
      onPresence({ userId, online }) {
        setDialogs((current) => current.map((dialog) => (dialog.peerId === userId ? { ...dialog, online } : dialog)));
      },
      onTyping({ userId, typing }) {
        setTypingUser(typing ? userId : null);
      }
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, activePeerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activePeerId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!token) {
        return;
      }
      api.users(search).then(({ users }) => setUsers(users)).catch(console.error);
    }, 180);
    return () => window.clearTimeout(id);
  }, [search, token]);

  async function openPeer(peer: User | Dialog) {
    setActivePeer(peer);
    const peerId = "peerId" in peer ? peer.peerId : peer.id;
    const result = await api.messages(peerId);
    setMessages(result.messages);
    await api.markRead(peerId);
    await refreshDialogs();
  }

  async function loadOlder() {
    if (!activePeerId || messages.length === 0) {
      return;
    }
    const result = await api.messages(activePeerId, messages[0].id);
    setMessages((current) => [...result.messages, ...current]);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const payload = {
        email: String(data.get("email")),
        password: String(data.get("password")),
        nickname: String(data.get("nickname") ?? "")
      };
      const result = authMode === "login" ? await api.login(payload) : await api.register(payload);
      storeToken(result.token);
      setToken(result.token);
      setMe(result.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activePeerId || !draft.trim()) {
      return;
    }
    const text = draft.trim();
    setDraft("");
    socketRef.current?.emit("typing:stop", { peerId: activePeerId });
    if (editing) {
      const result = await api.editMessage(editing.id, text);
      setMessages((current) => current.map((message) => (message.id === editing.id ? result.message : message)));
      setEditing(null);
    } else {
      const result = await api.sendMessage(activePeerId, text);
      setMessages((current) => (current.some((message) => message.id === result.message.id) ? current : [...current, result.message]));
    }
    await refreshDialogs();
  }

  async function removeMessage(message: Message, mode: "me" | "both") {
    const result = await api.deleteMessage(message.id, mode);
    setMessages((current) => (mode === "me" ? current.filter((item) => item.id !== message.id) : current.map((item) => (item.id === message.id ? result.message : item))));
    await refreshDialogs();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await api.updateProfile({
      nickname: String(data.get("nickname")),
      avatarUrl: String(data.get("avatarUrl")),
      bio: String(data.get("bio")),
      password: String(data.get("password") || "") || undefined
    });
    setMe(result.user);
    setProfileOpen(false);
  }

  const directory = useMemo(() => users.filter((user) => !dialogs.some((dialog) => dialog.peerId === user.id)), [users, dialogs]);

  if (!token || !me) {
    return (
      <main className="auth-screen">
        <section className="auth-panel">
          <div className="brand-mark"><MessageCircle size={28} /></div>
          <h1>GPT Messenger</h1>
          <p>Sign in with a seeded user like <strong>mira@example.com</strong> / <strong>123456</strong>, or create a new account.</p>
          <form onSubmit={submitAuth} className="auth-form">
            <input name="email" type="email" placeholder="Email" required />
            {authMode === "register" && <input name="nickname" placeholder="Nickname" required minLength={3} />}
            <input name="password" type="password" placeholder="Password" required minLength={authMode === "register" ? 6 : 1} />
            {authError && <div className="error">{authError}</div>}
            <button type="submit" disabled={busy}>{busy ? "Please wait..." : authMode === "login" ? "Log in" : "Create account"}</button>
          </form>
          <button className="link-button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
            {authMode === "login" ? "Need an account?" : "Already registered?"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="messenger-shell">
      <aside className="sidebar">
        <header className="me-card">
          <img src={avatar(me)} alt="" />
          <div>
            <strong>{me.nickname}</strong>
            <span>{me.email}</span>
          </div>
          <button title="Profile settings" onClick={() => setProfileOpen(true)}><Settings size={18} /></button>
          <button
            title="Logout"
            onClick={() => {
              storeToken(null);
              setToken(null);
              setMe(null);
            }}
          >
            <LogOut size={18} />
          </button>
        </header>

        <label className="search-box">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" />
        </label>

        <section className="list-section">
          <h2>Dialogs</h2>
          {dialogs.map((dialog) => (
            <button key={dialog.peerId} className={`dialog-row ${activePeerId === dialog.peerId ? "active" : ""}`} onClick={() => openPeer(dialog)}>
              <img src={avatar(dialog)} alt="" />
              <span className={`presence ${dialog.online ? "online" : ""}`} />
              <span className="row-copy">
                <strong>{dialog.nickname}</strong>
                <small>{dialog.lastMessage}</small>
              </span>
              {dialog.unreadCount > 0 && <b>{dialog.unreadCount}</b>}
            </button>
          ))}
        </section>

        <section className="list-section">
          <h2>Directory</h2>
          {directory.map((user) => (
            <button key={user.id} className="dialog-row" onClick={() => openPeer(user)}>
              <img src={avatar(user)} alt="" />
              <span className="row-copy">
                <strong>{user.nickname}</strong>
                <small>{user.bio || "Open profile"}</small>
              </span>
              <UserPlus size={16} />
            </button>
          ))}
        </section>
      </aside>

      <section className="chat">
        {activePeer ? (
          <>
            <header className="chat-header">
              <img src={avatar(activePeer)} alt="" />
              <div>
                <h1>{"nickname" in activePeer ? activePeer.nickname : ""}</h1>
                <p>{typingUser === activePeerId ? "typing..." : "online" in activePeer && activePeer.online ? "online" : "offline"}</p>
              </div>
            </header>
            <div className="messages">
              <button className="load-older" onClick={loadOlder}>Load older messages</button>
              {messages.map((message) => {
                const mine = message.senderId === me.id;
                return (
                  <article key={message.id} className={`bubble ${mine ? "mine" : ""}`}>
                    <p>{message.body}</p>
                    <footer>
                      <span>{time(message.createdAt)}{message.editedAt ? " edited" : ""}</span>
                      {mine && <CheckCheck size={15} className={message.readAt ? "read" : ""} />}
                      {mine && !message.deletedForAllAt && (
                        <>
                          <button title="Edit" onClick={() => { setEditing(message); setDraft(message.body); }}><Edit3 size={14} /></button>
                          <button title="Delete for me" onClick={() => removeMessage(message, "me")}><X size={14} /></button>
                          <button title="Delete for both" onClick={() => removeMessage(message, "both")}><Trash2 size={14} /></button>
                        </>
                      )}
                    </footer>
                  </article>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <form className="composer" onSubmit={sendMessage}>
              {editing && <span className="edit-chip">Editing <button type="button" onClick={() => { setEditing(null); setDraft(""); }}><X size={14} /></button></span>}
              <input
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  socketRef.current?.emit(event.target.value ? "typing:start" : "typing:stop", { peerId: activePeerId });
                }}
                placeholder="Write a message"
              />
              <button type="submit" title="Send"><Send size={18} /></button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            <MessageCircle size={54} />
            <h1>Select a dialog</h1>
            <p>Search the directory or open an existing conversation.</p>
          </div>
        )}
      </section>

      {profileOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="profile-modal" onSubmit={saveProfile}>
            <header>
              <h2>Profile</h2>
              <button type="button" onClick={() => setProfileOpen(false)}><X size={18} /></button>
            </header>
            <input name="nickname" defaultValue={me.nickname} placeholder="Nickname" />
            <input name="avatarUrl" defaultValue={me.avatarUrl} placeholder="Avatar URL" />
            <textarea name="bio" defaultValue={me.bio} placeholder="Bio" rows={4} />
            <input name="password" type="password" placeholder="New password" />
            <button type="submit">Save profile</button>
          </form>
        </div>
      )}
    </main>
  );
}
