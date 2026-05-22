// Canvas2D particle splash: vermillion ink droplets that explode from a point
// with physics, gravity, and splatter trails. Used for:
//   - seal impact in the 3D cover
//   - rating star clicks
//
// The canvas (#splash) is a fullscreen overlay above content, behind lightbox.
// We keep ONE global particle system to amortize draw cost across many bursts.

let canvas = null;
let ctx = null;
let dpr = 1;
let particles = [];
let running = false;
let rafId = null;

function ensure() {
  if (canvas) return;
  canvas = document.getElementById("splash");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  resize();
  window.addEventListener("resize", resize, { passive: true });
}

function resize() {
  if (!canvas) return;
  canvas.width  = Math.floor(window.innerWidth  * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = window.innerWidth  + "px";
  canvas.style.height = window.innerHeight + "px";
}

function spawn(x, y, opts) {
  const {
    count = 60,
    color = "#c8392b",
    speed = 6,
    gravity = 0.35,
    life = 800,
    spread = Math.PI * 2,   // full radial by default
    direction = -Math.PI / 2,
    size = 5
  } = opts || {};
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const angle = direction - spread / 2 + Math.random() * spread;
    const v = speed * (0.4 + Math.random());
    const vx = Math.cos(angle) * v;
    const vy = Math.sin(angle) * v;
    particles.push({
      x: x * dpr, y: y * dpr,
      vx: vx * dpr, vy: vy * dpr,
      r: (size * 0.4 + Math.random() * size) * dpr,
      color,
      born: start,
      life: life * (0.6 + Math.random() * 0.8),
      gravity: gravity * dpr,
      trail: []
    });
  }
  if (!running) start_loop();
}

function start_loop() {
  if (running) return;
  running = true;
  let lastT = performance.now();

  function step(now) {
    rafId = requestAnimationFrame(step);
    const dt = Math.min(32, now - lastT);
    lastT = now;
    if (!ctx || !canvas) return;

    // Subtle fade of previous frame (creates trails)
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";

    let alive = 0;
    for (const p of particles) {
      const age = now - p.born;
      if (age > p.life) continue;
      alive++;
      // Integrate
      p.vy += p.gravity * (dt / 16);
      p.vx *= 0.992;
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      // Fade with life
      const t = age / p.life;
      const a = Math.max(0, 1 - t);
      // Draw drop
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.arc(p.x, p.y, p.r * (1 - t * 0.2), 0, Math.PI * 2);
      ctx.fill();
      // Trail streak
      ctx.globalAlpha = a * 0.4;
      ctx.beginPath();
      ctx.lineWidth = p.r * 1.2;
      ctx.lineCap = "round";
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x - p.vx * 0.6, p.y - p.vy * 0.6);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // GC dead particles
    if (alive < particles.length * 0.5) {
      particles = particles.filter(p => (now - p.born) <= p.life);
    }
    if (alive === 0 && particles.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      running = false;
      cancelAnimationFrame(rafId);
    }
  }
  rafId = requestAnimationFrame(step);
}

// Public API ─ small radial burst at screen-space (x, y)
export function burst(x, y, opts) {
  ensure();
  if (!ctx) return;
  spawn(x, y, opts);
}

// Smaller decorative ripple at a click point (used for star clicks).
// Direction = upward, narrower spread, shorter life.
export function rate_splash(x, y, color) {
  ensure();
  if (!ctx) return;
  spawn(x, y, {
    count: 36,
    color: color || "#c8392b",
    speed: 5,
    spread: Math.PI * 1.4,
    direction: -Math.PI / 2,
    life: 650,
    size: 4,
    gravity: 0.42
  });
}
