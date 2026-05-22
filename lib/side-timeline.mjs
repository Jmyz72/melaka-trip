// Fixed left-side itinerary rail.
//
// Renders a vertical timeline of every stop (grouped by day) along the left
// edge of the viewport. Each entry shows: dot · time · location name.
// The currently-visible stop highlights as the user scrolls. Clicking an
// entry smooth-scrolls the main .scroll container to that snap section.
// Hidden while the cover hero is in view; fades in afterwards.

import { splitName } from "./name.mjs";

const DAY_NUM   = { 1: "一", 2: "二", 3: "三" };
const DAY_ROMAN = { 1: "Day I", 2: "Day II", 3: "Day III" };

export function mountSideTimeline(stops, scrollEl, root) {
  if (!root || !scrollEl || stops.length === 0) return { destroy() {} };

  const byDay = new Map([[1, []], [2, []], [3, []]]);
  for (const s of stops) byDay.get(s.day)?.push(s);

  const parts = [];
  parts.push('<div class="side-timeline-rail" aria-hidden="true"></div>');
  parts.push('<ol class="side-timeline-list">');

  for (const [day, list] of byDay) {
    if (list.length === 0) continue;
    parts.push(`
      <li class="side-day" data-day="${day}">
        <span class="side-day-num">${DAY_NUM[day]}</span>
        <span class="side-day-roman">${DAY_ROMAN[day]}</span>
      </li>
    `);
    for (const stop of list) {
      const { main } = splitName(stop.name);
      parts.push(`
        <li class="side-stop" data-stop-id="${stop.id}" data-day="${stop.day}">
          <button type="button" class="side-stop-link" data-stop-id="${stop.id}">
            <span class="side-stop-dot" aria-hidden="true"></span>
            <span class="side-stop-time">${stop.time}</span>
            <span class="side-stop-name" title="${main}">${main}</span>
          </button>
        </li>
      `);
    }
  }
  parts.push("</ol>");
  root.innerHTML = parts.join("");

  // Click → smooth scroll to that stop's section
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".side-stop-link");
    if (!btn) return;
    const id = btn.dataset.stopId;
    const target = document.getElementById(`stop-${id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Cache references for fast active-state updates
  const stopRows = new Map();
  for (const row of root.querySelectorAll(".side-stop")) {
    stopRows.set(row.dataset.stopId, row);
  }
  const dayRows = new Map();
  for (const row of root.querySelectorAll(".side-day")) {
    dayRows.set(row.dataset.day, row);
  }

  function setActive(stopId, day) {
    for (const [id, el] of stopRows) {
      el.classList.toggle("is-active", id === stopId);
    }
    for (const [d, el] of dayRows) {
      el.classList.toggle("is-active", d === String(day));
    }
  }

  // Watch every snap section to: (a) decide rail visibility, (b) highlight
  // the currently-in-view stop. Reuse the same threshold the main
  // transitions module uses so they stay in sync.
  const sections = scrollEl.querySelectorAll(".snap");
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
      const el = entry.target;
      const section = el.dataset.section;
      if (section === "cover") {
        root.classList.remove("is-visible");
        setActive(null, null);
      } else {
        root.classList.add("is-visible");
        if (section === "stop") {
          setActive(el.dataset.stopId, el.dataset.day);
        } else if (section === "day-interstitial") {
          // Highlight just the day cluster header until a stop scrolls in
          setActive(null, el.dataset.day);
        } else {
          setActive(null, null);
        }
      }
    }
  }, { root: scrollEl, threshold: [0, 0.3, 0.5, 0.7, 1] });
  sections.forEach(el => io.observe(el));

  return {
    destroy() { io.disconnect(); }
  };
}
