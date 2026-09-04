import { login } from "./api.js";

const REMEMBERED_EMAIL_KEY = "loginEmail";

document.addEventListener("DOMContentLoaded", () => {
  new LoginForm(document.getElementById("loginForm"));
});

class LoginForm {
  constructor(form) {
    this.form = form;
    this.toggleButton = document.getElementById("togglePassword");
    this.form.addEventListener("submit", this.handleSubmit.bind(this));
    this.toggleButton.addEventListener("click", this.handleToggle.bind(this));
    this.prefillEmail();
  }

  prefillEmail() {
    const remembered = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (remembered) {
      this.form.elements.email.value = remembered;
    }
  }

  handleToggle() {
    const { password } = this.form.elements;
    const willShow = password.type === "password";
    password.type = willShow ? "text" : "password";
    this.toggleButton.setAttribute("aria-pressed", String(willShow));
    this.toggleButton.setAttribute("aria-label", willShow ? "dölj lösenord" : "visa lösenord");
    this.toggleButton.textContent = willShow ? "dölj" : "visa";
  }

  showError(msg) {
    const el = document.getElementById("formError");
    el.textContent = msg;
    el.removeAttribute("hidden");
  }

  clearError() {
    const el = document.getElementById("formError");
    el.textContent = "";
    el.setAttribute("hidden", "");
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.clearError();
    const { email, password } = this.form.elements;

    try {
      await login({ email: email.value, password: password.value });
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.value);
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      this.showError(e.message || "kunde inte logga in. försök igen");
    }
  }
}