export default class Calendar {
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

  async createEvent(event) {
    event.preventDefault();

    const eventName = this.eventForm.elements["eventName"].value;
    const eventDescription = this.eventForm.elements["eventDescription"].value;
    const eventStart = this.eventForm.elements["eventStart"].value;
    const eventStop = this.eventForm.elements["eventStop"].value;

    const eventData = {
      name: eventName,
      description: eventDescription,
      eventStart: new Date(eventStart).toISOString(),
      eventStop: new Date(eventStop).toISOString(),
    };

    try {
      await fetch("http://localhost:3000/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });
    } catch (e) {
      console.error(e);
    }

    this.eventForm.reset();
  }
}
