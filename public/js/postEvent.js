import {
  createEvent,
  updateEvent,
  fetchEvent,
  getSession,
  uploadImage,
} from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const eventId = new URLSearchParams(window.location.search).get("id");
  new PostEvent(document.getElementById("eventForm"), eventId);
});

class PostEvent {
  constructor(eventForm, eventId) {
    this.eventForm = eventForm;
    this.eventId = eventId;
    this.existingImageUrl = null;
    this.objectUrl = null;
    this.eventForm.addEventListener(
      "submit",
      this.handleEventFormSubmit.bind(this),
    );
    this.eventForm.elements.image.addEventListener(
      "change",
      this.previewSelectedImage.bind(this),
    );
    if (eventId) {
      this.enterEditMode(eventId);
    } else {
      this.requireLoggedIn();
    }
  }

  async requireLoggedIn() {
    try {
      await getSession();
      this.eventForm.removeAttribute("hidden");
    } catch {
      window.location.href = "/pages/inviteOnly.html";
    }
  }

  previewSelectedImage() {
    const preview = document.getElementById("currentImage");
    const file = this.eventForm.elements.image.files[0];

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    if (file) {
      this.objectUrl = URL.createObjectURL(file);
      preview.src = this.objectUrl;
      preview.removeAttribute("hidden");
    } else if (this.existingImageUrl) {
      preview.src = this.existingImageUrl;
      preview.removeAttribute("hidden");
    } else {
      preview.src = "";
      preview.setAttribute("hidden", "");
    }
  }

  async enterEditMode(eventId) {
    let me = null;
    try {
      me = await getSession();
    } catch {
      me = null;
    }
    let existing;
    try {
      existing = await fetchEvent(eventId);
    } catch (e) {
      console.error(e);
      this.blockForm("kunde inte ladda event");
      return;
    }
    const canEdit =
      me && (me.role === "ADMIN" || existing.createdById === me.userId);
    if (!canEdit) {
      this.blockForm("You don't have permission to edit this event.");
      return;
    }
    this.eventForm.removeAttribute("hidden");
    this.prefillForm(existing);
    document.getElementById("formTitle").textContent = "ändra event";
    document.getElementById("submitButton").textContent = "spara";
  }

  blockForm(message) {
    this.eventForm.setAttribute("hidden", "");
    document.getElementById("formTitle").textContent = message;
  }

  prefillForm(existing) {
    const { name, description, date, time, location, link } =
      this.eventForm.elements;
    const eventDate = new Date(existing.date);
    const pad = (n) => String(n).padStart(2, "0");
    name.value = existing.name;
    description.value = existing.description;
    date.value = `${eventDate.getFullYear()}-${pad(eventDate.getMonth() + 1)}-${pad(eventDate.getDate())}`;
    time.value = `${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}`;
    location.value = existing.location;
    link.value = existing.link || "";
    this.existingImageUrl = existing.image || null;
    this.previewSelectedImage();
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

  async handleEventFormSubmit(event) {
    event.preventDefault();
    this.clearError();
    const { name, description, image, date, time, location, link } =
      this.eventForm.elements;

    const dateValue = new Date(`${date.value}T${time.value}`);

    let imageUrl = "";
    if (image.files[0]) {
      try {
        const formData = new FormData(this.eventForm);
        formData.append("file", image.files[0]);
        imageUrl = await uploadImage(formData);
      } catch (e) {
        console.error(e);
        this.showError("Image upload failed. Remove the image or try again.");
        return;
      }
    }

    const payload = {
      name: name.value,
      description: description.value,
      date: dateValue.toISOString(),
      location: location.value,
      link: link.value,
      ...(imageUrl ? { image: imageUrl } : {}),
    };

    try {
      if (this.eventId) {
        await updateEvent(this.eventId, payload);
        window.location.href = `/pages/event.html?id=${this.eventId}`;
      } else {
        await createEvent(payload);
        this.eventForm.reset();
        window.location.href = "/";
      }
    } catch (e) {
      console.error(e);
      this.showError(e.message || "kunde inte spara. försök igen");
    }
  }
}
