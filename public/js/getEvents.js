document.addEventListener("DOMContentLoaded", getEvents);

async function getEvents() {
  try {
    const eventList = document.getElementById("eventList");
    eventList.innerHTML = "";

    const response = await fetch("http://localhost:3000/events");
    const events = await response.json();

    events.forEach((event) => {
      const eventItem = createAndAppend("div", eventList, {
        class: "event-item",
      });
      createAndAppend("h2", eventItem, { text: event.name });
      createAndAppend("img", eventItem, { src: event.image });
      createAndAppend("h4", eventItem, { text: "Description: " });
      createAndAppend("p", eventItem, {
        text: `${event.description}`,
      });
      createAndAppend("h4", eventItem, { text: "Location: " });
      createAndAppend("p", eventItem, {
        text: `${event.location}`,
      });
      createAndAppend("h4", eventItem, { text: "Date: " });
      createAndAppend("p", eventItem, {
        text: `${event.date.slice(0, 10)} at ${event.date.slice(11, 16)}`,
      });

      eventItem.addEventListener("click", () => {
        window.location.href = `/pages/getEvent.html?id=${event.id}`;
      });
    });
  } catch (e) {
    console.error(e);
  }
}

function createAndAppend(
  tagName,
  parentElement,
  { text, src, class: className } = {},
) {
  const element = document.createElement(tagName);
  if (text) element.textContent = text;
  if (src) element.src = src;
  if (className) element.classList.add(className);
  parentElement.appendChild(element);
  return element;
}

export { getEvents };
