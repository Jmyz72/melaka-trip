// WebGL ink-on-paper background. Pointer movement injects indigo ink that
// bleeds and curls via a curl-noise advection field; the result decays each
// frame so old ink fades. Single ping-pong RGBA texture, byte precision —
// works on virtually every device. Falls back to a CSS gradient when WebGL
// is unavailable.
//
// Usage: const fluid = mountFluidBG(canvasEl); fluid.pause(); fluid.resume();

const VERT_SRC = `
  attribute vec2 aPos;
  varying vec2 vUV;
  void main() {
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

// Step shader: sample previous frame displaced by a curl-noise + decay + splat
const STEP_SRC = `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D uPrev;
  uniform vec2  uResolution;
  uniform vec2  uMouse;     // 0..1
  uniform vec2  uMouseVel;  // 0..1 per frame
  uniform float uMouseStrength;
  uniform float uTime;
  uniform float uDecay;

  // hash + value noise
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
  vec2 curl(vec2 p) {
    float e = 0.01;
    float n1 = fbm(p + vec2(0.0,  e));
    float n2 = fbm(p - vec2(0.0,  e));
    float n3 = fbm(p + vec2(e,  0.0));
    float n4 = fbm(p - vec2(e,  0.0));
    return vec2(n1 - n2, n4 - n3);
  }

  void main() {
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 uv = vUV;

    // Velocity field: slow curl noise + mouse impulse drift
    vec2 cv = curl(uv * 2.6 * aspect + uTime * 0.04) * 0.0015;

    // Advection: sample previous frame backward along velocity
    vec4 prev = texture2D(uPrev, uv - cv);

    // Decay (ink slowly dries)
    vec4 col = prev * uDecay;

    // Splat: mouse adds ink with directional spread along mouseVel.
    // The blob is wide + soft so ink spreads as a wash instead of pooling
    // into a hard, glitch-like dot.
    vec2 toMouse = (uv - uMouse) * aspect;
    float d = length(toMouse);
    float blob = exp(-d * d / 0.014);
    float speed = clamp(length(uMouseVel) * 50.0, 0.0, 4.0);
    float ink   = blob * (0.085 + speed * 0.13) * uMouseStrength;
    // Indigo ink, nudged a hair warmer + desaturated so it sits inside the
    // cream→vermillion palette instead of reading as a cold blue light-leak.
    vec3 inkColor = vec3(0.16, 0.21, 0.33);
    col.rgb += inkColor * ink;
    col.a   += ink * 0.5;

    // Subtle ambient: a quiet wash of ink from the noise field so the screen
    // is never fully empty
    float ambient = fbm(uv * 1.8 + uTime * 0.015) * 0.0004;
    col.rgb += inkColor * ambient;
    col.a   += ambient * 0.35;

    // Cap accumulation: alpha can never build into a saturated blob, so the
    // wash stays atmospheric no matter how long the pointer dwells.
    col.a = min(col.a, 0.42);

    gl_FragColor = clamp(col, 0.0, 1.0);
  }
`;

// Display shader: composite ink texture over paper
const DISPLAY_SRC = `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D uTex;
  uniform float uTime;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec4 ink = texture2D(uTex, vUV);
    // Paper base
    vec3 paper = vec3(0.957, 0.918, 0.835);
    // Subtle paper grain — also acts as dithering that breaks up 8-bit
    // banding in the smooth ink gradient (the source of the "prismatic" smear)
    float grain = (hash(floor(vUV * 1400.0)) - 0.5) * 0.026;
    paper += grain;
    // Ink over paper with a gentle multiply-ish blend. Kept faint so the wash
    // reads as a breath of ink on the paper, never a solid stain.
    vec3 col = paper * (1.0 - ink.a * 0.34) + ink.rgb * ink.a * 0.62;
    // Slight vignette
    float v = smoothstep(1.2, 0.4, distance(vUV, vec2(0.5)));
    col *= mix(0.92, 1.0, v);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("Shader compile failed:", gl.getShaderInfoLog(sh), src);
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function link(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("Program link failed:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function makeTexture(gl, w, h) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function makeFBO(gl, w, h) {
  const tex = makeTexture(gl, w, h);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, w, h };
}

export function mountFluidBG(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: "high-performance", premultipliedAlpha: false,
    preserveDrawingBuffer: false
  });
  if (!gl) {
    canvas.style.display = "none";
    document.body.style.background =
      "radial-gradient(1200px 800px at 30% 30%, #ead9b0 0%, #f4ead5 60%)";
    return { pause(){}, resume(){}, destroy(){} };
  }

  // Compile programs
  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fsStep    = compile(gl, gl.FRAGMENT_SHADER, STEP_SRC);
  const fsDisplay = compile(gl, gl.FRAGMENT_SHADER, DISPLAY_SRC);
  const progStep    = link(gl, vs, fsStep);
  const progDisplay = link(gl, vs, fsDisplay);

  // Full-screen quad
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1, 1,
    -1,  1,  1, -1,  1, 1
  ]), gl.STATIC_DRAW);

  let simW = 0, simH = 0, viewW = 0, viewH = 0;
  let fboA = null, fboB = null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Sim runs at 0.5x DPR; display at full
  const simScale = 0.5;

  function resize() {
    viewW = Math.max(1, Math.floor(window.innerWidth  * dpr));
    viewH = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.width  = viewW;
    canvas.height = viewH;
    canvas.style.width  = window.innerWidth  + "px";
    canvas.style.height = window.innerHeight + "px";

    const newSimW = Math.max(1, Math.floor(viewW * simScale));
    const newSimH = Math.max(1, Math.floor(viewH * simScale));
    if (newSimW !== simW || newSimH !== simH) {
      simW = newSimW; simH = newSimH;
      if (fboA) gl.deleteFramebuffer(fboA.fbo), gl.deleteTexture(fboA.tex);
      if (fboB) gl.deleteFramebuffer(fboB.fbo), gl.deleteTexture(fboB.tex);
      fboA = makeFBO(gl, simW, simH);
      fboB = makeFBO(gl, simW, simH);
      // Clear initial textures to paper color
      for (const f of [fboA, fboB]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
        gl.viewport(0, 0, simW, simH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  // Pointer tracking
  let mouseX = 0.5, mouseY = 0.5;
  let mouseVX = 0, mouseVY = 0;
  let mouseStrength = 0; // 0..1, drops when pointer leaves
  let lastMoveTime = 0;
  function onMove(clientX, clientY) {
    const nx = clientX / window.innerWidth;
    const ny = 1.0 - clientY / window.innerHeight;
    mouseVX = nx - mouseX;
    mouseVY = ny - mouseY;
    mouseX = nx;
    mouseY = ny;
    mouseStrength = 1.0;
    lastMoveTime = performance.now();
  }
  window.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (e.touches.length) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // Initial drift so the screen isn't empty before the first pointer move
  let driftAngle = Math.random() * Math.PI * 2;
  function ambientDrift(now) {
    if (now - lastMoveTime < 1500) return;
    driftAngle += 0.008;
    mouseX = 0.5 + Math.cos(driftAngle) * 0.34;
    mouseY = 0.5 + Math.sin(driftAngle * 1.3) * 0.32;
    mouseVX = -Math.sin(driftAngle) * 0.004;
    mouseVY = Math.cos(driftAngle * 1.3) * 0.004 * 1.3;
    mouseStrength = 0.16;
  }

  // Attribute locations
  const aPosStep    = gl.getAttribLocation(progStep,    "aPos");
  const aPosDisplay = gl.getAttribLocation(progDisplay, "aPos");

  let running = true;
  let lastFrame = 0;
  const TARGET_FPS = 30;
  const FRAME_MS = 1000 / TARGET_FPS;
  let rafId = null;
  let startT = performance.now();

  function render(now) {
    rafId = requestAnimationFrame(render);
    if (!running) return;
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;

    ambientDrift(now);

    const time = (now - startT) / 1000;

    // ── Step pass: A → B
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fbo);
    gl.viewport(0, 0, simW, simH);
    gl.useProgram(progStep);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPosStep);
    gl.vertexAttribPointer(aPosStep, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.uniform1i (gl.getUniformLocation(progStep, "uPrev"), 0);
    gl.uniform2f (gl.getUniformLocation(progStep, "uResolution"), simW, simH);
    gl.uniform2f (gl.getUniformLocation(progStep, "uMouse"), mouseX, mouseY);
    gl.uniform2f (gl.getUniformLocation(progStep, "uMouseVel"), mouseVX, mouseVY);
    gl.uniform1f (gl.getUniformLocation(progStep, "uMouseStrength"), mouseStrength);
    gl.uniform1f (gl.getUniformLocation(progStep, "uTime"), time);
    gl.uniform1f (gl.getUniformLocation(progStep, "uDecay"), 0.985);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // ── Display pass: B → screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, viewW, viewH);
    gl.useProgram(progDisplay);
    gl.enableVertexAttribArray(aPosDisplay);
    gl.vertexAttribPointer(aPosDisplay, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboB.tex);
    gl.uniform1i(gl.getUniformLocation(progDisplay, "uTex"), 0);
    gl.uniform1f(gl.getUniformLocation(progDisplay, "uTime"), time);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap
    const tmp = fboA; fboA = fboB; fboB = tmp;

    // Decay mouse strength
    mouseStrength *= 0.965;
    mouseVX *= 0.88;
    mouseVY *= 0.88;
  }

  rafId = requestAnimationFrame(render);

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  return {
    pause()   { running = false; },
    resume()  { running = true; },
    destroy() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    }
  };
}
