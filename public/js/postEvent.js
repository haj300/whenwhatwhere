document.addEventListener("DOMContentLoaded", (event) => {
  new PostEvent(document.getElementById("eventForm"));
  console.log("from postEvent.js");
});

class PostEvent {
  constructor(eventForm) {
    console.log("from PostEvent class");
    this.eventForm = eventForm;
    this.eventForm.addEventListener(
      "submit",
      this.handleEventFormSubmit.bind(this),
    );
  }

  async handleEventFormSubmit(event) {
    event.preventDefault();
    const { name, description, image, date, time, location } =
      this.eventForm.elements;

    const dateValue = new Date(date.value);
    const timeValue = time.value.split(":");

    dateValue.setHours(timeValue[0]);
    dateValue.setMinutes(timeValue[1]);

    const eventData = {
      name: name.value,
      description: description.value,
      date: dateValue.toISOString(),
      location: location.value,
      image: image.value,
    };
    console.log("from postEvent.js", eventData);
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
    } catch (error) {
      console.error("Error:", error);
    }
  }
}
