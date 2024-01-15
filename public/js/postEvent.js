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

    const { eventName, eventDescription, eventStart, eventStop } =
      this.eventForm.elements;
    const eventData = {
      name: eventName.value,
      description: eventDescription.value,
      eventStart: new Date(eventStart.value).toISOString(),
      eventStop: new Date(eventStop.value).toISOString(),
    };

    try {
      await this.postEvent(eventData);
    } catch (e) {
      console.error(e);
    }

    this.eventForm.reset();
  }

  async postEvent(eventData) {
    return fetch("http://localhost:3000/post-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });
  }
}
