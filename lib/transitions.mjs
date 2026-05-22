// Scroll orchestration:
//   - mark .snap sections as .in-view when scrolled into view (drives brush
//     stroke reveal, closing-seal stamp animation, opacity dimming of others)
//   - on day boundary crossings, briefly flip the day-interstitial section
//     in 3D for the "page turn" effect
//   - lifecycle for the 3D cover (pause when scrolled away, resume on return)
//
// Usage:
//   mountTransitions({
//     scrollEl, coverEl, cover3D, mapToggleBtn,
//     onSectionChange(section)  // optional
//   });

export function mountTransitions(opts) {
  const { scrollEl, coverEl, cover3D, mapToggleBtn, onSectionChange } = opts;
  if (!scrollEl) return { destroy() {} };

  const snaps = scrollEl.querySelectorAll(".snap");
  let currentDay = null;
  let currentSection = null;

  // ── Section visibility ──
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        el.classList.add("in-view");
        scrollEl.classList.add("has-focus");
        currentSection = el;
        if (onSectionChange) onSectionChange(el);

        // Day flip detection
        const day = Number(el.dataset.day);
        if (el.dataset.section === "day-interstitial" && day && day !== currentDay) {
          currentDay = day;
          triggerPageFlip(el);
        }

        // Hide cover, manage 3D pause
        const isCover = el.dataset.section === "cover";
        if (isCover) {
          cover3D?.resume();
          if (mapToggleBtn) mapToggleBtn.hidden = true;
        } else {
          if (mapToggleBtn) mapToggleBtn.hidden = false;
        }
      } else if (!entry.isIntersecting) {
        el.classList.remove("in-view");
      }
    }
  }, {
    root: scrollEl,
    threshold: [0, 0.3, 0.5, 0.7, 1]
  });
  snaps.forEach(el => io.observe(el));

  // Pause 3D when cover scrolls out (rough check on scroll position)
  let coverVisible = true;
  scrollEl.addEventListener("scroll", () => {
    if (!coverEl || !cover3D) return;
    const r = coverEl.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < window.innerHeight;
    if (visible && !coverVisible) { cover3D.resume(); coverVisible = true; }
    else if (!visible && coverVisible) { cover3D.pause(); coverVisible = false; }
  }, { passive: true });

  function triggerPageFlip(el) {
    const reduced = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    el.classList.remove("flipping");
    // force reflow so the animation can restart
    void el.offsetWidth;
    el.classList.add("flipping");
    setTimeout(() => el.classList.remove("flipping"), 1200);
  }

  return {
    destroy() {
      io.disconnect();
    }
  };
}

// Animate the ticker text on the cover: cycle through cute phrases that pull
// real ratings data when available.
export function mountTicker(tickerEl, getStats) {
  if (!tickerEl) return { destroy() {} };
  const dot = tickerEl.querySelector(".ticker-dot");
  const text = tickerEl.querySelector(".ticker-text");
  if (!text) return { destroy() {} };

  const phrases = [
    "listening for friends…",
    () => {
      const s = getStats();
      if (s.raters === 0) return "be the first to rate a stop ✶";
      return `${s.raters} friend${s.raters === 1 ? "" : "s"} have rated · ${s.avg.toFixed(1)} ★ avg`;
    },
    () => {
      const s = getStats();
      if (!s.top) return "scroll to ride along ↓";
      return `today's favourite: ${s.top}`;
    },
    "scroll to ride along ↓"
  ];

  let idx = 0;
  let timer = null;

  function tick() {
    const phrase = phrases[idx % phrases.length];
    const v = typeof phrase === "function" ? phrase() : phrase;
    text.style.opacity = "0";
    setTimeout(() => {
      text.textContent = v;
      text.style.transition = "opacity 0.5s";
      text.style.opacity = "1";
    }, 300);
    idx++;
    timer = setTimeout(tick, 4200);
  }
  tick();

  return {
    destroy() { if (timer) clearTimeout(timer); }
  };
}
