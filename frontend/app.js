const state = {
  token: localStorage.getItem("chat_token") || "",
  me: null,
  chats: [],
  activeChatId: null,
  activeChat: null,
  ws: null,
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

function renderMe() {
  if (!state.me) return;
  ui.meAvatar.src = avatarUrl(state.me);
  ui.meName.textContent = state.me.name;
  ui.meUsername.textContent = `@${state.me.username}`;
  ui.profileName.value = state.me.name || "";
  ui.profileBio.value = state.me.bio || "";
}

function formatTime(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  return dt.toLocaleString();
}

function chatDisplayName(chat) {
  if (chat.title) return chat.title;
  const other = chat.members.find((m) => m.id !== state.me.id);
  return other ? `${other.name} (@${other.username})` : "Direct Chat";
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
  renderChats();
  if (state.activeChatId) {
    const found = state.chats.find((c) => c.id === state.activeChatId);
    if (found) await selectChat(found.id);
  }
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
  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "new_message" && payload.chat_id === state.activeChatId) {
      appendMessage(payload.message, payload.sender);
    }
    loadChats().catch(() => {});
  };
  state.ws = ws;
}

function buildMessageHTML(message, sender) {
  const mine = message.sender_id === state.me.id;
  const wrapper = document.createElement("div");
  wrapper.className = "msg" + (mine ? " mine" : "");

  const senderName = mine ? "You" : (sender?.name || `User #${message.sender_id}`);
  let attachmentBlock = "";
  if (message.attachment_url) {
    const isImage = (message.attachment_mime || "").startsWith("image/");
    attachmentBlock = `
      <div><a href="${message.attachment_url}" target="_blank" rel="noopener">📎 ${message.attachment_name || "Attachment"}</a></div>
      ${isImage ? `<img class="preview" src="${message.attachment_url}" alt="attachment"/>` : ""}
    `;
  }

  wrapper.innerHTML = `
    <div class="meta">${senderName} • ${formatTime(message.created_at)}</div>
    ${message.text ? `<div class="text"></div>` : ""}
    ${attachmentBlock}
  `;
  if (message.text) wrapper.querySelector(".text").textContent = message.text;
  return wrapper;
}

function appendMessage(message, sender) {
  ui.messages.appendChild(buildMessageHTML(message, sender));
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

async function selectChat(chatId) {
  state.activeChatId = chatId;
  state.activeChat = state.chats.find((c) => c.id === chatId) || null;
  ui.chatTitle.textContent = state.activeChat ? chatDisplayName(state.activeChat) : "Chat";
  renderChats();
  openSocket(chatId);

  const messages = await api(`/api/chats/${chatId}/messages?limit=100`);
  const memberMap = Object.fromEntries((state.activeChat?.members || []).map((m) => [m.id, m]));
  ui.messages.innerHTML = "";
  for (const msg of messages) {
    appendMessage(msg, memberMap[msg.sender_id]);
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
    if (text) fd.append("text", text);
    if (ui.messageFile.files[0]) fd.append("file", ui.messageFile.files[0]);
    if (!text && !ui.messageFile.files[0]) return;

    await api(`/api/chats/${state.activeChatId}/messages`, { method: "POST", body: fd });
    ui.messageText.value = "";
    ui.messageFile.value = "";
  } catch (err) {
    alert(err.message);
  }
});

ui.logoutBtn.addEventListener("click", () => {
  closeSocket();
  clearToken();
  state.me = null;
  state.chats = [];
  state.activeChatId = null;
  showAuth();
});

bootstrap();
