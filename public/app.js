document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/home");
    const data = await response.json();
    document.getElementById("appTitle").textContent = data.title;
  } catch (error) {
    console.error("Error fetching data:", error);
    document.getElementById("appTitle").textContent = "Error loading data";
  }
});
