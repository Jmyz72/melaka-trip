import { groupByDay, sortDaySchedule, getAlternatives } from "./lib/grouping.mjs";

const places = await fetch("./places.json").then(r => r.json());

// --- tab switching ---
const tabs = document.querySelectorAll(".tab");
const views = {
  map: document.getElementById("view-map"),
  day1: document.getElementById("view-day1"),
  day2: document.getElementById("view-day2"),
  day3: document.getElementById("view-day3"),
  all: document.getElementById("view-all")
};

function selectTab(name) {
  for (const t of tabs) {
    const isActive = t.dataset.view === name;
    t.setAttribute("aria-selected", isActive ? "true" : "false");
  }
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("active", key === name);
  }
  if (name === "map" && window.__map) window.__map.invalidateSize();
}

for (const t of tabs) {
  t.addEventListener("click", () => selectTab(t.dataset.view));
}

// Placeholder so the rest of the app can be filled in.
window.__places = places;
window.__groupByDay = groupByDay;
window.__sortDaySchedule = sortDaySchedule;
window.__getAlternatives = getAlternatives;
