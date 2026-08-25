import { fetchEvent } from "./api.js";
import { formatDate } from "./format.js";

class EventDetail {
  constructor(name, description, image, date, location, link) {
    this.name = name;
    this.description = description;
    this.image = image;
    this.date = date;
    this.location = location;
    this.link = link;
  }
}

const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("id");

document.addEventListener("DOMContentLoaded", () => getEvent(eventId));

async function getEvent(eventId) {
  if (!eventId) {
    document.getElementById("name").textContent = "Event not found.";
    return;
  }
  try {
    const eventData = await fetchEvent(eventId);
    const event = new EventDetail(
      eventData.name, eventData.description, eventData.image,
      eventData.date, eventData.location, eventData.link,
    );
    document.getElementById("name").textContent = event.name;
    document.getElementById("description").textContent = event.description;
    document.getElementById("date").textContent = formatDate(event.date);
    document.getElementById("location").textContent = event.location;
    document.getElementById("image").src = event.image || "";
    if (event.link) {
      const linkEl = document.getElementById("link");
      linkEl.href = event.link;
      linkEl.textContent = event.link;
      linkEl.removeAttribute("hidden");
    }
  } catch (e) {
    console.error(e);
    document.getElementById("name").textContent = e.message || "Could not load event.";
  }
}
