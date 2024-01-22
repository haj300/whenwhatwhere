document.addEventListener("DOMContentLoaded", () => {
  getEvents();
});

async function getEvents() {
  try {
    document.getElementById("eventList").innerHTML = "";

    const response = await fetch("http://localhost:3000/events");
    const events = await response.json();

    events.forEach((event) => {
      const eventTitle = document.createElement("h2");
      const eventItem = document.createElement("div");
      eventItem.classList.add("event-item");
      eventTitle.textContent = event.name;
      eventItem.textContent = `${event.description}: ${event.date.slice(
        0,
        10,
      )} at ${event.date.slice(11, 16)} ${event.location}`;
      document.getElementById("eventList").appendChild(eventTitle);
      document.getElementById("eventList").appendChild(eventItem);
    });
  } catch (e) {
    console.error(e);
  }
}

export { getEvents };
