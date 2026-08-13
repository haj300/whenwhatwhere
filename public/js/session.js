import { getSession, logout } from "./api.js";

document.addEventListener("DOMContentLoaded", async () => {
  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");

  try {
    await getSession();
    loginLink?.setAttribute("hidden", "");
    logoutLink?.removeAttribute("hidden");
  } catch {
    // Not logged in (401) — leave the "Log in" link visible, "Log out" hidden.
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