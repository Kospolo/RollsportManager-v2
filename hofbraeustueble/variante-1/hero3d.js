/*!
 * Hofbräustüble – Variante 1: 3D-Hero
 * Prozedural gebautes Willibecher-Glas mit Bier, Schaumkrone, Kohlensäure-Perlen,
 * Pendelleuchten, Lichtkegel, Rauchschwaden und Staub – alles ohne externe Assets.
 */
import * as THREE from '../assets/vendor/three.module.min.js';

/* ------------------------------------------------------------ Helfer */
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function canvasTex(cv, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const V2 = THREE.Vector2;

/* ------------------------------------------------- Glas-Geometrie */
const G = { WALL: 0.028, BASE: 0.3, RIM: 3.24, FILL: 2.6, DOME: 0.24 };

function buildProfile() {
  // Willibecher: schmaler Fuß, nach oben weiter werdend, leichte Taille, ausgestellter Rand
  const ctrl = [[0.5, 0.0], [0.53, 0.05], [0.52, 0.16], [0.49, 0.32], [0.495, 0.62], [0.545, 1.25],
    [0.615, 1.95], [0.66, 2.42], [0.652, 2.75], [0.656, 3.0], [0.69, G.RIM]];
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
  const pts = curve.getPoints(150).map((v) => new V2(v.x, v.y));
  // y streng monoton halten
  for (let i = 1; i < pts.length; i++) if (pts[i].y <= pts[i - 1].y) pts[i].y = pts[i - 1].y + 1e-4;
  return pts;
}
function makeRadius(profile) {
  return (y) => {
    if (y <= profile[0].y) return profile[0].x;
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1], b = profile[i];
      if (y <= b.y) return a.x + (b.x - a.x) * ((y - a.y) / (b.y - a.y));
    }
    return profile[profile.length - 1].x;
  };
}

/* ---------------------------------------------------- Texturen */
function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,210,1)');
  g.addColorStop(0.12, 'rgba(255,196,120,.75)');
  g.addColorStop(0.4, 'rgba(255,150,60,.18)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(cv);
}

function smokeTexture(rand) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, d = Math.pow(rand(), 0.7) * S * 0.28;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d * 0.7;
    const r = S * (0.08 + rand() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const al = 0.05 + rand() * 0.08;
    g.addColorStop(0, `rgba(255,255,255,${al})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // weicher Rand
  ctx.globalCompositeOperation = 'destination-in';
  const m = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = m;
  ctx.fillRect(0, 0, S, S);
  return canvasTex(cv);
}

function foamBumpTexture(rand) {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * S, y = rand() * S, r = 1.5 + Math.pow(rand(), 2.2) * 9;
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.65, 'rgba(170,170,170,.5)');
    g.addColorStop(1, 'rgba(40,40,40,.7)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = canvasTex(cv, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 2);
  return t;
}

function slateTexture(rand) {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, S, S);
  // geschieferte Struktur: lange flache Flecken
  for (let i = 0; i < 520; i++) {
    const x = rand() * S, y = rand() * S, rx = 8 + rand() * 60, ry = 2 + rand() * 9;
    const v = Math.floor(90 + rand() * 90);
    ctx.fillStyle = `rgba(${v},${v},${v},.18)`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.35 + rand() * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  const t = canvasTex(cv, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

function fitFont(ctx, text, weightStyle, family, maxW, start) {
  let size = start;
  ctx.font = `${weightStyle} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > 12) {
    size -= 2;
    ctx.font = `${weightStyle} ${size}px ${family}`;
  }
  return size;
}

function coasterTexture(name, district, rand) {
  const S = 1024, c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  // Pappe
  ctx.fillStyle = '#eadcc0';
  ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? '120,90,50' : '255,250,235'},${0.05 + rand() * 0.08})`;
    ctx.fillRect(rand() * S, rand() * S, 1.5, 1.5);
  }
  // roter Ring
  ctx.fillStyle = '#a3231b';
  ctx.beginPath(); ctx.arc(c, c, 478, 0, Math.PI * 2); ctx.arc(c, c, 372, 0, Math.PI * 2, true); ctx.fill();
  ctx.strokeStyle = '#d4a548';
  ctx.lineWidth = 5;
  [486, 364, 300].forEach((r) => { ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke(); });
  // Schrift im Ring
  const label = [name, district].filter(Boolean).join('  ·  ').toUpperCase() + '  ·  ';
  ctx.fillStyle = '#f6ead2';
  ctx.font = '500 46px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const R = 425;
  let text = label;
  const circ = 2 * Math.PI * R;
  const widthOf = (s) => Array.from(s).reduce((w, ch) => w + ctx.measureText(ch).width + 8, 0);
  while (widthOf(text + label) < circ * 0.98) text += label;
  const total = widthOf(text);
  const scale = circ / total;
  let ang = -Math.PI / 2;
  for (const ch of Array.from(text)) {
    const w = (ctx.measureText(ch).width + 8) * scale;
    ang += (w / 2) / R;
    ctx.save();
    ctx.translate(c + Math.cos(ang) * R, c + Math.sin(ang) * R);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    ang += (w / 2) / R;
  }
  // Zentrum (wird größtenteils vom Glas verdeckt)
  ctx.fillStyle = '#a3231b';
  fitFont(ctx, name, 'italic 400', '"Playfair Display", serif', 520, 92);
  ctx.fillText(name, c, c);
  return canvasTex(cv);
}

function decalTexture(name, district) {
  const W = 420, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const gold = '#e2b65a', red = '#b3261e';
  // Eichstrich „0,5 l" (v ≈ 0.932 → y ≈ 70)
  ctx.strokeStyle = 'rgba(255,248,235,.9)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(250, 70); ctx.lineTo(345, 70); ctx.stroke();
  ctx.fillStyle = 'rgba(255,248,235,.92)';
  ctx.font = '700 30px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('0,5 l', 300, 102);
  ctx.textAlign = 'center';

  // Wappen
  const cx = W / 2, cy = 560;
  ctx.lineWidth = 5;
  ctx.strokeStyle = gold;
  ctx.fillStyle = red;
  ctx.beginPath(); ctx.arc(cx, cy, 66, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2); ctx.stroke();
  // Krug-Symbol
  ctx.fillStyle = '#f6ead2';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 18); ctx.lineTo(cx + 16, cy - 18); ctx.lineTo(cx + 16, cy + 26);
  ctx.quadraticCurveTo(cx + 16, cy + 32, cx + 10, cy + 32); ctx.lineTo(cx - 18, cy + 32);
  ctx.quadraticCurveTo(cx - 24, cy + 32, cx - 24, cy + 26); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 14, cy - 22, 10, 0, Math.PI * 2); ctx.arc(cx - 1, cy - 26, 11, 0, Math.PI * 2); ctx.arc(cx + 11, cy - 21, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f6ead2'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(cx + 16, cy - 8); ctx.lineTo(cx + 28, cy - 8); ctx.quadraticCurveTo(cx + 34, cy - 8, cx + 34, cy - 2); ctx.lineTo(cx + 34, cy + 12); ctx.quadraticCurveTo(cx + 34, cy + 18, cx + 28, cy + 18); ctx.lineTo(cx + 16, cy + 18); ctx.stroke();

  // Name
  const ny = cy + 128;
  const size = fitFont(ctx, name, 'italic 400', '"Playfair Display", serif', W - 40, 84);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.1);
  ctx.strokeStyle = gold;
  ctx.strokeText(name, cx, ny);
  ctx.fillStyle = red;
  ctx.fillText(name, cx, ny);
  // Ort
  if (district) {
    ctx.fillStyle = gold;
    ctx.font = '700 26px Inter, sans-serif';
    const d = district.toUpperCase().split('').join(' ');
    ctx.fillText(d, cx, ny + size * 0.72 + 6);
    const dw = ctx.measureText(d).width / 2 + 18;
    ctx.fillRect(cx - dw - 50, ny + size * 0.72 + 5, 44, 2);
    ctx.fillRect(cx + dw + 6, ny + size * 0.72 + 5, 44, 2);
  }
  return canvasTex(cv);
}

function backdropTexture(photo, rand, small) {
  const W = small ? 1024 : 2048, H = W / 2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(0, 0, W, H);

  // unscharfes Foto der Stube als Hintergrund („Bokeh" der echten Bar)
  if (photo) {
    const sw = 48, sh = 24;
    const s1 = document.createElement('canvas'); s1.width = sw; s1.height = sh;
    const c1 = s1.getContext('2d');
    const ir = photo.width / photo.height, tr = sw / sh;
    let dw = sw, dh = sh, dx = 0, dy = 0;
    if (ir > tr) { dw = sh * ir; dx = (sw - dw) / 2; } else { dh = sw / ir; dy = (sh - dh) / 2.4; }
    c1.drawImage(photo, dx, dy, dw, dh);
    const s2 = document.createElement('canvas'); s2.width = 192; s2.height = 96;
    const c2 = s2.getContext('2d');
    c2.imageSmoothingQuality = 'high';
    c2.drawImage(s1, 0, 0, 192, 96);
    c2.globalCompositeOperation = 'multiply';
    c2.fillStyle = '#d98a3a';
    c2.fillRect(0, 0, 192, 96);
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(s2, 0, 0, W, H);
    ctx.restore();
  }

  // warmer Kern hinter dem Glas
  let g = ctx.createRadialGradient(W * 0.5, H * 0.52, 0, W * 0.5, H * 0.52, H * 0.7);
  g.addColorStop(0, 'rgba(120,64,20,.55)');
  g.addColorStop(0.5, 'rgba(60,30,10,.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Jalousie-Licht (wie die Streifen in der Fensternische)
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const oc = off.getContext('2d');
  oc.save();
  oc.translate(W * 0.74, H * 0.36);
  oc.rotate(-0.42);
  for (let i = -16; i < 16; i++) {
    oc.fillStyle = 'rgba(255,190,110,.20)';
    oc.fillRect(-W * 0.4, i * H * 0.034, W * 0.8, H * 0.017);
  }
  oc.restore();
  oc.globalCompositeOperation = 'destination-in';
  const mg = oc.createRadialGradient(W * 0.76, H * 0.34, 0, W * 0.76, H * 0.34, H * 0.42);
  mg.addColorStop(0, 'rgba(0,0,0,1)');
  mg.addColorStop(1, 'rgba(0,0,0,0)');
  oc.fillStyle = mg;
  oc.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(off, 0, 0);
  ctx.restore();

  // Bokeh-Lichter
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const k = W / 2048;
  for (let i = 0; i < 54; i++) {
    const x = rand() * W;
    const y = H * (0.06 + Math.pow(rand(), 1.3) * 0.62);
    const r = (10 + Math.pow(rand(), 2) * 70) * k;
    const hue = 26 + rand() * 16;
    const a = 0.05 + rand() * 0.2;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `hsla(${hue},95%,62%,${a * 0.55})`);
    gr.addColorStop(0.82, `hsla(${hue},95%,60%,${a * 0.75})`);
    gr.addColorStop(0.92, `hsla(${hue},95%,70%,${a})`);
    gr.addColorStop(1, `hsla(${hue},95%,60%,0)`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Vignette + dunkler Boden für sanften Übergang zur Theke
  g = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.45, W * 0.62);
  g.addColorStop(0, 'rgba(8,6,4,0)');
  g.addColorStop(1, 'rgba(8,6,4,.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.7);
  g.addColorStop(0, 'rgba(10,8,6,0)');
  g.addColorStop(1, 'rgba(10,8,6,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return canvasTex(cv);
}

function fadeTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S * 0.36);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvasTex(cv, false);
}

function causticTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,214,130,1)');
  g.addColorStop(0.25, 'rgba(255,160,50,.75)');
  g.addColorStop(0.6, 'rgba(200,90,10,.25)');
  g.addColorStop(1, 'rgba(120,40,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvasTex(cv);
}

function shadowTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,.85)');
  g.addColorStop(0.5, 'rgba(0,0,0,.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvasTex(cv);
}

/* ------------------------------------------------ Umgebungs-Licht */
function buildEnvScene() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x140d08, side: THREE.BackSide })));
  const emit = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide });
  // Fenster mit Jalousie rechts hinten
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.26), emit(3.4, 2.3, 1.3));
    m.position.set(8, 0.6 + i * 0.48, -4);
    m.lookAt(0, 1.6, 0);
    s.add(m);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), emit(1.4, 0.85, 0.42));
  top.position.set(0, 10, 1); top.lookAt(0, 0, 0); s.add(top);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), emit(2.6, 1.25, 0.45));
  left.position.set(-9, 2.5, 2); left.lookAt(0, 2, 0); s.add(left);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), emit(0.4, 0.26, 0.14));
  front.position.set(0, 2.5, 12); front.lookAt(0, 2, 0); s.add(front);
  [[-3, 6, -4], [2.5, 7, -6], [-0.8, 5.2, -1.4]].forEach((p) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8), emit(12, 7, 2.6));
    b.position.set(p[0], p[1], p[2]);
    s.add(b);
  });
  return s;
}

/* -------------------------------------------------- Pendelleuchte */
function makePendant(mats, glowTex, { cable = 8, light = 0 } = {}) {
  const g = new THREE.Group();
  const cableM = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, cable, 6), mats.cable);
  cableM.position.y = 0.34 + cable / 2;
  const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.3, 32), mats.brass);
  fitting.position.y = 0.2;
  const shade = new THREE.Mesh(new THREE.LatheGeometry([
    new V2(0.045, 0.1), new V2(0.13, 0.085), new V2(0.4, 0.012), new V2(0.445, -0.012),
    new V2(0.44, -0.026), new V2(0.39, -0.004), new V2(0.12, 0.066), new V2(0.045, 0.078)
  ], 64), mats.shade);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.443, 0.008, 8, 64), mats.brass);
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.016;
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.1, 20), mats.brass);
  socket.position.y = 0.02;
  const bulb = new THREE.Mesh(new THREE.LatheGeometry([
    new V2(0.001, -0.36), new V2(0.05, -0.345), new V2(0.095, -0.29), new V2(0.112, -0.21),
    new V2(0.1, -0.13), new V2(0.06, -0.06), new V2(0.036, -0.02), new V2(0.034, 0.0)
  ], 32), mats.bulb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb35c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  glow.position.y = -0.2;
  glow.scale.setScalar(1.9);
  g.add(cableM, fitting, shade, ring, socket, bulb, glow);
  let pl = null;
  if (light > 0) {
    pl = new THREE.PointLight(0xffa850, light, 0, 2);
    pl.position.y = -0.22;
    g.add(pl);
  }
  return { group: g, glow, light: pl, bulb };
}

/* =================================================================== */
export async function createHero(canvas, options) {
  const o = Object.assign({
    reducedMotion: false, siteName: '', district: '', backdropImage: null,
    getScroll: () => 0, onFirstFrame() {}, onFail() {}
  }, options);
  const small = Math.min(window.innerWidth, window.innerHeight) < 640 || window.matchMedia('(pointer: coarse)').matches;
  const rand = mulberry(1873);

  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('italic 400 64px "Playfair Display"'),
        document.fonts.load('500 40px Inter'),
        document.fonts.load('700 30px Inter')
      ]),
      new Promise((r) => setTimeout(r, 1500))
    ]);
  } catch (e) { /* Schriften optional */ }
  const photo = o.backdropImage ? await loadImage(o.backdropImage).catch(() => null) : null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x0a0806, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0806, 14, 30);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  // Umgebung für Reflexionen
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = buildEnvScene();
  const envRT = pmrem.fromScene(envScene, 0.035);
  scene.environment = envRT.texture;
  envScene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); if (ob.material) ob.material.dispose(); });
  pmrem.dispose();

  const glowTex = glowTexture();
  const disposables = [glowTex];
  const track = (x) => { disposables.push(x); return x; };

  /* ---------- Hintergrund */
  const backTex = track(backdropTexture(photo, rand, small));
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: backTex, fog: false, toneMapped: false }));
  backdrop.position.set(0, 3.2, -13);
  scene.add(backdrop);

  /* ---------- Theke (Schiefer) */
  const slate = track(slateTexture(rand));
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({
    color: 0x232427, roughness: 0.6, metalness: 0.0, roughnessMap: slate, bumpMap: slate, bumpScale: 0.6, envMapIntensity: 0.55,
    alphaMap: track(fadeTexture()), transparent: true, depthWrite: true
  }));
  counter.renderOrder = -1;
  counter.rotation.x = -Math.PI / 2;
  counter.position.set(0, -0.036, 0);
  scene.add(counter);

  /* ---------- Glas & Bier */
  const profile = buildProfile();
  const R = makeRadius(profile);
  const innerR = (y) => R(y) - G.WALL;

  const product = new THREE.Group();
  scene.add(product);

  // Bierdeckel
  const coasterTex = track(coasterTexture(o.siteName, o.district, rand));
  const cardboard = new THREE.MeshStandardMaterial({ color: 0xd9c7a2, roughness: 0.9 });
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.036, 128), [
    cardboard,
    new THREE.MeshStandardMaterial({ map: coasterTex, roughness: 0.85 }),
    cardboard
  ]);
  coaster.position.y = -0.018;
  product.add(coaster);

  // Glaskörper
  const W = G.WALL, RIM = G.RIM;
  const gp = [new V2(0.001, 0), new V2(0.44, 0), new V2(0.488, 0.007)];
  profile.forEach((p) => { if (p.y > 0.012) gp.push(p.clone()); });
  const rimR = profile[profile.length - 1].x;
  gp.push(new V2(rimR - 0.003, RIM + 0.009), new V2(rimR - 0.014, RIM + 0.014), new V2(rimR - W, RIM + 0.003));
  for (let i = profile.length - 1; i >= 0; i--) {
    const p = profile[i];
    if (p.y > RIM - 0.01) continue;
    if (p.y < G.BASE + 0.05) break;
    gp.push(new V2(p.x - W, p.y));
  }
  gp.push(new V2(innerR(G.BASE + 0.05) - 0.035, G.BASE + 0.006), new V2(0.3, G.BASE - 0.012), new V2(0.001, G.BASE - 0.02));
  const glassGeo = new THREE.LatheGeometry(gp, small ? 72 : 112);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.22, ior: 1.5,
    attenuationColor: new THREE.Color(0xfff2dc), attenuationDistance: 4,
    clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.5,
    side: THREE.DoubleSide
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.renderOrder = 2;
  product.add(glass);

  // Fresnel-Kante: lässt die Silhouette im Dunkeln warm aufleuchten
  const rimGeo = new THREE.LatheGeometry(profile.filter((p) => p.y > 0.01), small ? 72 : 112);
  const rimMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 1.25 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix * vec4(position * vec3(1.004, 1.0, 1.004), 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.2);
        float fadeTop = 1.0 - smoothstep(3.0, 3.26, vY) * 0.4;
        vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.9, 0.72), f) * f * uI * fadeTop;
        gl_FragColor = vec4(col, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const rimShell = new THREE.Mesh(rimGeo, rimMat);
  rimShell.renderOrder = 3;
  product.add(rimShell);

  // Bier
  const lp = [new V2(0.001, G.BASE - 0.012), new V2(0.29, G.BASE - 0.005)];
  for (let y = G.BASE + 0.03; y < G.FILL; y += 0.03) lp.push(new V2(innerR(y) - 0.006, y));
  lp.push(new V2(innerR(G.FILL) - 0.006, G.FILL), new V2(0.001, G.FILL + 0.002));
  const beerMat = new THREE.MeshPhysicalMaterial({
    color: 0x9a4a06, roughness: 0.16, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.1,
    emissive: 0xffffff, emissiveIntensity: 1, envMapIntensity: 0.55
  });
  beerMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        float hgt = smoothstep(${G.BASE.toFixed(3)}, ${G.FILL.toFixed(3)}, vLY);
        vec3 deep = vec3(0.16, 0.035, 0.0);
        vec3 core = vec3(0.78, 0.30, 0.03);
        vec3 top = vec3(0.98, 0.50, 0.09);
        vec3 glowC = mix(core, top, smoothstep(0.55, 1.0, hgt));
        totalEmissiveRadiance = mix(deep, glowC, pow(facing, 1.6) * (0.62 + 0.38 * hgt));
        diffuseColor.rgb *= 0.35 + 0.65 * (1.0 - facing);`);
  };
  const beer = new THREE.Mesh(new THREE.LatheGeometry(lp, small ? 64 : 96), beerMat);
  beer.renderOrder = 1;
  product.add(beer);

  // Schaumkrone
  const fp = [new V2(0.001, G.FILL - 0.045)];
  for (let y = G.FILL - 0.045; y < RIM; y += 0.025) fp.push(new V2(innerR(y) - 0.004, y));
  const r0 = innerR(RIM) - 0.004;
  for (let k = 0; k <= 18; k++) {
    const a = (k / 18) * Math.PI / 2;
    fp.push(new V2(Math.max(0.001, (r0 + 0.03 * Math.sin(a * 2)) * Math.pow(Math.cos(a), 0.78)), RIM + 0.002 + G.DOME * Math.sin(a)));
  }
  const foamGeo = new THREE.LatheGeometry(fp, small ? 64 : 96, 0, Math.PI * 2);
  {
    const pos = foamGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y > RIM - 0.01) {
        const t = Math.min(1, (v.y - RIM) / G.DOME);
        const n = vnoise(v.x * 6 + 10, v.y * 6, v.z * 6 + 10) - 0.5;
        const n2 = vnoise(v.x * 17, v.y * 17 + 5, v.z * 17) - 0.5;
        const amp = Math.sin(Math.PI * Math.min(1, 0.25 + t)) ;
        const rr = Math.hypot(v.x, v.z);
        if (rr > 0.002) {
          const s = 1 + (n * 0.09 + n2 * 0.03) * amp * (t > 0.05 ? 1 : 0.2);
          v.x *= s; v.z *= s;
        }
        v.y += (n * 0.08 + n2 * 0.025) * amp * t;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    foamGeo.computeVertexNormals();
  }
  const foamBump = track(foamBumpTexture(rand));
  const foam = new THREE.Mesh(foamGeo, new THREE.MeshStandardMaterial({
    color: 0xfff6e8, roughness: 0.72, metalness: 0, bumpMap: foamBump, bumpScale: 1.1,
    emissive: 0xd8b688, emissiveIntensity: 0.62, envMapIntensity: 1.1
  }));
  foam.renderOrder = 1;
  product.add(foam);

  // Glasdruck (Name + Eichstrich) – macht die Drehung sichtbar
  const dp = [];
  const DY0 = 0.95, DY1 = 2.72;
  for (let i = 0; i <= 48; i++) { const y = DY0 + (DY1 - DY0) * (i / 48); dp.push(new V2(R(y) + 0.0035, y)); }
  const decalTex = track(decalTexture(o.siteName, o.district));
  const decal = new THREE.Mesh(new THREE.LatheGeometry(dp, 48, -0.62, 1.24), new THREE.MeshStandardMaterial({
    map: decalTex, transparent: true, roughness: 0.3, metalness: 0.1, depthWrite: false, envMapIntensity: 1.2,
    emissive: 0x2a0a04, emissiveIntensity: 0.3
  }));
  decal.renderOrder = 4;
  product.add(decal);

  // Kondenswasser-Tropfen
  const dropN = small ? 260 : 460;
  const dropPos = new Float32Array(dropN * 3), dropSize = new Float32Array(dropN);
  for (let i = 0; i < dropN; i++) {
    const y = 0.35 + rand() * (G.FILL - 0.45);
    const a = rand() * Math.PI * 2;
    const r = R(y) + 0.006;
    dropPos.set([Math.sin(a) * r, y, Math.cos(a) * r], i * 3);
    dropSize[i] = 0.008 + Math.pow(rand(), 3) * 0.03;
  }
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  dropGeo.setAttribute('aSize', new THREE.BufferAttribute(dropSize, 1));
  const pointScale = { value: 600 };
  const dropMat = new THREE.ShaderMaterial({
    uniforms: { uScale: pointScale },
    vertexShader: `attribute float aSize; uniform float uScale; varying float vF;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normalize(vec3(position.x, 0.0, position.z)));
        vF = clamp(dot(n, normalize(-mv.xyz)), 0.0, 1.0);
        gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vF;
      void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float d = length(c); if (d > 1.0) discard;
        float hl = smoothstep(0.5, 0.0, length(c - vec2(-0.3, -0.35)));
        float rim = smoothstep(0.7, 1.0, d) * (1.0 - smoothstep(0.92, 1.0, d));
        float a = (hl * 0.9 + rim * 0.35) * (0.25 + 0.75 * vF);
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a, a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const drops = new THREE.Points(dropGeo, dropMat);
  drops.renderOrder = 5;
  product.add(drops);

  // Kohlensäure-Perlen
  const bubN = small ? 120 : 220;
  const bub = { y: new Float32Array(bubN), sp: new Float32Array(bubN), a: new Float32Array(bubN), rr: new Float32Array(bubN), ph: new Float32Array(bubN), s: new Float32Array(bubN) };
  const streams = Array.from({ length: 7 }, () => ({ a: rand() * Math.PI * 2, rr: 0.25 + rand() * 0.6 }));
  const bubPos = new Float32Array(bubN * 3), bubSize = new Float32Array(bubN), bubAlpha = new Float32Array(bubN);
  const resetBubble = (i, initial) => {
    const st = i % 2 === 0 ? streams[i % streams.length] : null;
    bub.a[i] = st ? st.a + (rand() - 0.5) * 0.05 : rand() * Math.PI * 2;
    bub.rr[i] = st ? st.rr : Math.sqrt(rand()) * 0.86;
    bub.y[i] = initial ? G.BASE + rand() * (G.FILL - G.BASE) : G.BASE + 0.02 + rand() * (st ? 0.05 : 0.6);
    bub.sp[i] = 0.18 + rand() * 0.22;
    bub.ph[i] = rand() * 10;
    bub.s[i] = 0.014 + rand() * 0.016;
  };
  for (let i = 0; i < bubN; i++) resetBubble(i, true);
  const bubGeo = new THREE.BufferGeometry();
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  bubGeo.setAttribute('aSize', new THREE.BufferAttribute(bubSize, 1));
  bubGeo.setAttribute('aAlpha', new THREE.BufferAttribute(bubAlpha, 1));
  const bubMat = new THREE.ShaderMaterial({
    uniforms: { uScale: pointScale },
    vertexShader: `attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = aAlpha;
        gl_PointSize = max(1.5, aSize * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float d = length(c); if (d > 1.0) discard;
        float ring = smoothstep(0.55, 0.9, d) * (1.0 - smoothstep(0.9, 1.0, d));
        float hl = smoothstep(0.42, 0.0, length(c - vec2(-0.32, -0.32)));
        float a = (ring * 0.8 + hl + 0.12) * vA;
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.68) * a, a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
  });
  const bubbles = new THREE.Points(bubGeo, bubMat);
  bubbles.renderOrder = 6;
  bubbles.frustumCulled = false;
  product.add(bubbles);
  const updateBubbles = (dt, t) => {
    for (let i = 0; i < bubN; i++) {
      const h = (bub.y[i] - G.BASE) / (G.FILL - G.BASE);
      bub.y[i] += bub.sp[i] * dt * (0.55 + 0.9 * h);
      if (bub.y[i] > G.FILL - 0.03) resetBubble(i, false);
      const y = bub.y[i];
      const hh = (y - G.BASE) / (G.FILL - G.BASE);
      const r = (innerR(y) - 0.03) * bub.rr[i];
      const wob = Math.sin(t * 6 + bub.ph[i]) * 0.006 * hh;
      bubPos[i * 3] = Math.sin(bub.a[i]) * r + wob;
      bubPos[i * 3 + 1] = y;
      bubPos[i * 3 + 2] = Math.cos(bub.a[i]) * r;
      bubSize[i] = bub.s[i] * (0.55 + 0.8 * hh);
      bubAlpha[i] = Math.min(1, (y - G.BASE) * 8) * (1 - Math.max(0, (y - (G.FILL - 0.12)) / 0.09));
    }
    bubGeo.attributes.position.needsUpdate = true;
    bubGeo.attributes.aSize.needsUpdate = true;
    bubGeo.attributes.aAlpha.needsUpdate = true;
  };

  // Kontaktschatten & Bernstein-Kaustik (Licht, das durchs Bier fällt)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: track(shadowTexture()), transparent: true, depthWrite: false, opacity: 0.85 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.034;
  scene.add(shadow);
  const caustic = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({
    map: track(causticTexture()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7, toneMapped: false
  }));
  caustic.rotation.x = -Math.PI / 2;
  caustic.rotation.z = -0.75;
  caustic.position.set(0.62, 0.003, 0.62);
  scene.add(caustic);

  /* ---------- Licht */
  scene.add(new THREE.HemisphereLight(0x7a5030, 0x0b0806, 0.55));
  const mats = {
    cable: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd2a85c, metalness: 1, roughness: 0.26, envMapIntensity: 1.3 }),
    shade: new THREE.MeshStandardMaterial({ color: 0x18181a, metalness: 0.65, roughness: 0.38, side: THREE.DoubleSide }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.62), toneMapped: false })
  };
  const main = makePendant(mats, glowTex, { cable: 8, light: 6 });
  main.group.position.set(-1.75, 4.0, -1.1);
  scene.add(main.group);
  const pendants = [main];
  [[-3.6, 5.1, -5.2, 0.9], [3.3, 5.5, -6.5, 0.9], [0.9, 6.3, -9.5, 0.9], [-6.2, 6.0, -9.8, 0.9]].forEach(([x, y, z, s]) => {
    const p = makePendant(mats, glowTex, { cable: 8, light: 0 });
    p.group.position.set(x, y, z);
    p.group.scale.setScalar(s);
    p.glow.scale.setScalar(2.4);
    scene.add(p.group);
    pendants.push(p);
  });

  // Hauptlicht: Gegenlicht von der Pendelleuchte schräg hinten
  const key = new THREE.SpotLight(0xffb066, 55, 0, Math.PI / 6.5, 0.75, 2);
  key.position.set(-1.75, 3.75, -1.1);
  key.target.position.set(0.1, 0.6, 0.2);
  scene.add(key, key.target);
  const rimLeft = new THREE.PointLight(0xff9238, 9, 0, 2);
  rimLeft.position.set(-2.4, 2.0, -1.8);
  const rimRight = new THREE.PointLight(0xffc27a, 7, 0, 2);
  rimRight.position.set(2.6, 1.6, -1.6);
  const fill = new THREE.DirectionalLight(0xffd8a6, 0.45);
  fill.position.set(3, 3, 8);
  scene.add(rimLeft, rimRight, fill);

  // Lichtkegel
  const bulbWorld = new THREE.Vector3(-1.75, 4.0 - 0.2, -1.1);
  const floorPt = new THREE.Vector3(0.15, -0.03, 0.25);
  const coneLen = bulbWorld.distanceTo(floorPt);
  const coneGeo = new THREE.CylinderGeometry(0.12, 1.7, coneLen, 48, 1, true);
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0.16 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vT;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vT = uv.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI; varying vec3 vN; varying vec3 vV; varying float vT;
      void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float a = e * pow(vT, 1.7) * uI;
        gl_FragColor = vec4(vec3(1.0, 0.68, 0.32) * a, a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.copy(bulbWorld).add(floorPt).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bulbWorld.clone().sub(floorPt).normalize());
  cone.renderOrder = 7;
  scene.add(cone);

  // Rauchschwaden
  const smokeTex = track(smokeTexture(rand));
  const smoke = [];
  const smokeN = small ? 9 : 15;
  for (let i = 0; i < smokeN; i++) {
    const m = new THREE.SpriteMaterial({ map: smokeTex, color: 0xc89868, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
    const s = new THREE.Sprite(m);
    const front = i < 3;
    s.position.set(-6 + rand() * 12, 0.6 + rand() * 4.2, front ? 1.2 + rand() * 1.5 : -6 + rand() * 6);
    const sc = 3 + rand() * 4;
    s.scale.set(sc * 1.4, sc, 1);
    s.userData = { vx: 0.06 + rand() * 0.12, vy: 0.015 + rand() * 0.03, vr: (rand() - 0.5) * 0.08, base: front ? 0.035 : 0.06 + rand() * 0.07, ph: rand() * 6.28 };
    m.rotation = rand() * 6.28;
    s.renderOrder = 8;
    scene.add(s);
    smoke.push(s);
  }

  // Staub im Licht
  const dustN = small ? 140 : 260;
  const dustPos = new Float32Array(dustN * 3), dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    const t = rand();
    const p = bulbWorld.clone().lerp(floorPt, 0.1 + t * 0.85);
    const spread = 0.15 + t * 1.3;
    p.x += (rand() - 0.5) * spread * 2; p.z += (rand() - 0.5) * spread * 2;
    dustPos.set([p.x, p.y, p.z], i * 3);
    dustSeed[i] = rand() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: pointScale },
    vertexShader: `attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){ vec3 p = position;
        p.x += sin(uTime * 0.13 + aSeed) * 0.22; p.z += cos(uTime * 0.11 + aSeed * 1.3) * 0.22;
        p.y += sin(uTime * 0.09 + aSeed * 2.1) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 7.0));
        gl_PointSize = max(1.0, (0.012 + fract(aSeed) * 0.016) * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main(){ float d = length(gl_PointCoord * 2.0 - 1.0); if (d > 1.0) discard; float a = (1.0 - d) * vA * 0.8;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.48) * a, a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.renderOrder = 9;
  dust.frustumCulled = false;
  scene.add(dust);

  if (o.reducedMotion) { bubbles.visible = false; dust.visible = false; smoke.forEach((s) => { s.visible = false; }); }

  /* ---------- Kamera & Layout */
  const target = new THREE.Vector3(0, 1.85, 0);
  const frame = { dist: 11, az: 0.12, el: 0.17, offX: 0, offY: 0 };
  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let visH;
    if (aspect < 0.85) {          // Smartphone hochkant: Glas oben mittig
      visH = Math.max(7.6, 3.1 / aspect);
      frame.offX = 0; frame.offY = h * 0.16;
    } else if (aspect < 1.3) {    // Tablet
      visH = 6.6;
      frame.offX = -w * 0.14; frame.offY = h * 0.02;
    } else {                      // Desktop: Glas rechts, Platz für Text
      visH = 6.5;
      frame.offX = -w * 0.2; frame.offY = h * 0.03;
    }
    frame.dist = visH / (2 * tanH);
    camera.setViewOffset(w, h, frame.offX, frame.offY, w, h);
    camera.updateProjectionMatrix();
    pointScale.value = (h * renderer.getPixelRatio()) / (2 * tanH);
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!o.reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });

  const startT = performance.now();
  let rot = 0.35;
  let time = 0;
  const flick = (t) => (t < 1.4 ? (0.55 + 0.45 * Math.abs(Math.sin(t * 23) * Math.sin(t * 7.3))) * Math.min(1, t / 0.5) : 1);

  function update(dt, introRaw) {
    const intro = o.reducedMotion ? 1 : Math.min(1, introRaw);
    const ease = 1 - Math.pow(1 - intro, 3);
    time += dt;
    const k = 1 - Math.exp(-dt * 2.6);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    const sp = o.reducedMotion ? 0 : o.getScroll();

    if (!o.reducedMotion) rot += dt * 0.22;
    product.rotation.y = rot;

    const dist = frame.dist * (1 + (1 - ease) * 0.28 + sp * 0.18);
    const az = frame.az + pointer.x * 0.2 + (1 - ease) * 0.35;
    const el = frame.el + pointer.y * 0.06 + sp * 0.32;
    const tgt = target.clone();
    tgt.y += sp * 0.4;
    camera.position.set(
      tgt.x + Math.sin(az) * Math.cos(el) * dist,
      tgt.y + Math.sin(el) * dist,
      tgt.z + Math.cos(az) * Math.cos(el) * dist
    );
    camera.lookAt(tgt);

    // Licht „einschalten" beim Start (Edison-Glühen)
    const lt = o.reducedMotion ? 10 : (performance.now() - startT) / 1000;
    const fl = flick(lt);
    renderer.toneMappingExposure = 0.35 + 0.7 * Math.min(1, lt / 1.6);
    key.intensity = 55 * fl;
    main.light.intensity = 6 * fl;
    pendants.forEach((p, i) => { p.glow.material.opacity = (i === 0 ? 0.95 : 0.8) * (i === 0 ? fl : Math.min(1, lt / (1 + i * 0.3))); });
    coneMat.uniforms.uI.value = 0.16 * fl;

    if (!o.reducedMotion) {
      updateBubbles(dt, time);
      dustMat.uniforms.uTime.value = time;
      smoke.forEach((s) => {
        const u = s.userData;
        s.position.x += u.vx * dt;
        s.position.y += Math.sin(time * 0.2 + u.ph) * 0.002;
        if (s.position.x > 7.5) s.position.x = -7.5;
        s.material.rotation += u.vr * dt;
        s.material.opacity = u.base * (0.7 + 0.3 * Math.sin(time * 0.3 + u.ph)) * Math.min(1, time / 3);
      });
      // Haze wird beim Scrollen dichter – Übergang in die Seite
      main.glow.scale.setScalar(1.9 + Math.sin(time * 2.1) * 0.03);
    }
  }

  /* ---------- Render-Schleife */
  let raf = 0, running = false, inView = true, last = 0, firstDone = false, dead = false;
  let frames = 0, slowAcc = 0, degraded = false;
  function renderFrame() {
    renderer.render(scene, camera);
    if (!firstDone) {
      firstDone = true;
      requestAnimationFrame(() => o.onFirstFrame());
    }
  }
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(0.05, Math.max(0, raw));
    update(dt, (now - startT) / 2600);
    renderFrame();
    // Adaptive Qualität: bei dauerhaft < ~28 fps Pixeldichte reduzieren
    if (!degraded && frames < 120) {
      frames++;
      if (frames > 20) slowAcc += raw;
      if (frames === 120 && slowAcc / 100 > 1 / 28 && dpr > 1) {
        degraded = true; dpr = 1; layout();
      }
    }
  }
  function setRunning() {
    const should = !dead && !o.reducedMotion && inView && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }
  function renderStatic() { update(0, 1); renderFrame(); }

  layout();
  const ro = new ResizeObserver(() => { layout(); if (o.reducedMotion || !running) renderStatic(); });
  ro.observe(canvas);
  const io = new IntersectionObserver((en) => { inView = en[0].isIntersecting; setRunning(); }, { threshold: 0 });
  io.observe(canvas);
  const onVis = () => setRunning();
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    dead = true; setRunning();
    o.onFail();
  });

  // Shader vorkompilieren, dann starten
  renderer.compile(scene, camera);
  if (o.reducedMotion) renderStatic(); else setRunning();

  return {
    dispose() {
      dead = true; setRunning();
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onPointer);
      scene.traverse((ob) => {
        if (ob.geometry) ob.geometry.dispose();
        const m = ob.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((mm) => mm.dispose());
      });
      disposables.forEach((d) => d.dispose());
      envRT.dispose();
      renderer.dispose();
    }
  };
}
