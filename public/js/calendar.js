import { getEvents } from "./app.js";
export class Calendar {
  constructor(eventForm) {
    this.eventForm = eventForm;
    this.eventForm.addEventListener(
      "submit",
      this.handleEventFormSubmit.bind(this),
    );
  }

  async handleEventFormSubmit(event) {
    event.preventDefault();

    const { eventName, eventDescription, eventStart, eventStop } =
      this.eventForm.elements;
    const eventData = {
      name: eventName.value,
      description: eventDescription.value,
      eventStart: new Date(eventStart.value).toISOString(),
      eventStop: new Date(eventStop.value).toISOString(),
    };

    try {
      await this.postEvent(eventData);
    } catch (e) {
      console.error(e);
    }

    this.eventForm.reset();
    getEvents();
    createCalendar();
  }

  async postEvent(eventData) {
    return fetch("http://localhost:3000/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });
  }
}

export function createCalendar() {
  const DAYS_IN_WEEK = 7;
  const MONTHS_IN_YEAR = 12;

  const daysTag = document.querySelector(".days");
  const currentDate = document.querySelector(".current-date");

  const date = new Date();
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();

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

  let lastDateofMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  let lastDayofMonth = new Date(
    currentYear,
    currentMonth,
    lastDateofMonth,
  ).getDay();

  console.log("Last date of month: ", lastDateofMonth);

  // Function to generate HTML for a day
  function generateDayHTML(day, isToday, isNextMonth) {
    let className = "";
    if (isToday) className = "today";
    if (isNextMonth) className = "next-date";
    console.log("className: ", className, "day: ", day);
    return `<li class="${className}">${day}</li>`;
  }

  // Function to render a calendar month
  function renderCalendarMonth(month, year, currentDate, daysTag) {
    let calendarDaysHTML = "";

    // Create a new calendar container for the month
    const calendarContainer = document.createElement("div");
    calendarContainer.classList.add("calendar-container");
    document.getElementById("app").appendChild(calendarContainer);

    // Create a new currentDate element for the month
    currentDate = document.createElement("div");
    currentDate.classList.add("current-date");
    calendarContainer.appendChild(currentDate);

    console.log(currentDate.innerHTML, daysTag.innerHTML, month, year);

    // Create a new days container for the month
    daysTag = document.createElement("ul");
    daysTag.classList.add("days");
    calendarContainer.appendChild(daysTag);

    // Generate HTML for current month dates
    for (let day = 1; day <= lastDateofMonth; day++) {
      const isToday =
        day === new Date().getDate() && month === new Date().getMonth();
      calendarDaysHTML += generateDayHTML(day, isToday, false);
    }

    // Generate HTML for next month dates
    for (let day = 1; day < DAYS_IN_WEEK - lastDayofMonth; day++) {
      calendarDaysHTML += generateDayHTML(day, false, true);
    }

    currentDate.innerText = `${months[month]} ${year}`;
    daysTag.innerHTML = calendarDaysHTML;
    console.log(currentDate.innerHTML, daysTag.innerHTML, month, year);
  }

  // Function to render multiple calendar months
  function renderCalendarMonths(startMonth, startYear, numMonths) {
    for (let i = 0; i < numMonths; i++) {
      let month = startMonth + i;
      let year = startYear;
      if (month >= MONTHS_IN_YEAR) {
        month -= MONTHS_IN_YEAR;
        year++;
      }
      renderCalendarMonth(month, year, currentDate, daysTag);
    }
  }

  renderCalendarMonths(currentMonth, currentYear, 3);
}
