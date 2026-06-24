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

function formatDate(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get("id");

document.addEventListener("DOMContentLoaded", () => getEvent(eventId));

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
      const event = new EventDetail(
        eventData.name,
        eventData.description,
        eventData.image,
        eventData.date,
        eventData.location,
        eventData.link,
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
    })
    .catch((error) => {
      console.error(
        "There has been a problem with the fetch operation:",
        error,
      );
    });
}
