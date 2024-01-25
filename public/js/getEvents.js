document.addEventListener("DOMContentLoaded", () => {
  getEvents();
});

async function getEvents() {
  try {
    const eventList = document.getElementById("eventList");
    eventList.innerHTML = "";

    const response = await fetch("http://localhost:3000/events");
    const events = await response.json();

    events.forEach((event) => {
      const eventTitle = createEventTitle(event.name);
      const eventItem = createEventItem(
        event.description,
        event.date,
        event.location,
      );
      const eventImage = createEventImage(event.image);
      const eventBackground = createEventBackground("#aaa");

      appendEventElements(
        eventList,
        eventTitle,
        eventItem,
        eventImage,
        eventBackground,
      );
    });
  } catch (e) {
    console.error(e);
  }
}

function createEventTitle(name) {
  const eventTitle = document.createElement("h2");
  eventTitle.textContent = name;
  return eventTitle;
}

function createEventItem(description, date, location) {
  const eventItem = document.createElement("div");
  eventItem.classList.add("event-item");
  eventItem.textContent = `${description}: ${date.slice(0, 10)} at ${date.slice(
    11,
    16,
  )} ${location}`;
  return eventItem;
}

function createEventBackground(background) {
  const eventBackground = document.createElement("div");
  eventBackground.style.backgroundColor = background;
  eventBackground.classList.add("event-item-background");
  return eventBackground;
}

function createEventImage(image) {
  const eventImage = document.createElement("img");
  eventImage.src = image;
  return eventImage;
}

function appendEventElements(
  eventList,
  eventTitle,
  eventItem,
  eventImage,
  eventBackground,
) {
  eventBackground.appendChild(eventTitle);
  eventBackground.appendChild(eventItem);
  eventBackground.appendChild(eventImage);
  eventList.appendChild(eventBackground);
}

export { getEvents };
