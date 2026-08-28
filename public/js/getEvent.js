import { fetchEvent, getSession } from "./api.js";
import { formatDate } from "./format.js";

class EventDetail {
  constructor(name, description, image, date, location, link, createdById, createdBy) {
    this.name = name;
    this.description = description;
    this.image = image;
    this.date = date;
    this.location = location;
    this.link = link;
    this.createdById = createdById;
    this.createdBy = createdBy;
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
      eventData.date, eventData.location, eventData.link, eventData.createdById,
      eventData.createdBy,
    );
    document.getElementById("name").textContent = event.name;
    document.getElementById("author").textContent =
      `posted by: ${event.createdBy?.username ?? event.createdBy?.email ?? "unknown"}`;
    document.getElementById("description").textContent = event.description;
    document.getElementById("date").textContent = `date: ${formatDate(event.date)}`;
    document.getElementById("location").textContent = `location: ${event.location}`;
    document.getElementById("image").src = event.image || "";
    if (event.link) {
      const linkEl = document.getElementById("link");
      linkEl.href = event.link;
      linkEl.textContent = event.link;
      linkEl.removeAttribute("hidden");
    }

    let me = null;
    try {
      me = await getSession();
    } catch {
      me = null;
    }
    const canEdit = me && (me.role === "ADMIN" || event.createdById === me.userId);
    if (canEdit) {
      const editLink = document.getElementById("editLink");
      editLink.href = `/pages/addEvent.html?id=${eventId}`;
      editLink.removeAttribute("hidden");
    }
  } catch (e) {
    console.error(e);
    document.getElementById("name").textContent = e.message || "Could not load event.";
  }
}
