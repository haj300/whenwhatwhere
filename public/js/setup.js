import { setup } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  new SetupForm(document.getElementById("setupForm"));
});

class SetupForm {
  constructor(form) {
    this.form = form;
    this.token =
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (!this.token) {
      this.showError("I didnt get your invite token, please use the link from your invite. :)) ");
    }
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
    const { password } = this.form.elements;

    try {
      await setup({ password: password.value, inviteToken: this.token });
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      this.showError(e.message || "I could not set up your account. Please try again.");
    }
  }
}