import {
  fetchComments,
  postComment,
  removeComment,
  getSession,
  getHandleSession,
  loginHandle,
  resetHandleSessionCache,
} from "./api.js";
import { formatDate } from "./format.js";
import { usernameColorClass } from "./usernameColor.js";

const eventId = new URLSearchParams(window.location.search).get("id");
const listEl = document.getElementById("commentList");
const formEl = document.getElementById("commentForm");
const nameEl = document.getElementById("commentName");
const bodyEl = document.getElementById("commentBody");
const errorEl = document.getElementById("commentError");
const toggleLoginEl = document.getElementById("toggleLogin");
const loginFieldsEl = document.getElementById("loginFields");
const loginPasswordEl = document.getElementById("loginPassword");
const loginSubmitEl = document.getElementById("loginSubmit");
const toggleReserveEl = document.getElementById("toggleReserve");
const reserveFieldsEl = document.getElementById("reserveFields");
const reservePasswordEl = document.getElementById("reservePassword");

let activeHandleId = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (!eventId) return;

  let me = null;
  try {
    me = await getSession();
  } catch {
    me = null;
  }

  await renderComments(me);
  await refreshFormForSession(me);

  toggleLoginEl.addEventListener("click", () => {
    loginFieldsEl.toggleAttribute("hidden");
  });
  toggleReserveEl.addEventListener("click", () => {
    reserveFieldsEl.toggleAttribute("hidden");
  });
  loginSubmitEl.addEventListener("click", () => onLoginAndRetry(me));
  formEl.addEventListener("submit", (e) => onSubmit(e, me));
}

// Locks the name field and hides the login/reserve toggles once a handle
// session already exists (fresh visit with a still-valid handleToken, or
// right after a successful reserve/login in this same page load).
async function refreshFormForSession(me) {
  if (me) return; // a real login always takes priority; nothing to check
  const handle = await getHandleSession();
  if (handle) {
    activeHandleId = handle.handleId;
    nameEl.value = handle.username;
    nameEl.readOnly = true;
    toggleLoginEl.setAttribute("hidden", "");
    toggleReserveEl.setAttribute("hidden", "");
    loginFieldsEl.setAttribute("hidden", "");
    reserveFieldsEl.setAttribute("hidden", "");
  }
}

async function renderComments(me) {
  const comments = await fetchComments(eventId);
  listEl.textContent = "";
  for (const c of comments) {
    listEl.appendChild(renderComment(c, me));
  }
}

function renderComment(c, me) {
  const li = document.createElement("li");
  li.className = "comment";

  const meta = document.createElement("p");
  meta.className = "comment-meta";
  const nameSpan = document.createElement("span");
  if (c.author) {
    nameSpan.textContent = c.author.username;
    nameSpan.classList.add(usernameColorClass(c.author.username));
  } else if (c.handle) {
    nameSpan.textContent = `${c.handle.username}*`;
    nameSpan.classList.add(usernameColorClass(c.handle.username));
  } else {
    nameSpan.textContent = c.displayName || "anonym";
    nameSpan.classList.add("comment-name-unclaimed");
  }
  meta.appendChild(nameSpan);
  meta.appendChild(document.createTextNode(` · ${formatDate(c.createdAt)}`));

  const bodyP = document.createElement("p");
  bodyP.className = "comment-body";
  bodyP.textContent = c.body; // SAFE: renders any markup as literal text

  li.appendChild(meta);
  li.appendChild(bodyP);

  const canDelete =
    (me && (me.role === "ADMIN" || c.authorId === me.userId)) ||
    (activeHandleId && c.handleId === activeHandleId);
  if (canDelete) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "button";
    del.textContent = "ta bort";
    del.addEventListener("click", async () => {
      try {
        await removeComment(c.id);
        await renderComments(me);
      } catch (err) {
        console.error(err);
      }
    });
    li.appendChild(del);
  }
  return li;
}

async function onLoginAndRetry(me) {
  errorEl.setAttribute("hidden", "");
  const username = nameEl.value.trim();
  const password = loginPasswordEl.value;
  try {
    await loginHandle(username, password);
    resetHandleSessionCache();
    loginPasswordEl.value = "";
    await refreshFormForSession(me);
    // Retry the comment the visitor was already trying to post.
    if (bodyEl.value.trim()) {
      await onSubmit(new Event("submit"), me);
    }
  } catch (err) {
    errorEl.textContent = err.message || "kunde inte logga in";
    errorEl.removeAttribute("hidden");
  }
}

async function onSubmit(e, me) {
  e.preventDefault();
  errorEl.setAttribute("hidden", "");
  const body = bodyEl.value.trim();
  if (!body) return;

  const reserving = !reserveFieldsEl.hasAttribute("hidden");
  const data = { body };
  if (!nameEl.readOnly) {
    const name = nameEl.value.trim();
    if (name) data.name = name;
    if (reserving && name) {
      data.reserve = true;
      data.password = reservePasswordEl.value;
    }
  }

  try {
    await postComment(eventId, data);
    bodyEl.value = "";
    reservePasswordEl.value = "";
    resetHandleSessionCache();
    await renderComments(me);
    await refreshFormForSession(me);
  } catch (err) {
    if (err.message && err.message.includes("reserverat")) {
      loginFieldsEl.removeAttribute("hidden");
    }
    errorEl.textContent = err.message || "kunde inte skicka kommentaren";
    errorEl.removeAttribute("hidden");
  }
}
