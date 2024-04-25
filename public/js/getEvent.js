class Event {
  constructor(name, description, image, date, time, location) {
    this.name = name;
    this.description = description;
    this.image = image;
    this.date = date;
    this.time = time;
    this.location = location;
  }
}

const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("id");

console.log(eventId);

window.onload = function () {
  getEvent(eventId);
};

function getEvent(eventId) {
  fetch(`/event/${eventId}`)
    .then((response) => {
      if (!response.ok) {
        console.error(`Error status: ${response.status}`);
        console.error(`Status text: ${response.statusText}`);
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((eventData) => {
      const event = new Event(
        eventData.name,
        eventData.description,
        eventData.image,
        eventData.date,
        eventData.time,
        eventData.location,
      );

      document.getElementById("name").textContent = event.name;
      document.getElementById("description").textContent = event.description;
      document.getElementById("date").textContent = event.date;
      document.getElementById("time").textContent = event.time;
      document.getElementById("location").textContent = event.location;
      document.getElementById("image").src = event.image;

      let eventElement = document.getElementById("event");

      eventElement.style.width = event.width;
      eventElement.style.height = event.height;
    })
    .catch((error) => {
      console.error(
        "There has been a problem with the fetch operation:",
        error,
      );
    });
}
