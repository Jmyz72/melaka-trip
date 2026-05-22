// 3D postcard hero, Three.js scene mounted into #cover-3d-mount.
// - Postcard mesh with a procedurally-generated watercolor-map front texture
//   (fetched from Stamen tiles + composited with hand-drawn pins and stamps)
//   and a "wish you were here" back.
// - Vermillion seal mesh drops from above with a satisfying bounce; on impact
//   we spawn a Canvas2D particle splash via lib/rating-splash.mjs's burst().
// - Drag/swipe rotates the card with momentum; supports mouse + touch.
// - Device-tilt parallax on mobile via DeviceOrientation.
// - Unmounts when the cover section scrolls out of view to save GPU.

import * as THREE from "https://esm.sh/three@0.160.0";
import { burst } from "./rating-splash.mjs";

// ── Texture composition ──────────────────────────────────────────────

const STOPS = [
  { lat: 2.7127, lng: 101.9118, n: 1 }, // Jinbo Dim Sum (Seremban-ish)
  { lat: 2.3083, lng: 102.3060, n: 2 }, // On the road
  { lat: 2.1970, lng: 102.2315, n: 3 }, // Airbnb
  { lat: 2.1819, lng: 102.2627, n: 4 }  // Wildseed
];

// Lat/lng → tile coords for a given zoom (Web Mercator)
function lngToTileX(lng, z) { return (lng + 180) / 360 * Math.pow(2, z); }
function latToTileY(lat, z) {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function buildFrontTexture() {
  // 1024×640 canvas — postcard-ish 1.6:1 ratio
  const W = 1024, H = 640;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Cream paper base
  ctx.fillStyle = "#f0e4c8";
  ctx.fillRect(0, 0, W, H);

  // Paper grain
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(90,74,42,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  // Airmail bars around the edge
  const bar = 14;
  for (let s = 0; s < W + H; s += 22) {
    ctx.save();
    ctx.fillStyle = (Math.floor(s / 22) % 2 === 0) ? "#c8392b" : "#1d2b4f";
    // Top
    ctx.fillRect(s - 11, 0, 11, bar);
    // Bottom
    ctx.fillRect(W - s + 11, H - bar, 11, bar);
    ctx.restore();
  }

  // Split the card: left half = map, right half = address
  const mapPad = 30;
  const mapW = W * 0.55 - mapPad * 2;
  const mapH = H - mapPad * 2 - bar * 2;
  const mapX = mapPad;
  const mapY = mapPad + bar;

  // Map background — try to fetch Stamen Watercolor tiles for Melaka.
  // If it fails (no network, CORS), fall back to a hand-painted gradient.
  const Z = 11;
  const centerLat = 2.35, centerLng = 102.15;
  const tx = lngToTileX(centerLng, Z);
  const ty = latToTileY(centerLat, Z);
  const tileSize = 256;
  // Grid: 3x3 tiles around center
  const gridN = 3;
  const baseTx = Math.floor(tx) - 1;
  const baseTy = Math.floor(ty) - 1;
  const composite = document.createElement("canvas");
  composite.width  = tileSize * gridN;
  composite.height = tileSize * gridN;
  const cctx = composite.getContext("2d");
  cctx.fillStyle = "#e8dcc0";
  cctx.fillRect(0, 0, composite.width, composite.height);

  try {
    const promises = [];
    for (let gx = 0; gx < gridN; gx++) {
      for (let gy = 0; gy < gridN; gy++) {
        const url = `https://tiles.stadiamaps.com/tiles/stamen_watercolor/${Z}/${baseTx + gx}/${baseTy + gy}.jpg`;
        promises.push(loadImage(url).then(img => {
          cctx.drawImage(img, gx * tileSize, gy * tileSize);
        }).catch(() => {/* skip missing tile */}));
      }
    }
    await Promise.all(promises);
  } catch (_) { /* network failure → fallback gradient stays */ }

  // Clip the map region to a torn-edge shape
  ctx.save();
  ctx.beginPath();
  // Hand-wavy torn rectangle
  const torn = (n) => Math.sin(n * 7.3) * 4 + Math.sin(n * 13.1) * 2;
  ctx.moveTo(mapX, mapY + torn(0));
  for (let x = 0; x <= mapW; x += 8) ctx.lineTo(mapX + x, mapY + torn(x * 0.02));
  for (let y = 0; y <= mapH; y += 8) ctx.lineTo(mapX + mapW + torn(y * 0.02 + 5), mapY + y);
  for (let x = mapW; x >= 0; x -= 8) ctx.lineTo(mapX + x, mapY + mapH + torn(x * 0.02 + 10));
  for (let y = mapH; y >= 0; y -= 8) ctx.lineTo(mapX + torn(y * 0.02 + 15), mapY + y);
  ctx.closePath();
  ctx.clip();

  // Draw the composited tiles into the clipped region
  ctx.drawImage(
    composite,
    0, 0, composite.width, composite.height,
    mapX - 60, mapY - 60, mapW + 120, mapH + 120
  );

  // Trip pins + connecting polyline (in tile-pixel coords → map-pixel coords)
  const pinPos = STOPS.map(s => {
    const ttx = lngToTileX(s.lng, Z);
    const tty = latToTileY(s.lat, Z);
    const px = (ttx - baseTx) * tileSize;
    const py = (tty - baseTy) * tileSize;
    return {
      x: mapX + (px / composite.width) * (mapW + 120) - 60,
      y: mapY + (py / composite.height) * (mapH + 120) - 60,
      n: s.n
    };
  });

  // Polyline
  ctx.strokeStyle = "#c8392b";
  ctx.lineWidth = 2.2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  pinPos.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
  ctx.stroke();
  ctx.setLineDash([]);

  // Pin markers
  pinPos.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#c8392b";
    ctx.fill();
    ctx.strokeStyle = "#f4ead5";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#f4ead5";
    ctx.font = "bold 14px 'EB Garamond', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(p.n), p.x, p.y + 1);
  });

  ctx.restore();

  // ── Right half: address block ───────────────────────────────────
  const ax = W * 0.6;
  const ay = mapY + 20;

  ctx.fillStyle = "#1d2b4f";

  // "Postcard" label tiny mono
  ctx.font = "9px ui-monospace, monospace";
  ctx.fillStyle = "#5a4a2a";
  ctx.fillText("P · O · S · T · C · A · R · D", ax + 4, ay - 4);

  // Big "Melaka" handbrush
  ctx.font = "italic 64px 'EB Garamond', serif";
  ctx.fillStyle = "#1d2b4f";
  ctx.textAlign = "left";
  ctx.fillText("Melaka", ax, ay + 56);

  // Chinese subscript
  ctx.font = "36px 'Ma Shan Zheng', serif";
  ctx.fillStyle = "#9e2a1e";
  ctx.fillText("马六甲", ax, ay + 104);

  // Address lines
  ctx.font = "italic 18px 'EB Garamond', serif";
  ctx.fillStyle = "#3a4a78";
  const lines = [
    "to: my dearest friends,",
    "wherever you are reading this —",
    "",
    "three days, painted slowly,",
    "in indigo & vermillion.",
    "",
    "— C. & co.",
    "  XXII · V · MMXXVI"
  ];
  lines.forEach((line, i) => ctx.fillText(line, ax, ay + 150 + i * 26));

  // Hand-drawn stamp box top-right
  ctx.strokeStyle = "#5a4a2a";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(W - 100, mapY + 10, 70, 90);
  ctx.setLineDash([]);
  ctx.font = "9px ui-monospace, monospace";
  ctx.fillStyle = "#8a7550";
  ctx.fillText("STAMP", W - 86, mapY + 56);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBackTexture() {
  const W = 1024, H = 640;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ead9b0";
  ctx.fillRect(0, 0, W, H);
  // Grain
  for (let i = 0; i < 3500; i++) {
    ctx.fillStyle = `rgba(90,74,42,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  ctx.fillStyle = "#1d2b4f";
  ctx.font = "italic 56px 'EB Garamond', serif";
  ctx.fillText("wish you were here,", 70, 200);
  ctx.fillStyle = "#9e2a1e";
  ctx.font = "44px 'Ma Shan Zheng', serif";
  ctx.fillText("愿你也在这里。", 70, 280);

  ctx.fillStyle = "#3a4a78";
  ctx.font = "italic 22px 'EB Garamond', serif";
  const lines = [
    "the durian fields glow at dusk.",
    "the river tastes like memory.",
    "every stop, a small permanence."
  ];
  lines.forEach((l, i) => ctx.fillText(l, 70, 340 + i * 36));

  ctx.fillStyle = "#5a4a2a";
  ctx.font = "italic 20px 'Caveat', cursive";
  ctx.fillText("— turn me over to see the journey", 70, 540);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSealTexture() {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, S, S);
  // Slightly irregular vermillion square — ink-stamp feel
  ctx.fillStyle = "#c8392b";
  ctx.beginPath();
  const inset = 40;
  const wig = () => (Math.random() - 0.5) * 8;
  ctx.moveTo(inset + wig(), inset + wig());
  for (let x = inset; x <= S - inset; x += 12) ctx.lineTo(x + wig(), inset + wig());
  for (let y = inset; y <= S - inset; y += 12) ctx.lineTo(S - inset + wig(), y + wig());
  for (let x = S - inset; x >= inset; x -= 12) ctx.lineTo(x + wig(), S - inset + wig());
  for (let y = S - inset; y >= inset; y -= 12) ctx.lineTo(inset + wig(), y + wig());
  ctx.closePath();
  ctx.fill();

  // White inner border
  ctx.strokeStyle = "#f4ead5";
  ctx.lineWidth = 8;
  ctx.strokeRect(inset + 24, inset + 24, S - 2 * (inset + 24), S - 2 * (inset + 24));

  // 马六甲印 in 4 squares
  ctx.fillStyle = "#f4ead5";
  ctx.font = "bold 130px 'Ma Shan Zheng', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("马", S * 0.32, S * 0.36);
  ctx.fillText("六", S * 0.68, S * 0.36);
  ctx.fillText("甲", S * 0.32, S * 0.66);
  ctx.fillText("印", S * 0.68, S * 0.66);

  // Ink mottling / specks
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const insideX = x > inset && x < S - inset;
    const insideY = y > inset && y < S - inset;
    if (insideX && insideY) {
      ctx.fillStyle = `rgba(244,234,213,${Math.random() * 0.15})`;
    } else continue;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  return tex;
}

// ── Scene setup ──────────────────────────────────────────────────────

export async function mountCover3D(mountEl, { onSealImpact } = {}) {
  const width  = mountEl.clientWidth;
  const height = mountEl.clientHeight;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mountEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  // Lights
  const ambient = new THREE.AmbientLight(0xfff2d8, 0.65);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff5dd, 0.85);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9c4e0, 0.35);
  rim.position.set(-4, -2, 4);
  scene.add(rim);

  // Postcard mesh: a slightly-thick plane, two-sided materials
  const cardW = 5.6, cardH = 3.5, cardT = 0.06;
  const cardGeo = new THREE.BoxGeometry(cardW, cardH, cardT);

  // 6 materials for box face order: +X, -X, +Y, -Y, +Z (front), -Z (back)
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xead9b0, roughness: 0.95 });

  // Placeholder texture so we can mount instantly; swap when async textures resolve
  const placeholder = new THREE.MeshStandardMaterial({ color: 0xead9b0, roughness: 0.85 });
  const frontMat = placeholder.clone();
  const backMat  = placeholder.clone();

  const cardMats = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];
  const card = new THREE.Mesh(cardGeo, cardMats);
  card.castShadow = true;
  scene.add(card);

  // Load textures
  Promise.all([buildFrontTexture(), Promise.resolve(buildBackTexture())]).then(([front, back]) => {
    frontMat.map = front;
    frontMat.roughness = 0.78;
    frontMat.needsUpdate = true;
    backMat.map = back;
    backMat.roughness = 0.78;
    backMat.needsUpdate = true;
  });

  // Seal: plane with seal texture, starts above camera, drops down
  const sealSize = 1.05;
  const sealGeo = new THREE.PlaneGeometry(sealSize, sealSize);
  const sealMat = new THREE.MeshStandardMaterial({
    map: buildSealTexture(),
    transparent: true,
    roughness: 0.6
  });
  const seal = new THREE.Mesh(sealGeo, sealMat);
  // Position on the bottom-right of the card front
  const sealRestX = cardW * 0.32;
  const sealRestY = -cardH * 0.28;
  const sealRestZ = cardT / 2 + 0.01;
  seal.position.set(sealRestX, 4.5, sealRestZ);
  seal.rotation.z = -0.18;
  seal.scale.setScalar(2.2);
  seal.material.opacity = 0;
  card.add(seal);

  // ── Seal drop animation ──
  const dropStart = performance.now() + 600; // brief delay
  const dropDuration = 720;
  const settleDuration = 280;
  let sealLanded = false;

  function easeBounce(t) {
    // Cubic ease-in then small overshoot
    if (t < 0.7) {
      const p = t / 0.7;
      return p * p * p;
    } else {
      const p = (t - 0.7) / 0.3;
      const o = 1 - Math.pow(1 - p, 3);
      return 1 + Math.sin(o * Math.PI) * 0.06; // overshoot bump
    }
  }

  function updateSeal(now) {
    if (sealLanded) {
      // Subtle hover
      seal.position.y = sealRestY + Math.sin(now * 0.001) * 0.02;
      return;
    }
    const t = (now - dropStart) / dropDuration;
    if (t < 0) return;
    if (t < 1) {
      const e = easeBounce(t);
      seal.position.y = 4.5 - e * (4.5 - sealRestY);
      seal.position.x = sealRestX + (1 - e) * 0.3;
      seal.rotation.z = -0.18 - (1 - e) * 0.6;
      seal.scale.setScalar(2.2 - e * (2.2 - 1));
      seal.material.opacity = Math.min(1, t * 2);
    } else {
      // Land!
      seal.position.set(sealRestX, sealRestY, sealRestZ);
      seal.rotation.z = -0.18 + (Math.random() - 0.5) * 0.05;
      seal.scale.setScalar(1);
      seal.material.opacity = 1;
      sealLanded = true;
      // Splash burst in screen coords
      const v = new THREE.Vector3();
      seal.getWorldPosition(v);
      v.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      const sx = (v.x * 0.5 + 0.5) * rect.width  + rect.left;
      const sy = (1 - (v.y * 0.5 + 0.5)) * rect.height + rect.top;
      if (onSealImpact) onSealImpact(sx, sy);
      else burst(sx, sy, { count: 120, color: "#c8392b" });
    }
  }

  // ── Drag rotation with momentum ──
  let dragging = false;
  let lastX = 0, lastY = 0;
  let velX = 0, velY = 0;
  let targetRotY = 0;
  let targetRotX = -0.08;

  function down(clientX, clientY) {
    dragging = true;
    lastX = clientX; lastY = clientY;
    velX = 0; velY = 0;
  }
  function move(clientX, clientY) {
    if (!dragging) return;
    const dx = clientX - lastX;
    const dy = clientY - lastY;
    lastX = clientX; lastY = clientY;
    velX = dx * 0.008;
    velY = dy * 0.008;
    targetRotY += velX;
    targetRotX += velY;
    targetRotX = Math.max(-1.4, Math.min(1.4, targetRotX));
  }
  function up() { dragging = false; }

  renderer.domElement.addEventListener("pointerdown", e => {
    e.preventDefault();
    renderer.domElement.setPointerCapture(e.pointerId);
    down(e.clientX, e.clientY);
  });
  renderer.domElement.addEventListener("pointermove", e => {
    if (dragging) move(e.clientX, e.clientY);
  });
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", up);

  // Device tilt parallax (only when not dragging)
  let tiltX = 0, tiltY = 0;
  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    tiltY = Math.max(-1, Math.min(1, e.gamma / 30));
    tiltX = Math.max(-1, Math.min(1, (e.beta - 30) / 40));
  }
  window.addEventListener("deviceorientation", onOrientation);

  // ── Animation loop ──
  let running = true;
  let rafId = null;
  let lastT = performance.now();

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (!running) return;

    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    // Apply momentum when not dragging
    if (!dragging) {
      velX *= 0.95;
      velY *= 0.95;
      targetRotY += velX;
      targetRotX += velY;
      targetRotX = Math.max(-1.4, Math.min(1.4, targetRotX));
      // Gentle auto-rotate when idle (very subtle)
      const idleAmp = (Math.abs(velX) + Math.abs(velY)) < 0.0005 ? 1 : 0;
      targetRotY += Math.sin(now * 0.0004) * 0.0008 * idleAmp;
      // Tilt parallax
      targetRotY += (tiltY * 0.4 - card.rotation.y * 0 - 0) * 0.02 * idleAmp;
      targetRotX += (-tiltX * 0.3 - card.rotation.x * 0 - 0) * 0.02 * idleAmp;
    }

    // Ease toward targets
    card.rotation.y += (targetRotY - card.rotation.y) * 0.12;
    card.rotation.x += (targetRotX - card.rotation.x) * 0.12;

    updateSeal(now);

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(frame);

  // Resize
  function resize() {
    const w = mountEl.clientWidth;
    const h = mountEl.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(mountEl);

  // Pause on tab hidden
  function onVisibility() { running = !document.hidden; lastT = performance.now(); }
  document.addEventListener("visibilitychange", onVisibility);

  return {
    pause()  { running = false; },
    resume() { running = true; lastT = performance.now(); },
    destroy() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("deviceorientation", onOrientation);
      renderer.dispose();
      mountEl.removeChild(renderer.domElement);
    }
  };
}
