import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Bell,
  Bookmark,
  CheckCheck,
  ChevronLeft,
  Edit3,
  Flame,
  Hash,
  Image,
  LayoutGrid,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Paperclip,
  Phone,
  Pin,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Users,
  Video,
  X
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { api, getStoredToken, storeToken } from "./api";
import { createSocket } from "./socket";
import type { Dialog, Message, User } from "./types";

type AuthMode = "login" | "register";
type DialogFilter = "all" | "unread" | "online" | "pinned";

function avatar(user: Pick<User, "avatarUrl" | "nickname"> | Pick<Dialog, "avatarUrl" | "nickname">) {
  return user.avatarUrl || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.nickname)}`;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ user, size = 46 }: { user: Pick<User, "avatarUrl" | "nickname"> | Pick<Dialog, "avatarUrl" | "nickname">; size?: number }) {
  return (
    <span className="avatar-frame" style={{ width: size, height: size }}>
      <span>{initials(user.nickname)}</span>
      <img
        src={avatar(user)}
        alt=""
        width={size}
        height={size}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}

function time(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function peerId(peer: User | Dialog | null) {
  if (!peer) {
    return null;
  }
  return "peerId" in peer ? peer.peerId : peer.id;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
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
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [contactPanelOpen, setContactPanelOpen] = useState(true);
  const [filter, setFilter] = useState<DialogFilter>("all");
  const [pinned, setPinned] = useState<Set<number>>(() => new Set([2, 3]));
  const [favorites, setFavorites] = useState<Set<number>>(() => new Set());
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activePeerId = peerId(activePeer);

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
    const selectedPeerId = "peerId" in peer ? peer.peerId : peer.id;
    const result = await api.messages(selectedPeerId);
    setMessages(result.messages);
    await api.markRead(selectedPeerId);
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
    const confirmed = window.confirm(mode === "both" ? "Delete this message for both people?" : "Delete this message from your view?");
    if (!confirmed) {
      return;
    }
    const result = await api.deleteMessage(message.id, mode);
    setMessages((current) => (mode === "me" ? current.filter((item) => item.id !== message.id) : current.map((item) => (item.id === message.id ? result.message : item))));
    await refreshDialogs();
  }

  function togglePinned(id: number) {
    setPinned((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleFavorite(id: number) {
    setFavorites((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

  const filteredDialogs = useMemo(() => {
    return dialogs
      .filter((dialog) => {
        if (filter === "unread") return dialog.unreadCount > 0;
        if (filter === "online") return dialog.online;
        if (filter === "pinned") return pinned.has(dialog.peerId);
        return true;
      })
      .sort((a, b) => Number(pinned.has(b.peerId)) - Number(pinned.has(a.peerId)));
  }, [dialogs, filter, pinned]);

  const directory = useMemo(() => users.filter((user) => !dialogs.some((dialog) => dialog.peerId === user.id)), [users, dialogs]);
  const activeDialog = activePeerId ? dialogs.find((dialog) => dialog.peerId === activePeerId) : null;
  const onlineCount = dialogs.filter((dialog) => dialog.online).length;
  const unreadCount = dialogs.reduce((sum, dialog) => sum + dialog.unreadCount, 0);
  const starredMessages = messages.filter((message) => favorites.has(message.id));

  if (!token || !me) {
    return (
      <main className="auth-screen">
        <section className="auth-showcase">
          <nav className="auth-topline">
            <span className="product-logo"><MessageCircle size={19} /> Maxgram</span>
            <span><ShieldCheck size={16} /> Encrypted workspace</span>
          </nav>
          <div className="auth-copy">
            <h1>Messenger that already feels like a product.</h1>
            <p>Dialogs, statuses, profiles, realtime delivery, dark interface, and seeded activity for immediate demos.</p>
          </div>
          <div className="demo-stack" aria-hidden="true">
            <div className="demo-message large"><span>mira</span>We can ship the public demo today.</div>
            <div className="demo-message offset"><span>leo</span>Presence and read status are online.</div>
            <div className="demo-message accent"><Sparkles size={18} /> Ready for client review</div>
          </div>
          <div className="trust-row">
            <span><Lock size={15} /> JWT sessions</span>
            <span><Bell size={15} /> Live events</span>
            <span><Users size={15} /> Seeded network</span>
          </div>
        </section>
        <section className="auth-panel">
          <div className="brand-mark"><MessageCircle size={28} /></div>
          <h1>{authMode === "login" ? "Welcome back" : "Create workspace"}</h1>
          <p>Demo login: <strong>mira@example.com</strong> / <strong>123456</strong>. New accounts join the same live directory.</p>
          <form onSubmit={submitAuth} className="auth-form">
            <input name="email" type="email" aria-label="Email" autoComplete="email" spellCheck={false} placeholder="Email…" required />
            {authMode === "register" && <input name="nickname" aria-label="Nickname" autoComplete="username" spellCheck={false} placeholder="Nickname…" required minLength={3} />}
            <input name="password" type="password" aria-label="Password" autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder="Password…" required minLength={authMode === "register" ? 6 : 1} />
            {authError && <div className="error">{authError}</div>}
            <button type="submit" disabled={busy}>{busy ? "Please wait…" : authMode === "login" ? "Log in" : "Create account"}</button>
          </form>
          <button className="link-button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
            {authMode === "login" ? "Need an account?" : "Already registered?"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={`messenger-shell ${activePeer ? "chat-open" : ""}`}>
      <nav className="rail">
        <button className="rail-logo" title="Chats" aria-label="Chats"><MessageCircle size={22} /></button>
        <button className="rail-active" title="Dialogs" aria-label="Dialogs"><MessageCircle size={21} /></button>
        <button title="Directory" aria-label="Directory" onClick={() => setDirectoryOpen((value) => !value)}><Users size={21} /></button>
        <button title="Saved messages" aria-label="Saved messages" onClick={() => setFilter("pinned")}><Bookmark size={21} /></button>
        <button title="Archive" aria-label="Archive"><Archive size={21} /></button>
        <span />
        <button title="Profile settings" aria-label="Profile settings" onClick={() => setProfileOpen(true)}><Settings size={21} /></button>
        <button title="Theme" aria-label="Theme"><Moon size={21} /></button>
      </nav>

      <aside className="sidebar">
        <header className="me-card">
          <Avatar user={me} />
          <div>
            <strong>Maxgram</strong>
            <span>@{me.nickname} · online</span>
          </div>
          <button title="Profile settings" aria-label="Profile settings" onClick={() => setProfileOpen(true)}><Settings size={18} /></button>
          <button
            title="Logout"
            aria-label="Logout"
            onClick={() => {
              storeToken(null);
              setToken(null);
              setMe(null);
            }}
          >
            <LogOut size={18} />
          </button>
        </header>

        <section className="metrics-strip">
          <div><strong>{dialogs.length}</strong><span>chats</span></div>
          <div><strong>{unreadCount}</strong><span>unread</span></div>
          <div><strong>{onlineCount}</strong><span>online</span></div>
        </section>

        <label className="search-box">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search people, teams, chats" autoComplete="off" placeholder="Search people, teams, chats…" />
        </label>

        <div className="segmented">
          {(["all", "unread", "online", "pinned"] as DialogFilter[]).map((item) => (
            <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>

        <section className="list-section">
          <h2><span>Dialogs</span><button onClick={() => setFilter("all")}>Reset</button></h2>
          {filteredDialogs.map((dialog) => (
            <button key={dialog.peerId} className={`dialog-row ${activePeerId === dialog.peerId ? "active" : ""}`} onClick={() => openPeer(dialog)}>
              <Avatar user={dialog} />
              <span className={`presence ${dialog.online ? "online" : ""}`} />
              <span className="row-copy">
                <strong>{pinned.has(dialog.peerId) && <Pin size={12} />} {dialog.nickname}</strong>
                <small>{dialog.lastMessage}</small>
              </span>
              <span className="row-meta">{displayDate(dialog.lastMessageAt)}</span>
              {dialog.unreadCount > 0 && <b>{dialog.unreadCount}</b>}
            </button>
          ))}
        </section>

        {directoryOpen && <section className="list-section directory-section">
          <h2><span>Directory</span><button onClick={() => setDirectoryOpen(false)}>Hide</button></h2>
          {directory.map((user) => (
            <button key={user.id} className="dialog-row" onClick={() => openPeer(user)}>
              <Avatar user={user} />
              <span className="row-copy">
                <strong>{user.nickname}</strong>
                <small>{user.bio || "Open profile"}</small>
              </span>
              <UserPlus size={16} />
            </button>
          ))}
        </section>}
      </aside>

      <section className="chat">
        {activePeer ? (
          <>
            <header className="chat-header">
              <button className="mobile-back" aria-label="Back to dialogs" onClick={() => setActivePeer(null)}><ChevronLeft size={18} /></button>
              <Avatar user={activePeer} />
              <div className="chat-title">
                <h1>{"nickname" in activePeer ? activePeer.nickname : ""}</h1>
                <p>{typingUser === activePeerId ? "typing..." : activeDialog?.online ? "online now" : "last seen recently"}</p>
              </div>
              <div className="chat-tools">
                <button title="Pin dialog" aria-label="Pin dialog" onClick={() => activePeerId && togglePinned(activePeerId)} className={activePeerId && pinned.has(activePeerId) ? "tool-active" : ""}><Pin size={18} /></button>
                <button title="Voice call" aria-label="Voice call"><Phone size={18} /></button>
                <button title="Video call" aria-label="Video call"><Video size={18} /></button>
                <button title="Contact panel" aria-label="Contact panel" onClick={() => setContactPanelOpen((value) => !value)}><LayoutGrid size={18} /></button>
                <button title="More" aria-label="More actions"><MoreHorizontal size={18} /></button>
              </div>
            </header>
            <div className="messages">
              <button className="load-older" onClick={loadOlder}>Load older messages</button>
              {messages.map((message) => {
                const mine = message.senderId === me.id;
                return (
                  <article key={message.id} className={`bubble ${mine ? "mine" : ""}`}>
                    <p>{message.body}</p>
                    {reactions[message.id] && <span className="reaction">{reactions[message.id]}</span>}
                    <footer>
                      <span>{time(message.createdAt)}{message.editedAt ? " edited" : ""}</span>
                      {mine && <CheckCheck size={15} className={message.readAt ? "read" : ""} />}
                      <button title="React" aria-label="React to message" onClick={() => setReactions((current) => ({ ...current, [message.id]: current[message.id] ? "" : "🔥" }))}><Flame size={14} /></button>
                      <button title="Save" aria-label="Save message" onClick={() => toggleFavorite(message.id)} className={favorites.has(message.id) ? "tool-active" : ""}><Star size={14} /></button>
                      {mine && !message.deletedForAllAt && (
                        <>
                          <button title="Edit" aria-label="Edit message" onClick={() => { setEditing(message); setDraft(message.body); }}><Edit3 size={14} /></button>
                          <button title="Delete for me" aria-label="Delete message for me" onClick={() => removeMessage(message, "me")}><X size={14} /></button>
                          <button title="Delete for both" aria-label="Delete message for both" onClick={() => removeMessage(message, "both")}><Trash2 size={14} /></button>
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
              <div className="quick-actions">
                {["👍", "🔥", "❤️", "ок", "сейчас"].map((item) => (
                  <button key={item} type="button" onClick={() => setDraft((value) => `${value}${value ? " " : ""}${item}`)}>{item}</button>
                ))}
              </div>
              <button type="button" title="Attach file" aria-label="Attach file" className="composer-icon"><Paperclip size={18} /></button>
              <button type="button" title="Image" aria-label="Attach image" className="composer-icon"><Image size={18} /></button>
              <input
                value={draft}
                aria-label="Message text"
                autoComplete="off"
                onChange={(event) => {
                  setDraft(event.target.value);
                  socketRef.current?.emit(event.target.value ? "typing:start" : "typing:stop", { peerId: activePeerId });
                }}
                placeholder="Write a message…"
              />
              <button type="button" title="Emoji" aria-label="Emoji" className="composer-icon"><SmilePlus size={18} /></button>
              <button type="submit" title="Send" aria-label="Send message"><Send size={18} /></button>
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

      {activePeer && contactPanelOpen && (
        <aside className="contact-panel">
          <header>
            <Avatar user={activePeer} size={86} />
            <h2>{"nickname" in activePeer ? activePeer.nickname : ""}</h2>
            <p>{("bio" in activePeer && activePeer.bio) || "No bio yet"}</p>
          </header>
          <div className="contact-actions">
            <button><Bell size={17} /> Mute</button>
            <button onClick={() => activePeerId && togglePinned(activePeerId)}><Pin size={17} /> {activePeerId && pinned.has(activePeerId) ? "Unpin" : "Pin"}</button>
            <button><Hash size={17} /> Topic</button>
          </div>
          <section className="info-panel">
            <h3>Conversation</h3>
            <dl>
              <div><dt>Messages</dt><dd>{messages.length}</dd></div>
              <div><dt>Saved</dt><dd>{starredMessages.length}</dd></div>
              <div><dt>Status</dt><dd>{activeDialog?.online ? "Online" : "Offline"}</dd></div>
            </dl>
          </section>
          <section className="info-panel">
            <h3>Saved in this chat</h3>
            {starredMessages.length ? starredMessages.slice(-3).map((message) => <p key={message.id}>{message.body}</p>) : <p>No saved messages yet.</p>}
          </section>
          <section className="security-note">
            <ShieldCheck size={18} />
            <span>Session protected with JWT. Realtime events are scoped to authenticated users.</span>
          </section>
        </aside>
      )}

      {profileOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="profile-modal" onSubmit={saveProfile}>
            <header>
              <h2>Profile</h2>
              <button type="button" aria-label="Close profile" onClick={() => setProfileOpen(false)}><X size={18} /></button>
            </header>
            <input name="nickname" aria-label="Nickname" autoComplete="username" spellCheck={false} defaultValue={me.nickname} placeholder="Nickname…" />
            <input name="avatarUrl" type="url" aria-label="Avatar URL" autoComplete="off" defaultValue={me.avatarUrl} placeholder="Avatar URL…" />
            <textarea name="bio" aria-label="Bio" autoComplete="off" defaultValue={me.bio} placeholder="Bio…" rows={4} />
            <input name="password" type="password" aria-label="New password" autoComplete="new-password" placeholder="New password…" />
            <button type="submit">Save profile</button>
          </form>
        </div>
      )}
    </main>
  );
}
