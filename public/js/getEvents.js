import { fetchEvents, removeEvent, getSession } from "./api.js";

document.addEventListener("DOMContentLoaded", getEvents);

export async function getEvents() {
  try {
    const eventList = document.getElementById("eventList");
    eventList.innerHTML = "";
    // Who's viewing? null when not logged in (getSession throws on 401).
    let me = null;
    try {
      me = await getSession();
    } catch {
      me = null;
    }
    const events = await fetchEvents();
    events.forEach((event) => {
      const eventItem = createAndAppend("div", eventList, { class: "event-item" });
      const eventTitle = createAndAppend("h2", eventItem, { text: event.name, class: "event-title" });
      const eventImage = createAndAppend("img", eventItem, { src: event.image, class: "event-image" });
      createAndAppend("h4", eventItem, { text: "Description: " });
      createAndAppend("p", eventItem, { text: `${event.description}` });
      createAndAppend("h4", eventItem, { text: "Location: " });
      createAndAppend("p", eventItem, { text: `${event.location}` });
      createAndAppend("h4", eventItem, { text: "Date: " });
      createAndAppend("p", eventItem, { text: `${event.date.slice(0, 10)} at ${event.date.slice(11, 16)}` });
      if (event.link) {
        createAndAppend("h4", eventItem, { text: "Link: " });
        createAndAppend("a", eventItem, { text: event.link, href: event.link });
      }
      const goToDetails = () => {
        window.location.href = `/pages/event.html?id=${event.id}`;
      };
      eventTitle.addEventListener("click", goToDetails);
      eventImage.addEventListener("click", goToDetails);

      const canDelete =
        me && (me.role === "ADMIN" || event.createdById === me.userId);
      if (canDelete) {
        const deleteButton = createAndAppend("button", eventItem, { text: "Delete Event", class: "button" });
        deleteButton.addEventListener("click", async () => {
          try {
            await removeEvent(event.id);
            eventItem.remove();
          } catch (e) {
            console.error(e);
          }
        });
      }
    });
  } catch (e) {
    console.error(e);
  }
}

function createAndAppend(tagName, parentElement, { text, src, href, class: className } = {}) {
  const element = document.createElement(tagName);
  if (text) element.textContent = text;
  if (src) element.src = src;
  if (href) {
    element.href = href;
    element.target = "_blank";
    element.rel = "noopener noreferrer";
  }
  if (className) element.classList.add(className);
  parentElement.appendChild(element);
  return element;
}
