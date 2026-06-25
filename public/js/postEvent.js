import { createEvent, uploadImage } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  new PostEvent(document.getElementById("eventForm"));
});

class PostEvent {
  constructor(eventForm) {
    this.eventForm = eventForm;
    this.eventForm.addEventListener("submit", this.handleEventFormSubmit.bind(this));
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
    const { name, description, image, date, time, location, link } = this.eventForm.elements;

    const dateValue = new Date(date.value);
    const timeValue = time.value.split(":");
    dateValue.setHours(timeValue[0]);
    dateValue.setMinutes(timeValue[1]);

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

    try {
      await createEvent({
        name: name.value,
        description: description.value,
        date: dateValue.toISOString(),
        location: location.value,
        link: link.value,
        image: imageUrl,
      });
      this.eventForm.reset();
      window.location.href = "/";
    } catch (e) {
      console.error(e);
      this.showError(e.message || "Could not create event. Please try again.");
    }
  }
}
