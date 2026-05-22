// The brush-stroke title underline reveal is driven by CSS: each stop section
// has a `.stop-brush-rule path` with a `stroke-dashoffset` transition that
// resolves to 0 when its parent gets the `.in-view` class (added by
// lib/transitions.mjs).  This module exists as a stable name for that
// behavior and provides a one-shot helper to manually trigger a reveal for
// off-scroll elements (used by the closing screen).

export function revealBrushStroke(el) {
  if (!el) return;
  const path = el.querySelector(".stop-brush-rule path");
  if (!path) return;
  path.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.5, 0, 0.2, 1)";
  // Force reflow then animate
  void path.getBoundingClientRect();
  path.style.strokeDashoffset = "0";
}
