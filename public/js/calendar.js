import { getEvents } from "./app.js";
export class Calendar {
  constructor() {
    this.eventForm = document.getElementById("eventForm");
    this.eventList = document.getElementById("eventList");
    this.addEventListeners();
  }

  addEventListeners() {
    this.eventForm.addEventListener("submit", (event) =>
      this.createEvent(event),
    );
  }

  async createEvent(event) {
    event.preventDefault();

    const eventName = this.eventForm.elements["eventName"].value;
    const eventDescription = this.eventForm.elements["eventDescription"].value;
    const eventStart = this.eventForm.elements["eventStart"].value;
    const eventStop = this.eventForm.elements["eventStop"].value;

    const eventData = {
      name: eventName,
      description: eventDescription,
      eventStart: new Date(eventStart).toISOString(),
      eventStop: new Date(eventStop).toISOString(),
    };

    try {
      await fetch("http://localhost:3000/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });
    } catch (e) {
      console.error(e);
    }

    this.eventForm.reset();
    getEvents();
    createCalendar();
  }
}

export function createCalendar() {
  let daysTag = document.querySelector(".days");
  const currentDate = document.querySelector(".current-date");

  let date = new Date(),
    currentYear = date.getFullYear(),
    currentMonth = date.getMonth();

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "Julymonth",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const renderCalendar = (month, year, currentDate, daysTag) => {
    let firstDayofMonth = new Date(year, month, 1).getDay(),
      lastDateofLastMonth = new Date(year, month, 0).getDate(),
      lastDateofMonth = new Date(year, month + 1, 0).getDate(),
      lastDayofMonth = new Date(year, month, lastDateofMonth).getDay();
    let liTag = " ";

    // li for previous month dates
    for (let i = firstDayofMonth; i > 0; i--) {
      liTag += `<li class="inactive">${lastDateofLastMonth - i + 1}</li>`;
    }

    // li for current month dates
    for (let i = 1; i <= lastDateofMonth; i++) {
      if (
        i === new Date().getDate() &&
        currentMonth === new Date().getMonth()
      ) {
        liTag += `<li class="today">${i}</li>`;
      } else {
        liTag += `<li>${i}</li>`;
      }
    }

    // li for next month dates
    for (let i = 1; i < 7 - lastDayofMonth; i++) {
      liTag += `<li class="next-date">${i}</li>`;
      daysTag.innerHTML = liTag;
    }
    currentDate.innerText = `${months[month]} ${year}`;
    daysTag.innerHTML = liTag;
    console.log(currentDate.innerHTML, daysTag.innerHTML, month, year);
  };

  for (let i = 0; i < 3; i++) {
    // Create local variables for the month and year
    let month = currentMonth + i;
    let year = currentYear;
    if (month > 11) {
      month = 0;
      year++;
    }

    // Create a new calendar container for the month
    const calendarContainer = document.createElement("div");
    calendarContainer.classList.add("calendar-container");
    document.getElementById("app").appendChild(calendarContainer);

    // Create a new currentDate element for the month
    const currentDate = document.createElement("div");
    currentDate.classList.add("current-date");
    calendarContainer.appendChild(currentDate);

    // Create a new days container for the month
    const daysTag = document.createElement("ul");
    daysTag.classList.add("days");
    calendarContainer.appendChild(daysTag);

    renderCalendar(month, year, currentDate, daysTag);
  }
}
