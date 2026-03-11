const PAGE_SIZE = 30;
const TYPING_STOP_DELAY_MS = 1200;
const TYPING_EXPIRE_MS = 2000;

const state = {
  token: localStorage.getItem("chat_token") || "",
  me: null,
  chats: [],
  activeChatId: null,
  activeChat: null,
  ws: null,
  chatMemberMap: {},
  messageOrder: [],
  messageById: new Map(),
  oldestMessageId: null,
  hasMoreMessages: true,
  loadingOlderMessages: false,
  lastReadMessageId: 0,
  typingUsers: new Map(),
  typingTimeouts: new Map(),
  typingActive: false,
  typingStopTimer: null,
};

const ui = {
  authView: document.getElementById("auth-view"),
  chatView: document.getElementById("chat-view"),
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  authError: document.getElementById("auth-error"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  registerName: document.getElementById("register-name"),
  registerUsername: document.getElementById("register-username"),
  registerPassword: document.getElementById("register-password"),
  meAvatar: document.getElementById("me-avatar"),
  meName: document.getElementById("me-name"),
  meUsername: document.getElementById("me-username"),
  profileForm: document.getElementById("profile-form"),
  profileName: document.getElementById("profile-name"),
  profileBio: document.getElementById("profile-bio"),
  profileFile: document.getElementById("profile-file"),
  logoutBtn: document.getElementById("logout-btn"),
  userSearch: document.getElementById("user-search"),
  searchBtn: document.getElementById("search-btn"),
  searchResults: document.getElementById("search-results"),
  chatList: document.getElementById("chat-list"),
  chatTitle: document.getElementById("chat-title"),
  messages: document.getElementById("messages"),
  typingIndicator: document.getElementById("typing-indicator"),
  sendForm: document.getElementById("send-form"),
  messageText: document.getElementById("message-text"),
  messageFile: document.getElementById("message-file"),
};

async function api(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return null;
  return await res.json();
}

function switchTab(mode) {
  const login = mode === "login";
  ui.tabLogin.classList.toggle("active", login);
  ui.tabRegister.classList.toggle("active", !login);
  ui.loginForm.classList.toggle("hidden", !login);
  ui.registerForm.classList.toggle("hidden", login);
  ui.authError.textContent = "";
}

function showAuth() {
  ui.authView.classList.remove("hidden");
  ui.chatView.classList.add("hidden");
}

function showChat() {
  ui.authView.classList.add("hidden");
  ui.chatView.classList.remove("hidden");
}

function saveToken(token) {
  state.token = token;
  localStorage.setItem("chat_token", token);
}

function clearToken() {
  state.token = "";
  localStorage.removeItem("chat_token");
}

function avatarUrl(user) {
  return user?.profile_picture_url || "https://placehold.co/96x96/eef3fb/335?text=PFP";
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

function chatDisplayName(chat) {
  if (chat.title) return chat.title;
  const other = chat.members.find((m) => m.id !== state.me.id);
  return other ? `${other.name} (@${other.username})` : "Direct Chat";
}

function renderMe() {
  if (!state.me) return;
  ui.meAvatar.src = avatarUrl(state.me);
  ui.meName.textContent = state.me.name;
  ui.meUsername.textContent = `@${state.me.username}`;
  ui.profileName.value = state.me.name || "";
  ui.profileBio.value = state.me.bio || "";
}

function isNearBottom() {
  return ui.messages.scrollHeight - ui.messages.scrollTop - ui.messages.clientHeight < 100;
}

function getReadLabel(message) {
  if (!state.activeChat || message.sender_id !== state.me.id || message.is_deleted) return "";
  const memberCount = state.activeChat.members.length;
  const readers = (message.read_by_user_ids || []).filter((id) => id !== message.sender_id);
  if (!readers.length) return "Sent";
  if (memberCount <= 2) return "Read";
  return `Read by ${readers.length}`;
}

function senderNameForMessage(message) {
  if (message.sender_id === state.me.id) return "You";
  return state.chatMemberMap[message.sender_id]?.name || `User #${message.sender_id}`;
}

function buildMessageElement(message) {
  const mine = message.sender_id === state.me.id;
  const wrapper = document.createElement("div");
  wrapper.className = "msg" + (mine ? " mine" : "") + (message.is_deleted ? " deleted" : "");
  wrapper.dataset.messageId = String(message.id);
  wrapper.dataset.senderId = String(message.sender_id);

  const editedText = message.is_edited ? " (edited)" : "";
  const textHtml = message.is_deleted
    ? `<div class="text">This message was deleted.</div>`
    : (message.text ? `<div class="text"></div>` : "");

  let attachmentBlock = "";
  if (!message.is_deleted && message.attachment_url) {
    const isImage = (message.attachment_mime || "").startsWith("image/");
    attachmentBlock = `
      <div><a href="${message.attachment_url}" target="_blank" rel="noopener">📎 ${message.attachment_name || "Attachment"}</a></div>
      ${isImage ? `<img class="preview" src="${message.attachment_url}" alt="attachment"/>` : ""}
    `;
  }

  const actionHtml =
    mine && !message.is_deleted
      ? `<div class="actions">
          <button class="edit" type="button">Edit</button>
          <button class="delete" type="button">Delete</button>
        </div>`
      : "";

  const receiptText = getReadLabel(message);
  wrapper.innerHTML = `
    <div class="meta">${senderNameForMessage(message)} - ${formatTime(message.created_at)}${editedText}</div>
    ${textHtml}
    ${attachmentBlock}
    ${actionHtml}
    ${mine ? `<div class="receipt">${receiptText}</div>` : ""}
  `;

  if (!message.is_deleted && message.text) {
    wrapper.querySelector(".text").textContent = message.text;
  }

  if (mine && !message.is_deleted) {
    const editBtn = wrapper.querySelector(".edit");
    const deleteBtn = wrapper.querySelector(".delete");
    if (editBtn) {
      editBtn.addEventListener("click", () => handleEditMessage(message.id));
    }
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => handleDeleteMessage(message.id));
    }
  }

  return wrapper;
}

function renderChats() {
  ui.chatList.innerHTML = "";
  if (!state.chats.length) {
    ui.chatList.innerHTML = `<div class="list-item">No chats yet. Search users and start one.</div>`;
    return;
  }
  for (const chat of state.chats) {
    const div = document.createElement("div");
    div.className = "list-item" + (chat.id === state.activeChatId ? " active" : "");
    const lastText = chat.last_message?.text || chat.last_message?.attachment_name || "No messages yet";
    div.innerHTML = `
      <strong>${chatDisplayName(chat)}</strong>
      <div class="meta">${lastText}</div>
    `;
    div.addEventListener("click", () => selectChat(chat.id));
    ui.chatList.appendChild(div);
  }
}

async function loadChats() {
  state.chats = await api("/api/chats");
  if (state.activeChatId) {
    state.activeChat = state.chats.find((c) => c.id === state.activeChatId) || null;
    if (!state.activeChat) {
      state.activeChatId = null;
    }
  }
  renderChats();
}

function resetActiveMessages() {
  state.messageOrder = [];
  state.messageById = new Map();
  state.oldestMessageId = null;
  state.hasMoreMessages = true;
  state.loadingOlderMessages = false;
  state.lastReadMessageId = 0;
  ui.messages.innerHTML = "";
}

function renderTypingIndicator() {
  if (!state.typingUsers.size) {
    ui.typingIndicator.textContent = "";
    return;
  }
  const names = Array.from(state.typingUsers.keys()).map((userId) => state.chatMemberMap[userId]?.name || "Someone");
  ui.typingIndicator.textContent = `${names.join(", ")} ${names.length > 1 ? "are" : "is"} typing...`;
}

function clearTypingState() {
  for (const timeoutId of state.typingTimeouts.values()) {
    clearTimeout(timeoutId);
  }
  state.typingUsers.clear();
  state.typingTimeouts.clear();
  renderTypingIndicator();
}

function applyTypingEvent(payload) {
  if (!state.activeChat || payload.chat_id !== state.activeChatId || payload.user_id === state.me.id) return;
  if (!payload.is_typing) {
    state.typingUsers.delete(payload.user_id);
    if (state.typingTimeouts.has(payload.user_id)) {
      clearTimeout(state.typingTimeouts.get(payload.user_id));
      state.typingTimeouts.delete(payload.user_id);
    }
    renderTypingIndicator();
    return;
  }

  state.typingUsers.set(payload.user_id, Date.now());
  if (state.typingTimeouts.has(payload.user_id)) {
    clearTimeout(state.typingTimeouts.get(payload.user_id));
  }
  const timeoutId = setTimeout(() => {
    state.typingUsers.delete(payload.user_id);
    state.typingTimeouts.delete(payload.user_id);
    renderTypingIndicator();
  }, TYPING_EXPIRE_MS);
  state.typingTimeouts.set(payload.user_id, timeoutId);
  renderTypingIndicator();
}

function sendTyping(isTyping) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.activeChatId) return;
  state.ws.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
}

function stopTyping() {
  if (state.typingActive) {
    sendTyping(false);
    state.typingActive = false;
  }
  if (state.typingStopTimer) {
    clearTimeout(state.typingStopTimer);
    state.typingStopTimer = null;
  }
}

function upsertMessage(message, options = {}) {
  const { prepend = false, forceScroll = false } = options;
  const existed = state.messageById.has(message.id);
  state.messageById.set(message.id, message);

  if (existed) {
    const oldElement = ui.messages.querySelector(`[data-message-id="${message.id}"]`);
    const newElement = buildMessageElement(message);
    if (oldElement) oldElement.replaceWith(newElement);
  } else {
    if (prepend) state.messageOrder.unshift(message.id);
    else state.messageOrder.push(message.id);

    const element = buildMessageElement(message);
    if (prepend && ui.messages.firstChild) ui.messages.insertBefore(element, ui.messages.firstChild);
    else ui.messages.appendChild(element);
  }

  if (state.messageOrder.length > 0) state.oldestMessageId = state.messageOrder[0];
  if (forceScroll) ui.messages.scrollTop = ui.messages.scrollHeight;
}

function applyReadEvent(payload) {
  if (payload.chat_id !== state.activeChatId) return;
  let changed = false;
  for (const id of state.messageOrder) {
    if (id > payload.last_message_id) break;
    const msg = state.messageById.get(id);
    if (!msg || msg.sender_id !== state.me.id) continue;
    const readSet = new Set(msg.read_by_user_ids || []);
    if (!readSet.has(payload.user_id)) {
      readSet.add(payload.user_id);
      msg.read_by_user_ids = Array.from(readSet).sort((a, b) => a - b);
      state.messageById.set(id, msg);
      changed = true;
    }
  }
  if (!changed) return;

  for (const id of state.messageOrder) {
    const msg = state.messageById.get(id);
    if (!msg || msg.sender_id !== state.me.id) continue;
    const element = ui.messages.querySelector(`[data-message-id="${id}"]`);
    if (!element) continue;
    const receipt = element.querySelector(".receipt");
    if (receipt) receipt.textContent = getReadLabel(msg);
  }
}

function closeSocket() {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
}

function openSocket(chatId) {
  closeSocket();
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${proto}://${window.location.host}/ws/chats/${chatId}?token=${encodeURIComponent(state.token)}`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = async (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "typing") {
      applyTypingEvent(payload);
      return;
    }
    if (payload.type === "messages_read") {
      applyReadEvent(payload);
      await loadChats().catch(() => {});
      return;
    }
    if (payload.chat_id !== state.activeChatId) {
      await loadChats().catch(() => {});
      return;
    }

    if (payload.type === "new_message" && payload.message) {
      const shouldScroll = isNearBottom() || payload.message.sender_id === state.me.id;
      upsertMessage(payload.message, { prepend: false, forceScroll: shouldScroll });
      if (payload.message.sender_id !== state.me.id) {
        await markReadUpToLatest().catch(() => {});
      }
    } else if ((payload.type === "message_updated" || payload.type === "message_deleted") && payload.message) {
      upsertMessage(payload.message, { prepend: false, forceScroll: false });
    }
    await loadChats().catch(() => {});
  };
  state.ws = ws;
}

async function markReadUpToLatest() {
  if (!state.activeChatId || !state.messageOrder.length) return;
  const latestId = state.messageOrder[state.messageOrder.length - 1];
  if (latestId <= state.lastReadMessageId) return;
  await api(`/api/chats/${state.activeChatId}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ last_message_id: latestId }),
  });
  state.lastReadMessageId = latestId;
}

async function loadMessagePage({ beforeId = null, prepend = false } = {}) {
  if (!state.activeChatId) return;
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (beforeId) params.set("before_id", String(beforeId));
  const data = await api(`/api/chats/${state.activeChatId}/messages?${params.toString()}`);
  if (!Array.isArray(data) || data.length === 0) {
    if (prepend) state.hasMoreMessages = false;
    return;
  }

  if (prepend) {
    const prevHeight = ui.messages.scrollHeight;
    for (let i = data.length - 1; i >= 0; i--) {
      if (!state.messageById.has(data[i].id)) upsertMessage(data[i], { prepend: true });
    }
    const newHeight = ui.messages.scrollHeight;
    ui.messages.scrollTop = newHeight - prevHeight;
  } else {
    for (const msg of data) {
      if (!state.messageById.has(msg.id)) upsertMessage(msg, { prepend: false });
    }
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }
  state.hasMoreMessages = data.length === PAGE_SIZE;
}

async function loadOlderMessagesIfNeeded() {
  if (!state.activeChatId || !state.hasMoreMessages || state.loadingOlderMessages || !state.oldestMessageId) return;
  state.loadingOlderMessages = true;
  try {
    await loadMessagePage({ beforeId: state.oldestMessageId, prepend: true });
  } finally {
    state.loadingOlderMessages = false;
  }
}

async function selectChat(chatId) {
  state.activeChatId = chatId;
  state.activeChat = state.chats.find((c) => c.id === chatId) || null;
  state.chatMemberMap = Object.fromEntries((state.activeChat?.members || []).map((m) => [m.id, m]));
  ui.chatTitle.textContent = state.activeChat ? chatDisplayName(state.activeChat) : "Chat";
  renderChats();
  clearTypingState();
  stopTyping();
  resetActiveMessages();
  openSocket(chatId);
  await loadMessagePage();
  await markReadUpToLatest().catch(() => {});
}

function renderSearchResults(users) {
  ui.searchResults.innerHTML = "";
  if (!users.length) {
    ui.searchResults.innerHTML = `<div class="list-item">No users found.</div>`;
    return;
  }
  for (const user of users) {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <strong>${user.name}</strong>
      <div class="meta">@${user.username}</div>
      <button>Start Chat</button>
    `;
    div.querySelector("button").addEventListener("click", async () => {
      const chat = await api(`/api/chats/direct/${user.id}`, { method: "POST" });
      await loadChats();
      await selectChat(chat.id);
    });
    ui.searchResults.appendChild(div);
  }
}

async function handleEditMessage(messageId) {
  const current = state.messageById.get(messageId);
  if (!current || current.is_deleted) return;
  const edited = window.prompt("Edit message:", current.text || "");
  if (edited === null) return;
  const nextText = edited.trim();
  if (!nextText) {
    alert("Message cannot be empty.");
    return;
  }
  await api(`/api/chats/${state.activeChatId}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: nextText }),
  });
}

async function handleDeleteMessage(messageId) {
  if (!window.confirm("Delete this message?")) return;
  await api(`/api/chats/${state.activeChatId}/messages/${messageId}`, { method: "DELETE" });
}

async function bootstrap() {
  if (!state.token) {
    showAuth();
    return;
  }
  try {
    state.me = await api("/api/users/me");
    renderMe();
    showChat();
    await loadChats();
  } catch {
    clearToken();
    showAuth();
  }
}

ui.tabLogin.addEventListener("click", () => switchTab("login"));
ui.tabRegister.addEventListener("click", () => switchTab("register"));

ui.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const payload = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: ui.loginUsername.value.trim(),
        password: ui.loginPassword.value,
      }),
    });
    saveToken(payload.access_token);
    await bootstrap();
  } catch (err) {
    ui.authError.textContent = err.message;
  }
});

ui.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const payload = await api("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ui.registerName.value.trim(),
        username: ui.registerUsername.value.trim(),
        password: ui.registerPassword.value,
      }),
    });
    saveToken(payload.access_token);
    await bootstrap();
  } catch (err) {
    ui.authError.textContent = err.message;
  }
});

ui.profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ui.profileName.value.trim() || null,
        bio: ui.profileBio.value.trim() || null,
      }),
    });

    if (ui.profileFile.files[0]) {
      const fd = new FormData();
      fd.append("file", ui.profileFile.files[0]);
      await api("/api/users/me/profile-picture", { method: "POST", body: fd });
      ui.profileFile.value = "";
    }
    state.me = await api("/api/users/me");
    renderMe();
  } catch (err) {
    alert(err.message);
  }
});

ui.searchBtn.addEventListener("click", async () => {
  try {
    const users = await api(`/api/users/search?q=${encodeURIComponent(ui.userSearch.value.trim())}`);
    renderSearchResults(users);
  } catch (err) {
    alert(err.message);
  }
});

ui.sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.activeChatId) {
    alert("Select a chat first.");
    return;
  }
  try {
    const fd = new FormData();
    const text = ui.messageText.value.trim();
    const file = ui.messageFile.files[0];
    if (text) fd.append("text", text);
    if (file) fd.append("file", file);
    if (!text && !file) return;
    await api(`/api/chats/${state.activeChatId}/messages`, { method: "POST", body: fd });
    ui.messageText.value = "";
    ui.messageFile.value = "";
    stopTyping();
  } catch (err) {
    alert(err.message);
  }
});

ui.messageText.addEventListener("input", () => {
  if (!state.activeChatId) return;
  const hasText = ui.messageText.value.trim().length > 0;
  if (hasText && !state.typingActive) {
    sendTyping(true);
    state.typingActive = true;
  }

  if (!hasText) {
    stopTyping();
    return;
  }

  if (state.typingStopTimer) clearTimeout(state.typingStopTimer);
  state.typingStopTimer = setTimeout(() => stopTyping(), TYPING_STOP_DELAY_MS);
});

ui.messages.addEventListener("scroll", async () => {
  if (ui.messages.scrollTop < 80) {
    await loadOlderMessagesIfNeeded();
  }
  if (isNearBottom()) {
    await markReadUpToLatest().catch(() => {});
  }
});

ui.logoutBtn.addEventListener("click", () => {
  closeSocket();
  stopTyping();
  clearTypingState();
  clearToken();
  state.me = null;
  state.chats = [];
  state.activeChatId = null;
  showAuth();
});

bootstrap();
