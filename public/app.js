class Calendar {
  constructor() {
    this.eventForm = document.getElementById("eventForm");
    this.eventList = document.getElementById("eventList");
    this.addEventListeners();
  }

  addEventListeners() {
    this.eventForm.addEventListener("submit", (event) =>
      this.createEvent(event),
    );
  }

  createEvent(event) {
    event.preventDefault();

    const eventTitle = this.eventForm.elements["eventTitle"].value;
    const eventDate = this.eventForm.elements["eventDate"].value;

    const eventItem = document.createElement("div");
    eventItem.textContent = `${eventTitle} - ${eventDate}`;
    this.eventList.appendChild(eventItem);

    this.eventForm.reset();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Calendar();
});
