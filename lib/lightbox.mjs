// Fullscreen swipeable lightbox. Single global instance, uses #lightbox in index.html.
let state = null; // { items, idx, label }

function el(sel) { return document.querySelector(sel); }

function renderItem() {
  const stage = el(".lightbox-stage");
  const item = state.items[state.idx];
  if (item.type === "video") {
    stage.innerHTML = `<video src="${item.src}" controls playsinline></video>`;
  } else {
    stage.innerHTML = `<img src="${item.src}" alt="">`;
  }
  el(".lightbox-counter").textContent = `${state.label} · ${state.idx + 1} / ${state.items.length}`;
  const progress = el(".lightbox-progress");
  progress.innerHTML = state.items.map((_, i) =>
    `<span class="dot${i === state.idx ? " active" : ""}"></span>`
  ).join("");
}

function move(delta) {
  if (!state) return;
  state.idx = (state.idx + delta + state.items.length) % state.items.length;
  renderItem();
}

function close() {
  state = null;
  const root = el("#lightbox");
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");
  el(".lightbox-stage").innerHTML = "";
  document.body.style.overflow = "";
}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  el(".lightbox-close").addEventListener("click", close);
  el(".lightbox-prev").addEventListener("click", () => move(-1));
  el(".lightbox-next").addEventListener("click", () => move(1));
  document.addEventListener("keydown", e => {
    if (!state) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") move(-1);
    if (e.key === "ArrowRight") move(1);
  });
  // touch swipe
  const stage = el(".lightbox-stage");
  let startX = null;
  stage.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
    startX = null;
  });
}

export function openLightbox(items, startIdx, label) {
  wireOnce();
  state = { items, idx: Math.max(0, Math.min(startIdx, items.length - 1)), label };
  const root = el("#lightbox");
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderItem();
}
