import { login } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  new LoginForm(document.getElementById("loginForm"));
});

class LoginForm {
  constructor(form) {
    this.form = form;
    this.form.addEventListener("submit", this.handleSubmit.bind(this));
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
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      this.showError(e.message || "Could not log in. Please try again.");
    }
  }
}