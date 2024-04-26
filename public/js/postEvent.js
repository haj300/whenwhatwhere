document.addEventListener("DOMContentLoaded", (event) => {
  new PostEvent(document.getElementById("eventForm"));
});

class PostEvent {
  constructor(eventForm) {
    this.eventForm = eventForm;
    this.eventForm.addEventListener(
      "submit",
      this.handleEventFormSubmit.bind(this),
    );
  }

  async handleEventFormSubmit(event) {
    event.preventDefault();
    const { name, description, image, date, time, location, link } =
      this.eventForm.elements;

    const dateValue = new Date(date.value);
    const timeValue = time.value.split(":");

    dateValue.setHours(timeValue[0]);
    dateValue.setMinutes(timeValue[1]);

    // Upload the image to gc bucket first
    const formData = new FormData(this.eventForm);
    formData.append("file", image.files[0]);

    let imageUrl = "";
    try {
      const response = await fetch("/uploadImage", {
        method: "POST",
        body: formData,
      });
      if (response.headers.get("Content-Type") === "application/json") {
        const data = await response.json();
        imageUrl = data.url;
      } else {
        imageUrl = await response.text();
      }
    } catch (e) {
      console.error(e);
    }

    const eventData = {
      name: name.value,
      description: description.value,
      date: dateValue.toISOString(),
      location: location.value,
      link: link.value,
      image: imageUrl,
    };

    try {
      await this.postEvent(eventData);
    } catch (e) {
      console.error(e);
    }

    this.eventForm.reset();
  }

  async postEvent(eventData) {
    try {
      const response = await fetch("/addEvent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status} ${response.url}`,
        );
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }
}
