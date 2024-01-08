import Calendar from "./calendar.js";

document.addEventListener("DOMContentLoaded", () => {
  new Calendar();

  async function getEvents() {
    try {
      const response = await fetch("http://localhost:3000/events");
      const events = await response.json();
      console.log(events);

      events.forEach((event) => {
        const eventItem = document.createElement("div");
        eventItem.textContent = `${event.name} - ${event.eventStart.slice(
          0,
          10,
        )} - ${event.eventStop.slice(0, 10)}`;
        document.getElementById("eventList").appendChild(eventItem);
      });
    } catch (e) {
      console.error(e);
    }
  }
  getEvents();
});
