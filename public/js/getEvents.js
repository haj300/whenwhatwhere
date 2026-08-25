import { fetchEvents, removeEvent, getSession } from "./api.js";
import { formatDate } from "./format.js";

document.addEventListener("DOMContentLoaded", getEvents);

let activeTab = "upcoming";

export async function getEvents() {
  try {
    // Who's viewing? null when not logged in (getSession throws on 401).
    let me = null;
    try {
      me = await getSession();
    } catch {
      me = null;
    }
    const events = await fetchEvents();
    const now = new Date();
    const upcoming = events
      .filter((event) => new Date(event.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const past = events
      .filter((event) => new Date(event.date) < now)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    setupTabs(upcoming, past, me);
  } catch (e) {
    console.error(e);
  }
}

function setupTabs(upcoming, past, me) {
  const tabUpcoming = document.getElementById("tabUpcoming");
  const tabPast = document.getElementById("tabPast");

  const showTab = (tab) => {
    activeTab = tab;
    setTabState(tabUpcoming, tab === "upcoming", "Upcoming");
    setTabState(tabPast, tab === "past", "Past");
    renderEvents(tab === "upcoming" ? upcoming : past, me);
  };

  tabUpcoming.onclick = () => showTab("upcoming");
  tabPast.onclick = () => showTab("past");
  showTab(activeTab);
}

function setTabState(button, isActive, label) {
  button.setAttribute("aria-pressed", String(isActive));
  button.textContent = isActive ? `[ ${label} ]` : label;
}

function renderEvents(events, me) {
  const eventList = document.getElementById("eventList");
  eventList.innerHTML = "";
  events.forEach((event) => {
    const eventItem = createAndAppend("div", eventList, { class: "event-item" });
    const eventTitle = createAndAppend("h2", eventItem, { text: event.name, class: "event-title" });
    const eventImage = createAndAppend("img", eventItem, { src: event.image, class: "event-image" });
    createAndAppend("p", eventItem, { text: formatDate(event.date) });
    createAndAppend("p", eventItem, { text: event.location });
    if (event.link) {
      createAndAppend("h4", eventItem, { text: "Link: " });
      createAndAppend("a", eventItem, { text: event.link, href: event.link });
    }
    const goToDetails = () => {
      window.location.href = `/pages/event.html?id=${event.id}`;
    };
    eventTitle.addEventListener("click", goToDetails);
    eventImage.addEventListener("click", goToDetails);

    const canDelete = me && (me.role === "ADMIN" || event.createdById === me.userId);
    if (canDelete) {
      const deleteButton = createAndAppend("button", eventItem, { text: "Delete Event" });
      deleteButton.addEventListener("click", async () => {
        try {
          await removeEvent(event.id);
          await getEvents();
        } catch (e) {
          console.error(e);
        }
      });
    }
  });
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
