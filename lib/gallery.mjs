// Decide grid cell span for a media item given its pixel dimensions.
// Landscape (w/h > 1.4): span 2 columns. Portrait (h/w > 1.4): span 2 rows.
// Otherwise: 1x1. Missing/zero dims also fall back to 1x1.
export function sizeFor(item) {
  const w = Number(item?.w) || 0;
  const h = Number(item?.h) || 0;
  if (!w || !h) return { colSpan: 1, rowSpan: 1 };
  const ratio = w / h;
  if (ratio > 1.4)  return { colSpan: 2, rowSpan: 1 };
  if (1 / ratio > 1.4) return { colSpan: 1, rowSpan: 2 };
  return { colSpan: 1, rowSpan: 1 };
}

// Map size into the class names used by the new scroll-snap gallery grid.
// First tile in a single-photo stop becomes "hero" so it dominates the screen.
function classFor(item, idx, total) {
  const { colSpan, rowSpan } = sizeFor(item);
  if (total === 1) return "tile hero";
  if (idx === 0 && total <= 3) return "tile hero";
  if (colSpan === 2) return "tile landscape";
  if (rowSpan === 2) return "tile portrait";
  return "tile square";
}

function mediaTileHTML(item, idx, total) {
  const cls = classFor(item, idx, total);
  const bg = item.type === "video" ? (item.poster || item.src) : item.src;
  const playOverlay = item.type === "video" ? `<span class="play-overlay" aria-hidden="true">▶</span>` : "";
  return `
    <button type="button" class="${cls}" data-idx="${idx}" aria-label="View media ${idx + 1}">
      <img class="tile-img" src="${bg}" alt="" loading="lazy" decoding="async" />
      <canvas class="tile-canvas" aria-hidden="true"></canvas>
      ${playOverlay}
    </button>
  `;
}

// Animate a watercolor brush mask revealing the photo: we paint over the image
// with paper-colored "wet" strokes, then erase them as the tile enters the
// viewport. Stops are full-viewport so the IntersectionObserver fires once on
// entry; we drive the wipe over ~900ms with rAF.
function startBrushReveal(canvas) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.scale(dpr, dpr);

  // Start fully covered in paper color
  ctx.fillStyle = "#f4ead5";
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Wet brush passes: organic blobs of "destination-out" composite to reveal
  // the underlying image. Several large blobs + many small drips.
  const W = rect.width;
  const H = rect.height;
  const start = performance.now();
  const duration = 900;
  const seed = Math.random() * 1000;

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    // Ease-out cubic for natural brush sweep
    const e = 1 - Math.pow(1 - t, 3);

    ctx.globalCompositeOperation = "destination-out";

    // Big sweeping arc — like a brush dragged diagonally
    const sweepX = -W * 0.3 + W * 1.6 * e;
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.95)";
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const r = W * 0.42 + Math.sin(seed + i * 1.7) * W * 0.05;
      const x = sweepX + Math.cos(ang) * r * 0.45;
      const y = H * 0.5 + Math.sin(ang) * r * 0.45 + Math.sin(seed + i) * H * 0.15;
      const blob = W * (0.10 + Math.sin(seed + i * 2.3) * 0.04);
      ctx.moveTo(x + blob, y);
      ctx.arc(x, y, blob, 0, Math.PI * 2);
    }
    ctx.fill();

    // Splash droplets popping in over time
    const droplets = Math.floor(40 * e);
    for (let i = 0; i < droplets; i++) {
      const rng = Math.sin(seed + i * 12.9898) * 43758.5453;
      const fx = ((rng - Math.floor(rng)) + 1) % 1;
      const fy = ((Math.sin(seed + i * 78.233) * 43758.5453) + 1) % 1;
      const px = fx * W;
      const py = fy * H;
      const r = (Math.abs(Math.sin(seed + i * 3.7)) * 8 + 3) * (0.5 + e);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // Finalize: clear the canvas so the image shows unobstructed
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      canvas.style.opacity = "0";
    }
  }
  requestAnimationFrame(frame);
}

// Mounts the grid for one stop. `onTileClick(stop, idx)` opens the lightbox.
export function mountGallery(stop, container, onTileClick) {
  const total = stop.media.length;
  container.innerHTML = stop.media.map((m, i) => mediaTileHTML(m, i, total)).join("");

  container.addEventListener("click", e => {
    const btn = e.target.closest(".tile");
    if (!btn) return;
    onTileClick(stop, Number(btn.dataset.idx));
  });

  // Brush reveal when the parent stop enters the viewport.
  const stopEl = container.closest(".stop");
  if (!stopEl) return;

  const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduce) {
    // Skip the animation — just clear masks
    container.querySelectorAll(".tile-canvas").forEach(c => { c.style.display = "none"; });
    return;
  }

  let revealed = false;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || revealed) continue;
      if (entry.intersectionRatio < 0.35) continue;
      revealed = true;
      container.querySelectorAll(".tile-canvas").forEach((canvas, i) => {
        setTimeout(() => startBrushReveal(canvas), i * 90);
      });
      io.disconnect();
    }
  }, { threshold: [0.35, 0.6], root: document.getElementById("scroll") });
  io.observe(stopEl);
}
