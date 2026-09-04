import { fetchComments, postComment, removeComment, getSession } from "./api.js";
import { formatDate } from "./format.js";
import { usernameColorClass } from "./usernameColor.js";

const eventId = new URLSearchParams(window.location.search).get("id");
const listEl = document.getElementById("commentList");
const formEl = document.getElementById("commentForm");
const bodyEl = document.getElementById("commentBody");
const errorEl = document.getElementById("commentError");

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

  if (me) {
    formEl.removeAttribute("hidden");
    formEl.addEventListener("submit", (e) => onSubmit(e, me));
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
  const name = c.author?.username ?? "unknown";
  const nameEl = document.createElement("span");
  nameEl.textContent = name; // SAFE: text, not HTML
  nameEl.classList.add(usernameColorClass(name));
  meta.appendChild(nameEl);
  meta.appendChild(document.createTextNode(` · ${formatDate(c.createdAt)}`));

  const bodyP = document.createElement("p");
  bodyP.className = "comment-body";
  bodyP.textContent = c.body; // SAFE: renders any markup as literal text

  li.appendChild(meta);
  li.appendChild(bodyP);

  const canDelete = me && (me.role === "ADMIN" || c.authorId === me.userId);
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

async function onSubmit(e, me) {
  e.preventDefault();
  errorEl.setAttribute("hidden", "");
  const body = bodyEl.value.trim();
  if (!body) return;
  try {
    await postComment(eventId, body);
    bodyEl.value = "";
    await renderComments(me);
  } catch (err) {
    errorEl.textContent = err.message || "kunde inte skicka kommentaren";
    errorEl.removeAttribute("hidden");
  }
}
