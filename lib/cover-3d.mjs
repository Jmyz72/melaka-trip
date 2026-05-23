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

// Mirrors the trip order in memories.json — keep in sync when stops are
// added/removed. (Could be wired through props, but the postcard texture is
// built once at hero-mount time and the data is tiny.)
const STOPS = [
  { lat: 2.71268, lng: 101.91184, n: 1 }, // Jinbo Dim Sum
  { lat: 2.30832, lng: 102.30608, n: 2 }, // On the Road
  { lat: 2.19706, lng: 102.23151, n: 3 }, // Airbnb
  { lat: 2.19700, lng: 102.23133, n: 4 }, // Before Dinner
  { lat: 2.18196, lng: 102.26271, n: 5 }, // Wildseed Cafe & Bistro
  { lat: 2.19852, lng: 102.22788, n: 6 }, // Loklok
  { lat: 2.19666, lng: 102.23116, n: 7 }, // Late Night
  { lat: 2.19690, lng: 102.23130, n: 8 }, // Morning Morning
];

// Project lat/lng into the map panel rectangle. Bounds chosen to frame the
// Seremban → Melaka corridor with a comfortable margin.
const MAP_BOUNDS = {
  north: 2.85, south: 2.05,
  west:  101.70, east:  102.50
};
function projectLatLng(lat, lng, mapX, mapY, mapW, mapH) {
  const fx = (lng - MAP_BOUNDS.west)  / (MAP_BOUNDS.east  - MAP_BOUNDS.west);
  const fy = (MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south);
  return { x: mapX + fx * mapW, y: mapY + fy * mapH };
}

// Real southwest-Peninsular-Malaysia coastline points, ordered south→north,
// extracted from Natural Earth's admin-0 country boundaries (clipped to a
// 0.2° margin around MAP_BOUNDS). 49 vertices, accurate to ~1 km.
const COAST_SW_PENINSULA = [
  [102.6994, 1.8594], [102.6862, 1.8791], [102.6672, 1.9216], [102.6506, 1.9409],
  [102.5689, 2.0064], [102.5576, 2.0187], [102.5505, 2.0314], [102.5591, 2.0332],
  [102.5603, 2.0364], [102.5583, 2.0406], [102.5573, 2.0451], [102.5447, 2.0577],
  [102.5269, 2.0709], [102.4890, 2.0929], [102.3486, 2.1500], [102.1880, 2.2164],
  [102.1543, 2.2357], [102.1270, 2.2573], [102.0513, 2.3409], [102.0403, 2.3461],
  [102.0187, 2.3504], [101.9990, 2.3616], [101.9871, 2.3771], [101.9888, 2.3945],
  [101.9722, 2.3986], [101.9562, 2.4048], [101.9268, 2.4224], [101.9092, 2.4108],
  [101.8775, 2.4088], [101.8652, 2.3945], [101.8582, 2.4194], [101.8562, 2.4514],
  [101.8511, 2.4789], [101.8342, 2.4907], [101.8274, 2.4941], [101.8177, 2.5022],
  [101.8032, 2.5180], [101.7831, 2.5759], [101.7744, 2.5866], [101.7610, 2.5921],
  [101.7134, 2.5966], [101.7009, 2.6042], [101.6909, 2.6149], [101.6735, 2.6273],
  [101.6183, 2.6369], [101.5979, 2.6463], [101.5642, 2.6520], [101.5423, 2.6613],
  [101.5028, 2.6894]
];

// Hand-painted Melaka peninsula in watercolor style. Returns a CanvasTexture.
// No network calls — everything is drawn in code so GitHub Pages can't 401 us.
function buildFrontTexture() {
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

  // Clip the map region to a torn-edge shape
  ctx.save();
  ctx.beginPath();
  const torn = (n) => Math.sin(n * 7.3) * 4 + Math.sin(n * 13.1) * 2;
  ctx.moveTo(mapX, mapY + torn(0));
  for (let x = 0; x <= mapW; x += 8) ctx.lineTo(mapX + x, mapY + torn(x * 0.02));
  for (let y = 0; y <= mapH; y += 8) ctx.lineTo(mapX + mapW + torn(y * 0.02 + 5), mapY + y);
  for (let x = mapW; x >= 0; x -= 8) ctx.lineTo(mapX + x, mapY + mapH + torn(x * 0.02 + 10));
  for (let y = mapH; y >= 0; y -= 8) ctx.lineTo(mapX + torn(y * 0.02 + 15), mapY + y);
  ctx.closePath();
  ctx.clip();

  // ── Watercolor base: warm beige land wash ──
  const landGrad = ctx.createLinearGradient(mapX, mapY, mapX + mapW, mapY + mapH);
  landGrad.addColorStop(0,    "#e6d4a8");
  landGrad.addColorStop(0.5,  "#d9c690");
  landGrad.addColorStop(1,    "#cab47b");
  ctx.fillStyle = landGrad;
  ctx.fillRect(mapX, mapY, mapW, mapH);

  // Land "wet" blobs (forest patches, hill shadows)
  for (let i = 0; i < 18; i++) {
    const cx = mapX + Math.random() * mapW;
    const cy = mapY + Math.random() * mapH;
    const r  = 40 + Math.random() * 80;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,   "rgba(101, 122, 70, 0.18)");
    g.addColorStop(0.6, "rgba(101, 122, 70, 0.10)");
    g.addColorStop(1,   "rgba(101, 122, 70, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Strait of Malacca (sea) — real coastline from Natural Earth data ──
  // Project the SW-Peninsula coastline polyline (south→north) into canvas
  // pixel space. Some endpoints land outside the map rect; that's fine,
  // they get clipped by the torn-edge clip path already in effect.
  const coastPx = COAST_SW_PENINSULA.map(([lng, lat]) =>
    projectLatLng(lat, lng, mapX, mapY, mapW, mapH)
  );

  // Sea fill polygon. Going clockwise so the sea (west of coast) is inside:
  //   far-NW → far-SW → far-SE → coast(south→north) → close back to far-NW.
  // The "far" corners sit comfortably outside the torn-edge clip, so the
  // polygon always fully covers the visible sea region.
  const FAR = 80;
  ctx.beginPath();
  ctx.moveTo(mapX - FAR,         mapY - FAR);
  ctx.lineTo(mapX - FAR,         mapY + mapH + FAR);
  ctx.lineTo(mapX + mapW + FAR,  mapY + mapH + FAR);
  for (let i = 0; i < coastPx.length; i++) ctx.lineTo(coastPx[i].x, coastPx[i].y);
  ctx.closePath();
  const seaGrad = ctx.createLinearGradient(mapX, mapY, mapX + 0.5 * mapW, mapY);
  seaGrad.addColorStop(0,   "#7fa9b8");
  seaGrad.addColorStop(0.6, "#a8c3cf");
  seaGrad.addColorStop(1,   "#c7d6dd");
  ctx.fillStyle = seaGrad;
  ctx.fill();

  // Sea wave hatching — re-fill clipped to the sea polygon so we don't have
  // to compute coast intersection per scanline.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mapX - FAR,         mapY - FAR);
  ctx.lineTo(mapX - FAR,         mapY + mapH + FAR);
  ctx.lineTo(mapX + mapW + FAR,  mapY + mapH + FAR);
  for (let i = 0; i < coastPx.length; i++) ctx.lineTo(coastPx[i].x, coastPx[i].y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = "rgba(58, 90, 110, 0.28)";
  ctx.lineWidth = 0.9;
  for (let y = mapY + 8; y < mapY + mapH; y += 14) {
    ctx.beginPath();
    for (let x = mapX; x < mapX + mapW; x += 8) {
      const offset = Math.sin((x + y) * 0.18) * 1.6;
      if (x === mapX) ctx.moveTo(x, y + offset);
      else            ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Coastline ink stroke — just the coast trace itself, not the polygon close.
  ctx.beginPath();
  ctx.strokeStyle = "rgba(40, 60, 80, 0.6)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < coastPx.length; i++) {
    const p = coastPx[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else         ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // ── Cities ──
  function drawCity(x, y, name, big) {
    const r = big ? 7 : 4;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(58, 50, 30, 0.18)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#3a2a18";
    ctx.fill();
    ctx.fillStyle = "#3a2a18";
    ctx.font = `italic ${big ? 16 : 12}px 'EB Garamond', serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(name, x + r + 6, y);
  }
  const ser = projectLatLng(2.7259, 101.9424, mapX, mapY, mapW, mapH);
  const mel = projectLatLng(2.1896, 102.2501, mapX, mapY, mapW, mapH);
  drawCity(ser.x, ser.y, "Seremban", false);
  drawCity(mel.x, mel.y, "Melaka",   true);

  // Compass rose, bottom-left land area
  const compassX = mapX + mapW * 0.42;
  const compassY = mapY + mapH * 0.92;
  ctx.save();
  ctx.translate(compassX, compassY);
  ctx.fillStyle = "rgba(58, 50, 30, 0.5)";
  ctx.font = "10px 'EB Garamond', serif";
  ctx.textAlign = "center";
  ctx.fillText("N", 0, -14);
  ctx.beginPath();
  ctx.moveTo(0, -10); ctx.lineTo(3, 0); ctx.lineTo(-3, 0); ctx.closePath();
  ctx.fillStyle = "rgba(58, 50, 30, 0.6)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 10);  ctx.lineTo(3, 0); ctx.lineTo(-3, 0); ctx.closePath();
  ctx.fillStyle = "rgba(58, 50, 30, 0.2)";
  ctx.fill();
  ctx.restore();

  // "Strait of Malacca" label in italic over the sea
  ctx.save();
  ctx.translate(mapX + mapW * 0.10, mapY + mapH * 0.45);
  ctx.rotate(-Math.PI / 2.4);
  ctx.fillStyle = "rgba(40, 60, 80, 0.55)";
  ctx.font = "italic 13px 'EB Garamond', serif";
  ctx.textAlign = "center";
  ctx.fillText("Strait of Malacca", 0, 0);
  ctx.restore();

  // ── Trip polyline + pins ──
  // Project each stop, then detect clusters: any pin closer than
  // CLUSTER_RADIUS_PX to an earlier pin gets a small radial offset so it
  // doesn't stack invisibly. Both the polyline and the pin marker use the
  // adjusted position so the route's zig-zag stays visible.
  const CLUSTER_RADIUS_PX = 22;
  const FAN_R = 16;
  const FAN_DIRS = [
    [0, 0],                       // first pin in a cluster: no offset
    [Math.cos(-Math.PI / 6),  Math.sin(-Math.PI / 6)],   // upper-right
    [Math.cos(-5 * Math.PI / 6), Math.sin(-5 * Math.PI / 6)], // upper-left
    [Math.cos(Math.PI / 2),  Math.sin(Math.PI / 2)],      // straight down
    [Math.cos(-Math.PI / 2), Math.sin(-Math.PI / 2)],     // straight up
    [Math.cos(5 * Math.PI / 6),  Math.sin(5 * Math.PI / 6)],  // lower-left
    [Math.cos(Math.PI / 6),  Math.sin(Math.PI / 6)]       // lower-right
  ];

  const pinPos = [];
  for (const s of STOPS) {
    const base = projectLatLng(s.lat, s.lng, mapX, mapY, mapW, mapH);
    let neighbours = 0;
    for (const p of pinPos) {
      const dx = base.x - p.baseX;
      const dy = base.y - p.baseY;
      if (dx * dx + dy * dy < CLUSTER_RADIUS_PX * CLUSTER_RADIUS_PX) neighbours++;
    }
    const [dx, dy] = FAN_DIRS[neighbours % FAN_DIRS.length];
    pinPos.push({
      x: base.x + dx * FAN_R,
      y: base.y + dy * FAN_R,
      baseX: base.x,
      baseY: base.y,
      n: s.n
    });
  }

  // Polyline with hand-jitter
  ctx.strokeStyle = "#c8392b";
  ctx.lineWidth = 2.4;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  for (let i = 0; i < pinPos.length; i++) {
    const a = pinPos[i];
    if (i === 0) { ctx.moveTo(a.x, a.y); continue; }
    const prev = pinPos[i - 1];
    // Bezier with jittered control points for hand-drawn feel
    const cx = (prev.x + a.x) / 2 + (Math.random() - 0.5) * 14;
    const cy = (prev.y + a.y) / 2 + (Math.random() - 0.5) * 14;
    ctx.quadraticCurveTo(cx, cy, a.x, a.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Pin markers
  pinPos.forEach(p => {
    // Halo
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200, 57, 43, 0.18)";
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = "#c8392b";
    ctx.fill();
    ctx.strokeStyle = "#f4ead5";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Number
    ctx.fillStyle = "#f4ead5";
    ctx.font = "bold 13px 'EB Garamond', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(p.n), p.x, p.y + 0.5);
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
