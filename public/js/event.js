var urlParams = new URLSearchParams(window.location.search);
var eventId = urlParams.get("id");

// Fetch the event data from the server
fetch("/event/" + eventId)
  .then((response) => {
    console.log("Inside first then");
    console.log(response);
    if (!response.ok) {
      console.error("Error status:", response.status);
      console.error("Status text:", response.statusText);
      throw new Error("Network response was not ok");
    }
    return response.json();
  })
  .then((eventData) => {
    console.log("Inside second then");
    console.log(eventData);
    // Populate the page with the event data
    document.getElementById("eventName").textContent = eventData.name;
    document.getElementById("eventDescription").textContent =
      eventData.description;
    console.log(eventData.description);
  })
  .catch((error) => {
    console.log("Inside catch");
    console.error("There has been a problem with your fetch operation:", error);
  });
// });
