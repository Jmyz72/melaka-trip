// Vermillion brush trail that follows the pointer. Canvas2D, simple chain of
// recent positions drawn with tapered width + opacity falloff.
// Disabled on touch devices and prefers-reduced-motion.

export function mountInkCursor(canvas) {
  if (!canvas) return { destroy() {} };
  const isTouch = matchMedia?.("(hover: none)").matches || ("ontouchstart" in window);
  const reduced = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (isTouch || reduced) {
    canvas.style.display = "none";
    return { destroy() {} };
  }

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth  + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const trail = [];   // { x, y, t }
  const MAX_AGE = 600;
  const MAX_PTS = 64;

  function onMove(e) {
    trail.push({ x: e.clientX * dpr, y: e.clientY * dpr, t: performance.now() });
    if (trail.length > MAX_PTS) trail.shift();
  }
  window.addEventListener("pointermove", onMove, { passive: true });

  let running = true;
  let rafId = null;

  function frame() {
    rafId = requestAnimationFrame(frame);
    if (!running) return;
    const now = performance.now();

    // Trim old
    while (trail.length && now - trail[0].t > MAX_AGE) trail.shift();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (trail.length < 2) return;

    // Draw a smooth tapered stroke with quadratic curve between points
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const age = (now - b.t) / MAX_AGE;
      const alpha = Math.max(0, 1 - age);
      const width = (10 - age * 9) * dpr;
      ctx.strokeStyle = `rgba(200, 57, 43, ${alpha * 0.85})`;
      ctx.lineWidth = Math.max(0.5, width);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      // mid-point for smoother curve
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.quadraticCurveTo(a.x, a.y, mx, my);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Tiny ink drop at the head
    const head = trail[trail.length - 1];
    const headAge = (now - head.t) / MAX_AGE;
    if (headAge < 0.2) {
      ctx.fillStyle = `rgba(200, 57, 43, ${0.55 * (1 - headAge / 0.2)})`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 5 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  rafId = requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  return {
    destroy() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
    }
  };
}
