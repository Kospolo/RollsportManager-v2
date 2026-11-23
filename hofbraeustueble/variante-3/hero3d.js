/*
 * Hofbräustüble – Variante 3 „Sommerabend“
 * three.js-Heldenszene: stilisierte Low-Poly-Terrasse an der Straßenecke,
 * Bierzeltgarnituren, Sonnenschirm, schwingende Lichterkette, Glühwürmchen,
 * scroll-gesteuerter Übergang Golden Hour → Nacht.
 * Winter-Variante: Schnee, geschlossener Schirm, warm leuchtende Stube.
 */
import * as THREE from '../assets/vendor/three.module.min.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/* ---------- Farb-/Lichtkeyframes (t = 0 Golden Hour, .5 Dämmerung, 1 Nacht) ---------- */
const PALETTES = {
  summer: {
    skyTop: ['#5b97cf', '#34437f', '#070d24'],
    skyMid: ['#f2d3b0', '#e0819a', '#141c44'],
    skyHor: ['#ffb07a', '#ff9460', '#33285a'],
    fog: ['#efc49e', '#c98088', '#141a38'],
    sun: ['#ffc58e', '#ff8a52', '#8ea2e8'],
    sunI: [3.8, 1.3, 0.35],
    sunElev: [13, 3, 38],
    sunAz: [-102, -98, 140],
    hemiSky: ['#cde0f2', '#8577aa', '#24305e'],
    hemiGround: ['#e2b98e', '#8c5a5c', '#1b1628'],
    hemiI: [.85, .65, .42],
    sunGlow: [1, .75, 0],
    exposure: [1.0, 1.0, 1.12],
    ground: ['#c9c2b7', '#c9c2b7', '#c9c2b7']
  },
  winter: {
    skyTop: ['#7397c0', '#3a4676', '#060c22'],
    skyMid: ['#d8dfeb', '#b08aa8', '#121a40'],
    skyHor: ['#f6cfb0', '#e59a7f', '#2a2650'],
    fog: ['#dfdde2', '#a98a9c', '#121833'],
    sun: ['#ffd7b0', '#ff9a6a', '#9db0ee'],
    sunI: [2.0, .8, .3],
    sunElev: [9, 2, 38],
    sunAz: [-102, -98, 140],
    hemiSky: ['#dfe8f4', '#8f85ad', '#26325f'],
    hemiGround: ['#f1ece6', '#a98c96', '#1f1d30'],
    hemiI: [1.1, .7, .45],
    sunGlow: [.8, .6, 0],
    exposure: [1.0, 1.0, 1.1],
    ground: ['#e7e9ee', '#e7e9ee', '#e7e9ee']
  }
};

function makeSampler(stops) {
  const out = {};
  for (const k in stops) {
    const v = stops[k];
    out[k] = typeof v[0] === 'string' ? v.map((c) => new THREE.Color(c)) : v.slice();
  }
  return out;
}
function sampleColor(arr, t, target) {
  if (t <= .5) return target.copy(arr[0]).lerp(arr[1], t * 2);
  return target.copy(arr[1]).lerp(arr[2], (t - .5) * 2);
}
function sampleNum(arr, t) { return t <= .5 ? lerp(arr[0], arr[1], t * 2) : lerp(arr[1], arr[2], (t - .5) * 2); }

/* ---------- Canvas-Texturen ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function pavingTexture() {
  const r = rng(7);
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#aaa49b'; g.fillRect(0, 0, w, h);
    const bw = 64, bh = 32;
    for (let y = 0; y < h; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const v = 196 + Math.floor(r() * 22);
        g.fillStyle = `rgb(${v},${v - 4},${v - 11})`;
        g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 26);
  return tex;
}

function soft(g, x, y, r, color) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  const m = color.match(/rgba?\(([^,]+),([^,]+),([^,)]+)/);
  grd.addColorStop(0, color); grd.addColorStop(1, m ? `rgba(${m[1]},${m[2]},${m[3]},0)` : 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

/** Fassade: Farbe + Emissive (beleuchtete Fenster, Bar-Front) */
function facadeTextures({ floors = 4, cols = 5, seed = 1, barFront = true, signText = '', side = 'left' }) {
  const W = 1024, H = 832;
  const r = rng(seed);
  const floorH = H / (floors + 1.25);
  const groundH = floorH * 1.25;
  const lit = [];
  const map = canvasTex(W, H, (g) => {
    // Putz
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#f3ebda'); grd.addColorStop(1, '#e9dfca');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // leichte Putzstruktur
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,100,70,${r() * .05})`; g.fillRect(r() * W, r() * H, 2, 2); }
    // Fenster der Obergeschosse
    const cw = W / cols;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * .28, y = f * floorH + floorH * .24, ww = cw * .44, wh = floorH * .56;
        g.fillStyle = '#d9cfbb'; g.fillRect(x - 6, y - 6, ww + 12, wh + 14); // Laibung
        g.fillStyle = '#fbf8f1'; g.fillRect(x - 3, y - 3, ww + 6, wh + 6);
        g.fillStyle = '#56606e'; g.fillRect(x, y, ww, wh);
        const shut = .25 + r() * .55; // Rollladen
        g.fillStyle = '#e4dfd6'; g.fillRect(x, y, ww, wh * shut);
        g.fillStyle = 'rgba(0,0,0,.08)';
        for (let k = 0; k < wh * shut; k += 6) g.fillRect(x, y + k, ww, 1.5);
        g.fillStyle = '#c9c0b0'; g.fillRect(x - 8, y + wh + 6, ww + 16, 6); // Fensterbank
        lit.push({ x, y: y + wh * shut, w: ww, h: wh * (1 - shut), on: r() < .42, warm: r() });
      }
    }
    // Erdgeschoss
    const gy = H - groundH;
    g.fillStyle = '#d8ccb3'; g.fillRect(0, gy - 10, W, 10);
    if (barFront) {
      // Markise/Blende mit Schriftzug
      g.fillStyle = '#efe5d2'; g.fillRect(0, gy, W, groundH * .2);
      g.fillStyle = '#b11a2c'; g.fillRect(0, gy + groundH * .16, W, 6);
      if (signText) {
        g.fillStyle = '#b11a2c';
        g.font = `italic 700 ${Math.round(groundH * .15)}px "Cormorant Garamond", Georgia, serif`;
        g.textBaseline = 'middle';
        g.textAlign = side === 'left' ? 'right' : 'left';
        g.fillText(signText, side === 'left' ? W - 40 : 40, gy + groundH * .09);
      }
      // Glasfront mit Jalousien
      const fy = gy + groundH * .24, fh = groundH * .56;
      g.fillStyle = '#6d5a48'; g.fillRect(0, fy - 6, W, fh + 12);
      const panes = 6;
      for (let p = 0; p < panes; p++) {
        const px = p * (W / panes) + 8, pw = W / panes - 16;
        g.fillStyle = '#c8b89a'; g.fillRect(px, fy, pw, fh);
        g.fillStyle = 'rgba(120,96,70,.35)';
        for (let k = 0; k < fh; k += 7) g.fillRect(px, fy + k, pw, 2);
      }
      g.fillStyle = '#d6c7a6'; g.fillRect(0, fy + fh + 6, W, groundH * .2 - 6);
      g.fillStyle = '#8b5a3c'; g.fillRect(0, H - groundH * .06, W, groundH * .06);
    } else {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * .25, y = gy + groundH * .2, ww = cw * .5, wh = groundH * .5;
        g.fillStyle = '#6a7380'; g.fillRect(x, y, ww, wh);
      }
    }
  });
  const emissive = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (const l of lit) {
      if (!l.on) continue;
      g.fillStyle = l.warm > .3 ? '#ffb45e' : '#ffd9a0';
      g.fillRect(l.x, l.y, l.w, l.h);
    }
    if (barFront) {
      const gy = H - groundH, fy = gy + groundH * .24, fh = groundH * .56;
      const panes = 6;
      for (let p = 0; p < panes; p++) {
        const px = p * (W / panes) + 8, pw = W / panes - 16;
        const grd = g.createLinearGradient(0, fy, 0, fy + fh);
        grd.addColorStop(0, '#ffb35a'); grd.addColorStop(1, '#ff8a3a');
        g.fillStyle = grd; g.fillRect(px, fy, pw, fh);
        g.fillStyle = 'rgba(0,0,0,.45)';
        for (let k = 0; k < fh; k += 7) g.fillRect(px, fy + k, pw, 2);
      }
    }
  });
  return { map, emissive };
}

function glowSpriteTexture() {
  return canvasTex(128, 128, (g) => {
    soft(g, 64, 64, 64, 'rgba(255,255,255,1)');
  });
}

function cloudTexture(seed) {
  const r = rng(seed);
  return canvasTex(512, 160, (g) => {
    for (let i = 0; i < 16; i++) {
      const x = 80 + r() * 350, y = 70 + (r() - .5) * 50, rad = 30 + r() * 55;
      soft(g, x, y, rad, 'rgba(255,255,255,.55)');
    }
  });
}

/* ---------- Shader ---------- */
const SKY_VERT = /* glsl */`
varying vec3 vPos;
void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunVis;
varying vec3 vPos;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec3 d = normalize(vPos);
  float h = d.y;
  vec3 col = mix(uHor, uMid, smoothstep(-0.01, 0.09, h));
  col = mix(col, uTop, smoothstep(0.07, 0.42, h));
  col = mix(col, uHor * 0.9, smoothstep(0.0, -0.2, h));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 60.0) * 0.5 + pow(sd, 5.0) * 0.32) * uSunVis * (0.6 + 0.4 * smoothstep(0.35, 0.0, h));
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const GLOW_VERT = /* glsl */`
attribute float aSize; attribute float aOn; attribute vec3 aColor; attribute float aPhase;
uniform float uScale; uniform float uTime; uniform float uOpacity; uniform float uMode;
varying float vA; varying vec3 vColor;
void main(){
  vec3 p = position;
  float a = aOn;
  if (uMode > 0.5 && uMode < 1.5) { // Glühwürmchen
    p += vec3(sin(uTime * 0.37 + aPhase * 6.0) * 0.9, sin(uTime * 0.53 + aPhase * 11.0) * 0.35, cos(uTime * 0.29 + aPhase * 9.0) * 0.9);
    a *= pow(max(sin(uTime * (0.8 + aPhase) + aPhase * 30.0), 0.0), 3.0);
  } else if (uMode > 1.5) { // Schnee
    p.y = mod(p.y - uTime * (0.45 + aPhase * 0.5), 16.0) - 1.0;
    p.x += sin(uTime * 0.6 + aPhase * 20.0) * 0.35;
    p.z += cos(uTime * 0.4 + aPhase * 13.0) * 0.25;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  vA = a * uOpacity; vColor = aColor;
}`;
const GLOW_FRAG = /* glsl */`
uniform float uCore;
varying float vA; varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float halo = pow(1.0 - d, 2.2);
  float core = smoothstep(uCore, 0.0, d);
  float a = (halo * 0.6 + core) * vA;
  gl_FragColor = vec4(vColor * a, a);
  #include <colorspace_fragment>
}`;

function glowMaterial(mode, core = .18, blending = THREE.AdditiveBlending) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, uTime: { value: 0 }, uOpacity: { value: 1 }, uMode: { value: mode }, uCore: { value: core } },
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    transparent: true, depthWrite: false, blending, toneMapped: false
  });
}

/* ==========================================================================
   Szene
   ========================================================================== */
export async function createHeroScene({ canvas, winter = false, reducedMotion = false, signText = '' }) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  try { await document.fonts.load('italic 700 60px "Cormorant Garamond"'); } catch (e) { /* egal */ }

  const P = makeSampler(winter ? PALETTES.winter : PALETTES.summer);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 45, 230);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 700);

  /* Himmel */
  const skyU = {
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, .2, -1) }, uSunCol: { value: new THREE.Color() }, uSunVis: { value: 1 }
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24),
    new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
  scene.add(sky);

  /* Licht */
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 120 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = .03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  sun.target.position.set(4, 0, 0);

  /* Boden */
  const groundMat = new THREE.MeshStandardMaterial({ color: P.ground[0], map: pavingTexture(), roughness: .95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // Straße links
  const RC = new THREE.Vector3(-14, 0, 3); // Straßenmitte, parallel zur linken Fassade
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 260), new THREE.MeshStandardMaterial({ color: winter ? '#a3a5ac' : '#77777b', roughness: .9 }));
  road.rotation.x = -Math.PI / 2; road.rotation.z = Math.PI / 4; road.position.set(RC.x, .01, RC.z); road.receiveShadow = true;
  scene.add(road);
  const curbMat = new THREE.MeshStandardMaterial({ color: '#dcd6cc', roughness: .8 });
  for (const sgn of [1, -1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(.3, .14, 260), curbMat);
    curb.rotation.y = Math.PI / 4; curb.position.set(RC.x + sgn * 3.25, .07, RC.z - sgn * 3.25); curb.receiveShadow = true;
    scene.add(curb);
  }
  const dashMat = new THREE.MeshBasicMaterial({ color: '#ece8df' });
  for (let i = -30; i < 30; i++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(.14, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2; dash.rotation.z = Math.PI / 4;
    dash.position.set(RC.x - i * 3 * Math.SQRT1_2, .02, RC.z - i * 3 * Math.SQRT1_2);
    scene.add(dash);
  }

  /* Gebäude an der Ecke */
  const BX = 8, BZ = -14, HALF = 7, BH = 11.2;
  const left = facadeTextures({ floors: 3, cols: 4, seed: 3, barFront: true, signText, side: 'left' });
  const right = facadeTextures({ floors: 3, cols: 4, seed: 9, barFront: true, signText: '', side: 'right' });
  const plain = new THREE.MeshStandardMaterial({ color: '#e9dfca', roughness: .95 });
  const roof = new THREE.MeshStandardMaterial({ color: '#5a4a44', roughness: .9 });
  const facadeMat = (t) => new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color('#ffb060'), emissiveIntensity: 0, roughness: .92 });
  const matLeft = facadeMat(left), matRight = facadeMat(right);
  // Box-Seiten: +x, -x, +y, -y, +z, -z  → bei Drehung -45°: +z = linke Fassade, +x = rechte Fassade
  const building = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, BH, HALF * 2), [matRight, plain, roof, plain, matLeft, plain]);
  building.rotation.y = -Math.PI / 4;
  building.position.set(BX, BH / 2, BZ);
  building.castShadow = true; building.receiveShadow = true;
  scene.add(building);
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + .6, .35, HALF * 2 + .6), new THREE.MeshStandardMaterial({ color: '#4a3c37', roughness: .9 }));
  roofSlab.rotation.y = -Math.PI / 4; roofSlab.position.set(BX, BH + .17, BZ); roofSlab.castShadow = true;
  scene.add(roofSlab);
  const corner = new THREE.Vector3(BX, 0, BZ + HALF * Math.SQRT2);
  const dirL = new THREE.Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2); // entlang linker Fassade
  const dirR = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
  const nL = new THREE.Vector3(-Math.SQRT1_2, 0, Math.SQRT1_2), nR = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);

  // Ausleger-Schild (Hofbräu-Rot) an der Ecke
  const signGroup = new THREE.Group();
  const signMat = new THREE.MeshStandardMaterial({ color: '#f5efe2', emissive: new THREE.Color('#ffe6c0'), emissiveIntensity: 0, roughness: .6 });
  const signRed = new THREE.MeshStandardMaterial({ color: '#c8102e', emissive: new THREE.Color('#ff3040'), emissiveIntensity: 0, roughness: .5 });
  const signBox = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.3, .95), signMat);
  const signBand = new THREE.Mesh(new THREE.BoxGeometry(.18, .32, .97), signRed);
  signBand.position.y = .25;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, 1.1), new THREE.MeshStandardMaterial({ color: '#333' }));
  arm.position.set(0, .72, -.3);
  signGroup.add(signBox, signBand, arm);
  signGroup.position.copy(corner).addScaledVector(nL, .7).add(new THREE.Vector3(0, 4.6, 0));
  signGroup.rotation.y = Math.PI / 4;
  scene.add(signGroup);

  /* Entfernte Häuser & Hügel – Tiefe, vom Nebel eingefärbt */
  const farMat = new THREE.MeshStandardMaterial({ color: '#d9c7ad', roughness: 1, flatShading: true });
  const farRoofMat = new THREE.MeshStandardMaterial({ color: '#9c6a55', roughness: 1, flatShading: true });
  const rf = rng(21);
  for (let i = 0; i < 16; i++) {
    const w = 5 + rf() * 6, h = 4 + rf() * 6, d = 6;
    const x = -70 + i * 10 + rf() * 4, z = -55 - rf() * 30;
    if (x > -4 && x < 22 && z > -40) continue;
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), farMat);
    house.position.set(x, h / 2, z);
    const rr = new THREE.Mesh(new THREE.ConeGeometry(w * .75, 2.4, 4), farRoofMat);
    rr.rotation.y = Math.PI / 4; rr.scale.z = d / w; rr.position.set(x, h + 1.2, z);
    scene.add(house, rr);
  }
  const hillMat = new THREE.MeshStandardMaterial({ color: '#8fa07a', roughness: 1, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(30 + rf() * 20, 1), hillMat);
    hill.scale.y = .32; hill.position.set(-140 + i * 60, -4, -150 - rf() * 40);
    scene.add(hill);
  }

  /* Bäume */
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5e4636', roughness: 1, flatShading: true });
  const leafMats = [new THREE.MeshStandardMaterial({ color: '#6b8f4e', roughness: .9, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#7fa05a', roughness: .9, flatShading: true })];
  const trees = [];
  function addTree(x, z, s = 1, seed = 1) {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.13 * s, .2 * s, 3.2 * s, 6), trunkMat);
    tr.position.y = 1.6 * s; tr.castShadow = true; g.add(tr);
    const rr2 = rng(seed);
    const crown = new THREE.Group(); crown.position.y = 3.4 * s; g.add(crown);
    if (!winter) {
      for (let i = 0; i < 4; i++) {
        const geo = new THREE.IcosahedronGeometry((1.1 + rr2() * .6) * s, 0);
        const pos = geo.attributes.position;
        for (let k = 0; k < pos.count; k++) pos.setXYZ(k, pos.getX(k) * (1 + (rr2() - .5) * .25), pos.getY(k) * (1 + (rr2() - .5) * .25), pos.getZ(k));
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, leafMats[i % 2]);
        m.position.set((rr2() - .5) * 1.4 * s, (rr2() * 1.3) * s, (rr2() - .5) * 1.2 * s);
        m.castShadow = true; crown.add(m);
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(.025 * s, .07 * s, 1.8 * s, 4), trunkMat);
        b.position.set(0, .4 * s, 0);
        b.rotation.set((rr2() - .5) * 1.4, rr2() * Math.PI * 2, (rr2() - .5) * 1.4);
        b.translateY(.8 * s);
        crown.add(b);
      }
    }
    g.position.set(x, 0, z); scene.add(g);
    trees.push({ crown, phase: rr2() * 6 });
    return g;
  }
  addTree(-15, -5.8, 1.3, 8); addTree(-22, -12.6, 1.4, 12); addTree(-29, -19.5, 1.35, 15);
  addTree(21, -9, 1.3, 19); addTree(26, -16, 1.2, 27);

  /* Straßenlaterne */
  const lampGroup = new THREE.Group();
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 6, 8), new THREE.MeshStandardMaterial({ color: '#7c8088', roughness: .5, metalness: .4 }));
  lampPole.position.y = 3; lampPole.castShadow = true;
  const lampArm = new THREE.Mesh(new THREE.BoxGeometry(1.4, .07, .07), lampPole.material);
  lampArm.position.set(.6, 5.95, 0);
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#dfe3ea', emissive: new THREE.Color('#ffd9a8'), emissiveIntensity: 0 });
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(.6, .1, .25), lampHeadMat);
  lampHead.position.set(1.15, 5.88, 0);
  lampGroup.add(lampPole, lampArm, lampHead);
  lampGroup.position.set(-6.4, 0, 3.8); lampGroup.rotation.y = -Math.PI / 4 - Math.PI / 2 + Math.PI;
  scene.add(lampGroup);
  const lampLight = new THREE.PointLight('#ffcf9a', 0, 16, 2);
  lampGroup.updateMatrixWorld(true);
  lampHead.getWorldPosition(lampLight.position); lampLight.position.y -= .3;
  scene.add(lampLight);

  /* Bierzeltgarnituren */
  const wood = new THREE.MeshStandardMaterial({ color: '#b57e4b', roughness: .75, flatShading: true });
  const woodDark = new THREE.MeshStandardMaterial({ color: '#9c6a3d', roughness: .8, flatShading: true });
  const metal = new THREE.MeshStandardMaterial({ color: '#3d3f46', roughness: .45, metalness: .6 });
  const beerMat = new THREE.MeshStandardMaterial({ color: '#e7a334', emissive: new THREE.Color('#c97a14'), emissiveIntensity: .25, roughness: .15, transparent: true, opacity: .88 });
  const foamMat = new THREE.MeshStandardMaterial({ color: '#fff6e6', roughness: .6 });
  const furniture = new THREE.Group(); scene.add(furniture);
  const box = (w, h, d, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.castShadow = true; me.receiveShadow = true; return me; };
  function legPair(g, x, h, spread, w) {
    for (const s of [-1, 1]) {
      const l = box(.04, h / Math.cos(spread), .04, metal);
      l.position.set(x, h / 2, 0); l.rotation.x = s * spread; g.add(l);
    }
    const bar = box(.03, .03, w, metal); bar.position.set(x, h * .3, 0); g.add(bar);
  }
  function addTableSet(x, z, rot, glasses, seed) {
    const g = new THREE.Group();
    const top = box(2.2, .05, .62, wood); top.position.y = .77; g.add(top);
    legPair(g, -.82, .75, .32, .4); legPair(g, .82, .75, .32, .4);
    for (const s of [-1, 1]) {
      const b = box(2.2, .045, .26, woodDark); b.position.set(0, .47, s * .66); g.add(b);
      for (const lx of [-.82, .82]) { const l = box(.035, .45, .035, metal); l.position.set(lx, .225, s * .66); g.add(l); }
    }
    const rr3 = rng(seed);
    for (let i = 0; i < glasses; i++) {
      const gl = new THREE.Group();
      const beer = new THREE.Mesh(new THREE.CylinderGeometry(.045, .038, .17, 10), beerMat); beer.position.y = .085;
      const foam = new THREE.Mesh(new THREE.CylinderGeometry(.047, .047, .035, 10), foamMat); foam.position.y = .185;
      beer.castShadow = true; gl.add(beer, foam);
      gl.position.set(-.85 + rr3() * 1.7, .795, (rr3() - .5) * .38);
      g.add(gl);
    }
    g.position.set(x, 0, z); g.rotation.y = rot;
    furniture.add(g);
  }
  if (!winter) {
    addTableSet(2.6, 1.6, -.78, 4, 2);
    addTableSet(5.6, 3.6, -.72, 3, 5);
    addTableSet(-.3, 4.2, -.85, 2, 9);
    addTableSet(9.8, 2.2, .72, 3, 13);
  } else {
    // Winter: Bänke zusammengeklappt an der Wand
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const top = box(2.2, .62, .05, wood); top.position.y = .31; g.add(top);
      g.position.copy(corner).addScaledVector(dirL, 3 + i * .12).addScaledVector(nL, .2 + i * .08);
      g.rotation.y = Math.PI / 4 - .02 * i;
      furniture.add(g);
    }
  }

  /* Sonnenschirm */
  const umbrella = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#efe8dc', roughness: .5 }));
  pole.position.y = 1.3; pole.castShadow = true; umbrella.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.32, .38, .12, 12), metal); base.position.y = .06; umbrella.add(base);
  const canopyGeo = new THREE.ConeGeometry(1.75, .6, 12, 1, true).toNonIndexed();
  const cols = [];
  const cA = new THREE.Color('#f6ecd8'), cB = new THREE.Color('#c8102e');
  const triCount = canopyGeo.attributes.position.count / 3;
  for (let i = 0; i < triCount; i++) { const c = Math.floor(i / 2) % 2 ? cB : cA; for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b); }
  canopyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  canopyGeo.computeVertexNormals();
  const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .8, flatShading: true }));
  canopy.castShadow = true;
  if (!winter) { canopy.position.y = 2.55; }
  else { canopy.scale.set(.13, 2.6, .13); canopy.position.y = 1.85; }
  umbrella.add(canopy);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), pole.material); fin.position.y = winter ? 2.65 : 2.9; umbrella.add(fin);
  umbrella.position.set(4.1, 0, 2.55);
  scene.add(umbrella);

  /* Lichterkette: Pfosten + Stränge */
  const postMat = new THREE.MeshStandardMaterial({ color: '#7a5535', roughness: .85, flatShading: true });
  const posts = [new THREE.Vector3(-1.6, 0, 6.6), new THREE.Vector3(5.2, 0, 7.2), new THREE.Vector3(11.6, 0, 4.4)];
  const POST_H = 3.4;
  for (const p of posts) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, POST_H, 6), postMat);
    m.position.set(p.x, POST_H / 2, p.z); m.castShadow = true; scene.add(m);
  }
  const wallPt = (dir, u, h) => corner.clone().addScaledVector(dir, u).addScaledVector(dir === dirL ? nL : nR, .12).setY(h);
  const top = (p) => new THREE.Vector3(p.x, POST_H - .05, p.z);
  const strandDefs = [
    [wallPt(dirL, 7.5, 3.6), top(posts[0]), .7],
    [wallPt(dirL, 3.6, 3.6), top(posts[1]), .85],
    [wallPt(dirL, .4, 3.6), top(posts[2]), .8],
    [top(posts[0]), top(posts[1]), .6],
    [top(posts[1]), top(posts[2]), .55],
    [wallPt(dirR, 3.2, 3.6), top(posts[2]), .55],
    [wallPt(dirL, 7.5, 3.6), wallPt(dirL, .4, 3.6), .5]
  ];
  const strands = [];
  let bulbTotal = 0;
  for (let i = 0; i < strandDefs.length; i++) {
    const [a, b, sag] = strandDefs[i];
    const len = a.distanceTo(b);
    const n = Math.max(6, Math.round(len / .62));
    strands.push({ a, b, sag, n, start: bulbTotal, phase: i * 1.7, perp: new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3(0, 1, 0)).normalize() });
    bulbTotal += n;
  }
  const WIRE_SEG = 28;
  const wireMat = new THREE.LineBasicMaterial({ color: '#2b2520' });
  for (const s of strands) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((WIRE_SEG + 1) * 3), 3));
    s.line = new THREE.Line(g, wireMat); s.line.frustumCulled = false;
    scene.add(s.line);
  }
  const bulbGeo = new THREE.SphereGeometry(.055, 10, 8); bulbGeo.scale(1, 1.25, 1);
  const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbTotal);
  bulbs.frustumCulled = false;
  scene.add(bulbs);
  const bulbPos = new Float32Array(bulbTotal * 3);
  const bulbOn = new Float32Array(bulbTotal);
  const bulbSize = new Float32Array(bulbTotal);
  const bulbCol = new Float32Array(bulbTotal * 3);
  const bulbPhase = new Float32Array(bulbTotal);
  const bulbThreshold = new Float32Array(bulbTotal);
  const rb = rng(33);
  const warm = new THREE.Color('#ffb860'), warm2 = new THREE.Color('#ffd28a');
  for (let i = 0; i < bulbTotal; i++) {
    const c = rb() < .5 ? warm : warm2;
    bulbCol[i * 3] = c.r; bulbCol[i * 3 + 1] = c.g; bulbCol[i * 3 + 2] = c.b;
    bulbSize[i] = .55 + rb() * .25;
    bulbPhase[i] = rb();
  }
  // Einschalt-Reihenfolge: Strang für Strang, wie eine Welle
  strands.forEach((s, si) => { for (let k = 0; k < s.n; k++) bulbThreshold[s.start + k] = .3 + (si / strands.length) * .26 + (k / s.n) * .08 + rb() * .03; });
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(bulbPos, 3));
  glowGeo.setAttribute('aOn', new THREE.BufferAttribute(bulbOn, 1));
  glowGeo.setAttribute('aSize', new THREE.BufferAttribute(bulbSize, 1));
  glowGeo.setAttribute('aColor', new THREE.BufferAttribute(bulbCol, 3));
  glowGeo.setAttribute('aPhase', new THREE.BufferAttribute(bulbPhase, 1));
  const glowMat = glowMaterial(0, .12);
  const glows = new THREE.Points(glowGeo, glowMat); glows.frustumCulled = false;
  scene.add(glows);

  // Warme Lichtpools unter der Lichterkette
  const poolLights = [];
  [[2.4, 2.8, 2.4], [6.4, 2.8, 4.4], [.4, 2.8, 5.4], [9.6, 2.8, 2.4]].forEach(([x, y, z]) => {
    const l = new THREE.PointLight('#ffb466', 0, 9, 1.8); l.position.set(x, y, z); scene.add(l); poolLights.push(l);
  });
  // Licht aus der Stube (Glasfront)
  const barLight = new THREE.PointLight('#ff9e4a', 0, 10, 1.6);
  barLight.position.copy(corner).addScaledVector(dirL, 4).addScaledVector(nL, 1.6).setY(1.6);
  scene.add(barLight);

  /* Sterne */
  const starN = 700, starPos = new Float32Array(starN * 3), starOn = new Float32Array(starN), starSize = new Float32Array(starN), starCol = new Float32Array(starN * 3), starPh = new Float32Array(starN);
  const rs = rng(77);
  for (let i = 0; i < starN; i++) {
    const th = rs() * Math.PI * 2, ph = Math.acos(1 - rs() * .92);
    const R = 360;
    starPos.set([R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) + 10, R * Math.sin(ph) * Math.sin(th)], i * 3);
    starOn[i] = .4 + rs() * .6; starSize[i] = 2 + rs() * 3.5; starPh[i] = rs();
    starCol.set([1, .95 + rs() * .05, .85 + rs() * .15], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aOn', new THREE.BufferAttribute(starOn, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starCol, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPh, 1));
  const starMat = glowMaterial(0, .5); starMat.fog = false;
  const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false;
  scene.add(stars);

  /* Mond */
  const moonTex = canvasTex(256, 256, (g) => {
    soft(g, 128, 128, 128, 'rgba(255,240,210,.35)');
    g.fillStyle = '#fff4dc'; g.beginPath(); g.arc(128, 128, 30, 0, Math.PI * 2); g.fill();
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
  moon.scale.set(48, 48, 1); moon.position.set(-150, 150, -250);
  scene.add(moon);

  /* Wolken */
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTexture(i + 3), transparent: true, depthWrite: false, fog: false, opacity: .8 });
    const s = new THREE.Sprite(m);
    const sc = 60 + i * 14; s.scale.set(sc, sc * .3, 1);
    s.position.set(-200 + i * 95, 55 + (i % 3) * 22, -300 + (i % 2) * 40);
    scene.add(s); clouds.push({ s, speed: .6 + i * .15 });
  }

  /* Glühwürmchen bzw. Schnee */
  let particles;
  {
    const n = winter ? (coarse ? 700 : 1300) : 70;
    const pos = new Float32Array(n * 3), on = new Float32Array(n), size = new Float32Array(n), col = new Float32Array(n * 3), ph = new Float32Array(n);
    const rp = rng(55);
    for (let i = 0; i < n; i++) {
      if (winter) pos.set([-14 + rp() * 34, rp() * 16, -14 + rp() * 26], i * 3);
      else pos.set([-3 + rp() * 15, .4 + rp() * 2.4, -1 + rp() * 9], i * 3);
      on[i] = winter ? .55 + rp() * .45 : 1;
      size[i] = winter ? .05 + rp() * .07 : .16 + rp() * .14;
      ph[i] = rp();
      if (winter) col.set([1, 1, 1], i * 3); else col.set([.86, 1, .45], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    const m = winter ? glowMaterial(2, .7, THREE.NormalBlending) : glowMaterial(1, .25);
    particles = new THREE.Points(g, m); particles.frustumCulled = false;
    scene.add(particles);
  }

  /* ---------- Kamera-Framing ---------- */
  const camBase = new THREE.Vector3(), lookBase = new THREE.Vector3();
  let width = 1, height = 1;
  function frame() {
    const a = width / height;
    if (a >= 1.25) { camera.fov = 34; camBase.set(-10, 3.4, 22); lookBase.set(-3.6, 5.0, -3); }
    else if (a >= .85) { camera.fov = 42; camBase.set(-6, 4.2, 25); lookBase.set(3.5, 6.4, -3); }
    else { camera.fov = 56; camBase.set(-1.5, 6.4, 30); lookBase.set(5.2, 12.2, -3); }
    camera.aspect = a; camera.updateProjectionMatrix();
  }
  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!w || !h) return;
    if (w === width && Math.abs(h - height) < 2) return;
    width = w; height = h;
    renderer.setSize(w, h, false);
    frame();
    const scale = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const m of [glowMat, starMat, particles.material]) m.uniforms.uScale.value = scale;
    starMat.uniforms.uScale.value = scale * .012;
    requestRender();
  }

  /* ---------- Zustand ---------- */
  let target = 0, t = 0, time = 0, last = performance.now();
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  let dolly = 0;
  let running = false, visible = true, raf = 0, dirty = true;
  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const off = new THREE.Color('#cbbfa9'), onCol = new THREE.Color();
  const wind = reducedMotion ? 0 : 1;

  function strandPoint(s, u, out) {
    out.lerpVectors(s.a, s.b, u);
    const bell = 4 * u * (1 - u);
    const sw = Math.sin(time * .9 + s.phase + u * 1.5) * .07 * wind;
    out.y -= s.sag * bell + Math.abs(sw) * .3 * bell;
    out.addScaledVector(s.perp, sw * bell);
    return out;
  }

  function apply() {
    // Himmel & Licht
    sampleColor(P.skyTop, t, skyU.uTop.value);
    sampleColor(P.skyMid, t, skyU.uMid.value);
    sampleColor(P.skyHor, t, skyU.uHor.value);
    sampleColor(P.fog, t, scene.fog.color);
    const elev = THREE.MathUtils.degToRad(sampleNum(P.sunElev, t));
    const az = THREE.MathUtils.degToRad(t < .62 ? lerp(P.sunAz[0], P.sunAz[1], Math.min(t / .5, 1)) : P.sunAz[2]);
    const sunDir = tmpV.set(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az));
    // Sonne geht unter: Elevation fällt vor dem Wechsel zum Mond unter den Horizont
    const sunElevDeg = t < .62 ? lerp(4, -5, smooth(0, .62, t)) : 38;
    const se = THREE.MathUtils.degToRad(sunElevDeg);
    const saz = THREE.MathUtils.degToRad(176);
    const sunSkyDir = new THREE.Vector3(Math.cos(se) * Math.sin(saz), Math.sin(se), Math.cos(se) * Math.cos(saz));
    skyU.uSunDir.value.copy(sunSkyDir);
    sampleColor(P.sun, Math.min(t, .5), skyU.uSunCol.value);
    skyU.uSunVis.value = sampleNum(P.sunGlow, t) * (1 - smooth(.45, .62, t));
    sun.position.copy(sunDir).multiplyScalar(60).add(sun.target.position);
    sampleColor(P.sun, t, sun.color);
    sun.intensity = sampleNum(P.sunI, t) * (t > .5 && t < .7 ? smooth(.6, .7, t) * .5 + .5 * (1 - smooth(.5, .6, t)) : 1);
    sampleColor(P.hemiSky, t, hemi.color);
    sampleColor(P.hemiGround, t, hemi.groundColor);
    hemi.intensity = sampleNum(P.hemiI, t);
    renderer.toneMappingExposure = sampleNum(P.exposure, t);

    const night = smooth(.45, .9, t);
    const winterWarm = winter ? .55 : 0; // Winter: Stube leuchtet auch tagsüber
    const windowGlow = Math.max(smooth(.3, .85, t), winterWarm);
    matLeft.emissiveIntensity = matRight.emissiveIntensity = windowGlow * 1.25;
    signMat.emissiveIntensity = night * .6; signRed.emissiveIntensity = night * .5;
    lampHeadMat.emissiveIntensity = smooth(.5, .75, t) * 3;
    lampLight.intensity = smooth(.5, .75, t) * 14;
    barLight.intensity = Math.max(night, winterWarm * .6) * 10;
    starMat.uniforms.uOpacity.value = smooth(.55, 1, t);
    moon.material.opacity = smooth(.65, 1, t) * .95;
    for (const c of clouds) {
      sampleColor(P.skyMid, t, c.s.material.color);
      c.s.material.color.lerp(tmpC.set('#ffffff'), .45 * (1 - t));
      c.s.material.opacity = .8 - t * .55;
    }
    if (!winter) particles.material.uniforms.uOpacity.value = smooth(.55, .95, t);
    else particles.material.uniforms.uOpacity.value = .9;

    // Lichterkette
    let sum = 0;
    for (const s of strands) {
      const arr = s.line.geometry.attributes.position.array;
      for (let k = 0; k <= WIRE_SEG; k++) { strandPoint(s, k / WIRE_SEG, tmpV); arr[k * 3] = tmpV.x; arr[k * 3 + 1] = tmpV.y; arr[k * 3 + 2] = tmpV.z; }
      s.line.geometry.attributes.position.needsUpdate = true;
      for (let k = 0; k < s.n; k++) {
        const i = s.start + k;
        strandPoint(s, (k + .5) / s.n, tmpV); tmpV.y -= .07;
        bulbPos[i * 3] = tmpV.x; bulbPos[i * 3 + 1] = tmpV.y; bulbPos[i * 3 + 2] = tmpV.z;
        m4.makeTranslation(tmpV.x, tmpV.y, tmpV.z); bulbs.setMatrixAt(i, m4);
        let on = smooth(bulbThreshold[i], bulbThreshold[i] + .05, t);
        if (on > 0 && on < 1 && !reducedMotion) on *= .6 + .4 * Math.abs(Math.sin(time * 40 + i * 3.1)); // Flackern beim Einschalten
        if (winter) on = Math.max(on, .35);
        on *= .93 + .07 * Math.sin(time * 2.2 + bulbPhase[i] * 20) * wind;
        bulbOn[i] = on * (.7 + .5 * night);
        sum += on;
        onCol.setRGB(bulbCol[i * 3], bulbCol[i * 3 + 1], bulbCol[i * 3 + 2]).multiplyScalar(3.2);
        tmpC.copy(off).lerp(onCol, on);
        bulbs.setColorAt(i, tmpC);
      }
    }
    bulbs.instanceMatrix.needsUpdate = true;
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    glowGeo.attributes.position.needsUpdate = true;
    glowGeo.attributes.aOn.needsUpdate = true;
    const avg = sum / bulbTotal;
    poolLights.forEach((l) => { l.intensity = avg * (6 + 10 * night); });

    // Kamera
    ptr.sx += (ptr.x - ptr.sx) * .045; ptr.sy += (ptr.y - ptr.sy) * .045;
    const breathe = reducedMotion ? 0 : Math.sin(time * .17) * .18;
    camera.position.set(camBase.x + ptr.sx * 1.1 + breathe, camBase.y - ptr.sy * .45 + Math.sin(time * .23) * .06 * wind, camBase.z - dolly * 2.2);
    camera.lookAt(lookBase.x + ptr.sx * .3, lookBase.y - dolly * .4, lookBase.z);

    // Bäume wiegen
    for (const tr of trees) tr.crown.rotation.z = Math.sin(time * .7 + tr.phase) * .025 * wind;
    for (const c of clouds) c.s.position.x += c.speed * .016 * wind;
    for (const c of clouds) if (c.s.position.x > 260) c.s.position.x = -260;

    glowMat.uniforms.uTime.value = time; starMat.uniforms.uTime.value = time; particles.material.uniforms.uTime.value = time;
  }

  let frames = 0, slowFrames = 0;
  function loop(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min((now - last) / 1000, .1); last = now;
    if (!reducedMotion) time += dt;
    const k = reducedMotion ? 1 : 1 - Math.pow(.0025, dt);
    t += (target - t) * k;
    if (Math.abs(target - t) < .0005) t = target;
    apply();
    renderer.render(scene, camera);
    // adaptive Qualität: bei schwacher Leistung Auflösung reduzieren
    frames++;
    if (frames > 20 && frames < 200) {
      if (dt > 1 / 36) slowFrames++;
      if (slowFrames > 40 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio * .7); renderer.setPixelRatio(pixelRatio); width = 0; resize(); slowFrames = 0; }
    }
    if (!reducedMotion) raf = requestAnimationFrame(loop);
    else if (Math.abs(target - t) > .0005 || dirty) { dirty = false; raf = requestAnimationFrame(loop); }
  }
  function requestRender() {
    dirty = true;
    if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  // erstes Bild synchron rendern
  apply(); renderer.render(scene, camera);

  return {
    setTarget(v, instant) { target = clamp01(v); if (instant) t = target; requestRender(); },
    setPointer(x, y) { ptr.x = x; ptr.y = y; if (reducedMotion) { ptr.sx = x; ptr.sy = y; } },
    setDolly(v) { dolly = v; },
    setVisible(v) { visible = v; if (v && !document.hidden) start(); else stop(); },
    getState() { return { t, target, running, pixelRatio, bulbs: bulbTotal }; },
    dispose() { stop(); ro.disconnect(); renderer.dispose(); }
  };
}
