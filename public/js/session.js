import { getSession, logout } from "./api.js";

document.addEventListener("DOMContentLoaded", async () => {
  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const createEventLink = document.getElementById("createEventLink");

  try {
    await getSession();
    loginLink?.setAttribute("hidden", "");
    logoutLink?.removeAttribute("hidden");
    createEventLink?.removeAttribute("hidden");
  } catch {
    // Not logged in (401) — leave "Log in" visible, "Log out"/"Create event" hidden.
    return;
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