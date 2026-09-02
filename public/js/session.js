import { getSession, logout } from "./api.js";
import { usernameColorClass } from "./usernameColor.js";

document.addEventListener("DOMContentLoaded", async () => {
  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const loginStatus = document.getElementById("loginStatus");

  let session;
  try {
    session = await getSession();
  } catch {
    // Not logged in (401) — leave the "Log in" link visible, "Log out"
    // hidden, and index.html's "Not logged in" default text as-is.
    return;
  }

  loginLink?.setAttribute("hidden", "");
  logoutLink?.removeAttribute("hidden");
  if (loginStatus) {
    loginStatus.textContent = "";
    if (session.username) {
      loginStatus.appendChild(document.createTextNode("Logged in as: "));
      const usernameEl = document.createElement("span");
      usernameEl.textContent = session.username;
      usernameEl.classList.add(usernameColorClass(session.username));
      loginStatus.appendChild(usernameEl);
    } else {
      loginStatus.textContent = `Logged in as: user #${session.userId}`;
    }
  }

  logoutLink?.addEventListener("click", async () => {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  });
});