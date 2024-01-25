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

window.onload = function () {
  const eventId = getEventIdFromUrl();
  getEvent(eventId);
};

function getEventIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

function getEvent(eventId) {
  fetch(`/event/${eventId}`)
    .then(handleResponse)
    .then(displayEvent)
    .catch(handleError);
}

function handleResponse(response) {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response.json();
}

function displayEvent(eventData) {
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
}

function handleError(error) {
  console.error("There has been a problem with the fetch operation:", error);
}
