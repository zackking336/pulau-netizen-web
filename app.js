import * as THREE from 'three';

const W = 540, H = 960, PR = 2;
export const DURATION = 32.5;

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => x * x * (3 - 2 * x);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const pop = x => { // 0..1 with overshoot
  if (x <= 0) return 0; if (x >= 1) return 1;
  const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, t) => a.clone().lerp(b, t);
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...opts });
function mesh(geo, m, x = 0, y = 0, z = 0, shadow = true) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
  o.castShadow = shadow; o.receiveShadow = true; return o;
}

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(PR);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdff4ff, 60, 260);
const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 600);

const hemi = new THREE.HemisphereLight(0xdff3ff, 0x6f9b5a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);

// ---------- ocean ----------
const oceanGeo = new THREE.PlaneGeometry(420, 420, 110, 110).toNonIndexed();
oceanGeo.rotateX(-Math.PI / 2);
const oBase = oceanGeo.attributes.position.array.slice();
{
  const n = oBase.length / 3, col = new Float32Array(n * 3);
  const near = new THREE.Color(0x7fe3d8), mid = new THREE.Color(0x2bb3c8), far = new THREE.Color(0x1f7fb3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(oBase[i * 3], oBase[i * 3 + 2]);
    if (d < 16) c.copy(near).lerp(mid, ease(seg(d, 8, 16))); else c.copy(mid).lerp(far, ease(seg(d, 16, 70)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  oceanGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.35, metalness: 0.05 }));
ocean.receiveShadow = true;
scene.add(ocean);
function waveH(x, z, t) {
  const d = Math.hypot(x, z), amp = lerp(0.6, 1.6, seg(d, 10, 60));
  return amp * (0.11 * Math.sin(0.35 * x + 1.3 * t) + 0.08 * Math.sin(0.42 * z - 1.1 * t) + 0.045 * Math.sin(0.8 * (x + z) + 2.1 * t));
}
function updateOcean(t) {
  const p = oceanGeo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) p[i + 1] = waveH(oBase[i], oBase[i + 2], t);
  oceanGeo.attributes.position.needsUpdate = true;
  oceanGeo.computeVertexNormals();
}

// foam ring
const foam = mesh(new THREE.TorusGeometry(7.25, 0.18, 4, 40), mat(0xffffff, { roughness: 0.6 }), 0, 0.12, 0, false);
foam.rotation.x = Math.PI / 2; foam.scale.z = 0.25;
scene.add(foam);

// ---------- island ----------
const R = rnd(7);
function jitter(geo, amt, keepY = false) {
  const p = geo.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, [(R() - .5) * amt, keepY ? 0 : (R() - .5) * amt * .5, (R() - .5) * amt]);
    const j = map.get(k);
    p.setXYZ(i, p.getX(i) + j[0], p.getY(i) + j[1], p.getZ(i) + j[2]);
  }
  geo.computeVertexNormals(); return geo;
}
const island = new THREE.Group(); scene.add(island);
const SAND = 0.5, GRASS = 0.82;
island.add(mesh(jitter(new THREE.CylinderGeometry(6.8, 7.8, 1.8, 20, 1), 0.5, true), mat(0xf2d79b), 0, SAND - 0.9, 0));
const grass = mesh(jitter(new THREE.CylinderGeometry(4.4, 4.9, 0.5, 14, 1), 0.45, true), mat(0x7cc95a), -0.6, GRASS - 0.25, -1.4);
island.add(grass);
island.add(mesh(jitter(new THREE.DodecahedronGeometry(2.4, 0), 0.4), mat(0x5fb04a), -1.6, GRASS - 0.4, -3.2));
island.children.at(-1).scale.set(1.3, 0.75, 1);
// rocks
for (const [x, z, s] of [[4.6, 4.0, 0.45], [5.1, 3.3, 0.3], [-5.2, 3.0, 0.5], [-4.6, 3.6, 0.28], [3.0, -5.2, 0.5]]) {
  const r = mesh(new THREE.DodecahedronGeometry(s, 0), mat(0x9aa3a8), x, SAND + s * 0.3, z);
  r.rotation.set(R() * 3, R() * 3, R() * 3); island.add(r);
}
// grass tufts
for (let i = 0; i < 40; i++) {
  const a = R() * Math.PI * 2, d = R() * 4.0;
  const x = -0.6 + Math.cos(a) * d, z = -1.4 + Math.sin(a) * d;
  const g = mesh(new THREE.ConeGeometry(0.07, 0.3, 3), mat(0x4f9d3a), x, GRASS + 0.12, z, false);
  island.add(g);
}
// palms
function palm(x, y, z, h = 3.2, lean = 0.25, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot;
  const segs = 6; let px = 0, py = 0;
  for (let i = 0; i < segs; i++) {
    const s = mesh(new THREE.CylinderGeometry(0.15 - i * 0.012, 0.18 - i * 0.012, h / segs + 0.05, 6), mat(i % 2 ? 0x9a7046 : 0xa97c4f), 0, 0, 0);
    const k = i / segs; px = Math.sin(k * 1.4) * lean * h * 0.5;
    s.position.set(px, py + h / segs / 2, 0); s.rotation.z = -lean * 0.6 * (k + 0.2);
    py += h / segs; g.add(s);
  }
  const top = V(px + 0.05, py, 0);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Group(); leaf.position.copy(top); leaf.rotation.y = i / 7 * Math.PI * 2 + 0.3;
    const l = mesh(new THREE.ConeGeometry(0.32, 1.9, 4), mat(i % 2 ? 0x3f9b45 : 0x52b04f), 0, 0, 0.95);
    l.rotation.x = Math.PI / 2 + 0.55; l.scale.set(1, 1, 0.22); l.position.y = -0.25;
    leaf.add(l); g.add(leaf);
  }
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.13, 6, 5), mat(0x6b4a2a), top.x + Math.cos(i * 2.1) * 0.18, top.y - 0.15, Math.sin(i * 2.1) * 0.18));
  return g;
}
island.add(palm(-3.2, GRASS, -1.2, 3.4, 0.3, 0.4));
island.add(palm(1.6, GRASS, -2.6, 3.9, 0.2, 2.4));
island.add(palm(-0.8, GRASS, -4.4, 3.0, 0.25, 4.0));
island.add(palm(3.9, SAND, 2.0, 3.0, 0.45, -0.4));
island.add(palm(-4.6, SAND, 1.6, 2.6, 0.4, 2.8));

// distant islands
for (const [x, z, s] of [[-70, -90, 9], [60, -120, 12], [110, -60, 7], [-120, -40, 8], [25, -170, 15]]) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(mesh(new THREE.CylinderGeometry(s * 0.9, s, 1.2, 10), mat(0xf2d79b), 0, -0.2, 0, false));
  const hill = mesh(new THREE.DodecahedronGeometry(s * 0.7, 0), mat(0x5fae55), 0, 0, 0, false);
  hill.scale.set(1.2, 0.6, 1); g.add(hill); scene.add(g);
}

// ---------- character: Bang Tanjung ----------
function stripeTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f6f1e6' : '#e8632f'; x.fillRect(0, i * 16, 64, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SKIN = 0xc98a5a;
function makeChar() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.14, 0.46, 0);
    hip.add(mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.36, 6), mat(SKIN), 0, -0.2, 0));
    hip.add(mesh(new THREE.BoxGeometry(0.17, 0.07, 0.27), mat(0x5a3a22), 0, -0.41, 0.04));
    body.add(hip); legs.push(hip);
  }
  body.add(mesh(new THREE.CylinderGeometry(0.31, 0.3, 0.24, 9), mat(0x2b4c8c), 0, 0.53, 0));
  const torso = mesh(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshStandardMaterial({ map: stripeTex(), flatShading: true, roughness: 0.9 }), 0, 0.83, 0);
  torso.scale.set(1, 1.08, 0.9); body.add(torso);
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.36, 1.0, 0);
    sh.add(mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.42, 6), mat(SKIN), 0, -0.21, 0));
    sh.add(mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(SKIN), 0, -0.44, 0));
    sh.rotation.z = sx * 0.18; body.add(sh); arms.push(sh);
  }
  const head = new THREE.Group(); head.position.set(0, 1.36, 0); body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.31, 13, 10), mat(SKIN), 0, 0, 0));
  head.add(mesh(new THREE.SphereGeometry(0.075, 6, 5), mat(0xb87548), 0, -0.02, 0.3));
  for (const sx of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.038, 6, 5), mat(0x1c1410), sx * 0.11, 0.06, 0.27, false));
    const brow = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), mat(0x1c1410), sx * 0.11, 0.14, 0.275, false);
    brow.rotation.z = sx * -0.15; head.add(brow);
    const mu = mesh(new THREE.BoxGeometry(0.12, 0.045, 0.05), mat(0x1c1410), sx * 0.07, -0.1, 0.3, false);
    mu.rotation.z = sx * 0.3; head.add(mu);
    head.add(mesh(new THREE.SphereGeometry(0.06, 6, 5), mat(0xd9786a), sx * 0.19, -0.05, 0.22, false));
  }
  const hat = mesh(new THREE.ConeGeometry(0.58, 0.3, 12), mat(0xe2bd63), 0, 0.3, 0);
  head.add(hat);
  head.add(mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.06, 12), mat(0xb5392d), 0, 0.2, 0));
  // hammer & rod (hidden by default)
  const hammer = new THREE.Group();
  hammer.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 5), mat(0x8a5a33), 0, -0.1, 0));
  hammer.add(mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), mat(0x6b7178), 0, 0.08, 0));
  hammer.position.set(0, -0.45, 0.08); hammer.rotation.x = Math.PI / 2; arms[1].add(hammer);
  const rod = new THREE.Group();
  rod.add(mesh(new THREE.CylinderGeometry(0.018, 0.025, 2.4, 5), mat(0x7a5230), 0, 1.2, 0));
  rod.position.set(0, -0.45, 0.05); rod.rotation.x = 1.1; arms[1].add(rod);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(line);
  return { root, body, legs, arms, head, hammer, rod, line };
}
const ch = makeChar(); scene.add(ch.root);

function pose(c, { walk = 0, wave = 0, hammer = 0, sit = 0, talk = 0, t = 0, tool = 'none' }) {
  const s = Math.sin(walk);
  c.legs[0].rotation.x = s * 0.55 * (1 - sit) - sit * 1.45;
  c.legs[1].rotation.x = -s * 0.55 * (1 - sit) - sit * 1.45;
  c.body.position.y = Math.abs(Math.cos(walk)) * 0.05 * (walk ? 1 : 0) - sit * 0.38;
  c.arms[0].rotation.x = -s * 0.5;
  c.arms[1].rotation.x = s * 0.5;
  c.arms[0].rotation.z = -0.18; c.arms[1].rotation.z = 0.18;
  if (wave) { c.arms[1].rotation.z = lerp(0.18, 2.6, wave) + Math.sin(t * 12) * 0.25 * wave; c.arms[1].rotation.x = 0; }
  if (hammer) { c.arms[1].rotation.x = -1.2 - Math.max(0, Math.sin(t * 14)) * 1.1; c.arms[1].rotation.z = 0.1; }
  if (sit) { c.arms[1].rotation.x = -0.9; c.arms[0].rotation.x = -0.5; }
  c.head.rotation.x = talk ? Math.sin(t * 9) * 0.06 : 0;
  c.head.rotation.z = talk ? Math.sin(t * 4.5) * 0.04 : 0;
  c.hammer.visible = tool === 'hammer'; c.rod.visible = tool === 'rod'; c.line.visible = tool === 'rod';
}

// ---------- boat ----------
const boat = new THREE.Group(); scene.add(boat);
{
  const sh = new THREE.Shape();
  sh.moveTo(-0.75, -1.5); sh.lineTo(0.75, -1.5); sh.lineTo(0.75, 0.7); sh.lineTo(0, 1.7); sh.lineTo(-0.75, 0.7); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
  boat.add(mesh(g, mat(0x2f6fb5), 0, -0.25, 0));
  const g2 = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }); g2.rotateX(-Math.PI / 2);
  const trim = mesh(g2, mat(0xf4f1ea), 0, 0.22, 0); trim.scale.set(1.04, 1, 1.03); boat.add(trim);
  const g3 = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); g3.rotateX(-Math.PI / 2);
  const floor = mesh(g3, mat(0xa97c4f), 0, 0.26, 0); floor.scale.set(0.85, 1, 0.85); boat.add(floor);
  boat.add(mesh(new THREE.BoxGeometry(1.4, 0.08, 0.35), mat(0xa97c4f), 0, 0.42, 0.5));
  boat.add(mesh(new THREE.BoxGeometry(0.35, 0.55, 0.35), mat(0x3a3f45), 0, 0.35, 1.6));
  boat.add(mesh(new THREE.BoxGeometry(0.4, 0.15, 0.25), mat(0xd23c32), 0, 0.68, 1.6));
}

// ---------- sign ----------
function signTex(text) {
  const c = document.createElement('canvas'); c.width = 600; c.height = 240;
  const x = c.getContext('2d');
  x.fillStyle = '#9b6a3c'; x.fillRect(0, 0, 600, 240);
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#a7744a' : '#8f6036'; x.fillRect(0, i * 60, 600, 58); }
  x.strokeStyle = '#5b3a1e'; x.lineWidth = 14; x.strokeRect(7, 7, 586, 226);
  x.fillStyle = '#3a2412'; x.font = '700 92px Poppins, DejaVu Sans'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 92; while (x.measureText(text).width > 540 && fs > 40) { fs -= 4; x.font = `700 ${fs}px Poppins, DejaVu Sans`; }
  x.fillText(text, 300, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const sign = new THREE.Group(); scene.add(sign);
const signPost = mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6), mat(0x8a5a33), 0, 1.1, -0.08);
sign.add(signPost);
const wood = mat(0x8f6036);
const signFace = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const board = mesh(new THREE.BoxGeometry(1.6, 0.64, 0.1), [wood, wood, wood, wood, signFace, wood], 0, 1.85, 0);
sign.add(board);
sign.position.set(-1.4, SAND, 5.0);
sign.rotation.y = 0.25;
const texA = () => signTex('PENDUDUK: 1');
const texB = () => signTex('PENDUDUK: 1 → ?');
let signTexs = null;

// ---------- crab ----------
const crab = new THREE.Group(); scene.add(crab);
const crabLegs = [];
{
  const red = mat(0xe0472f);
  const b = mesh(new THREE.SphereGeometry(0.22, 8, 6), red, 0, 0.15, 0); b.scale.set(1.25, 0.55, 0.9); crab.add(b);
  for (const sx of [-1, 1]) {
    crab.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4), red, sx * 0.08, 0.27, 0.12));
    crab.add(mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(0x111111), sx * 0.08, 0.35, 0.12, false));
    const claw = mesh(new THREE.SphereGeometry(0.09, 6, 5), red, sx * 0.3, 0.18, 0.2); claw.scale.set(1, 0.7, 1.3); crab.add(claw);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Group(); l.position.set(sx * 0.2, 0.13, -0.1 + i * 0.1);
      l.add(mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.22, 4), red, sx * 0.08, -0.06, 0));
      l.children[0].rotation.z = sx * 1.0; crab.add(l); crabLegs.push(l);
    }
  }
  crab.scale.setScalar(1.35);
}

// ---------- pier ----------
const PIER = { x0: 6.3, x1: 12.6, z: 1.0, y: 0.78 };
const pierPosts = [], pierPlanks = [];
{
  for (let x = PIER.x0; x <= PIER.x1 + 0.01; x += 1.05) for (const dz of [-0.75, 0.75]) {
    const p = mesh(new THREE.CylinderGeometry(0.1, 0.11, 1.9, 6), mat(0x7a5230), x, PIER.y - 0.75, PIER.z + dz);
    p.userData.k = (x - PIER.x0) / (PIER.x1 - PIER.x0); scene.add(p); pierPosts.push(p);
  }
  let i = 0;
  for (let x = PIER.x0 - 0.1; x <= PIER.x1 + 0.12; x += 0.26, i++) {
    const p = mesh(new THREE.BoxGeometry(0.23, 0.08, 1.75), mat(i % 2 ? 0xb07e4f : 0xa3713f), x, PIER.y, PIER.z);
    p.rotation.y = (R() - .5) * 0.04;
    p.userData.k = (x - PIER.x0) / (PIER.x1 - PIER.x0); scene.add(p); pierPlanks.push(p);
  }
}

// ---------- sky & time-of-day ----------
const skyEl = document.getElementById('sky');
const DAYSKY = [new THREE.Color(0x63bdf5), new THREE.Color(0xbfe6fb), new THREE.Color(0xeaf7ff)];
const SETSKY = [new THREE.Color(0x4a5aa8), new THREE.Color(0xf08a6a), new THREE.Color(0xffd29a)];
function setTOD(k, sunAz) { // k: 0 day -> 1 sunset
  const c = i => DAYSKY[i].clone().lerp(SETSKY[i], k).getStyle();
  skyEl.style.background = `radial-gradient(circle at 74% 37%, rgba(255,236,180,${k}) 0 26px, rgba(255,190,120,${k*0.55}) 60px, rgba(255,160,100,0) 160px), linear-gradient(to bottom, ${c(0)} 0%, ${c(1)} 48%, ${c(2)} 62%, ${c(2)} 100%)`;
  scene.fog.color.copy(DAYSKY[2].clone().lerp(SETSKY[2], k));
  hemi.color.set(0xdff3ff).lerp(new THREE.Color(0xffc9a8), k);
  hemi.intensity = lerp(1.15, 0.85, k);
  sun.color.set(0xffffff).lerp(new THREE.Color(0xffa060), k);
  sun.intensity = lerp(2.3, 1.9, k);
  const el = lerp(0.95, 0.22, k);
  sunDir.set(Math.cos(sunAz) * Math.cos(el), Math.sin(el), Math.sin(sunAz) * Math.cos(el));
}
const sunDir = V(0.5, 0.8, 0.4);


// =====================================================================
// DAY 2 — penduduk baru + Madura Mart
// =====================================================================
const D2DUR = 47.5;
const WORLD = new THREE.Vector3();

// ---------- night sky ----------
const NIGHT = [new THREE.Color(0x0b1733), new THREE.Color(0x1b2f5e), new THREE.Color(0x2c4680)];
const stars = document.createElement('canvas');
stars.width = 1080; stars.height = 1200;
Object.assign(stars.style, { position: 'absolute', left: '0', top: '0', width: '540px', height: '600px', opacity: '0' });
{
  const x = stars.getContext('2d'), r = rnd(99);
  for (let i = 0; i < 260; i++) {
    const s = r() < 0.12 ? 2.6 : 1.4;
    x.fillStyle = `rgba(255,255,255,${0.45 + r() * 0.55})`;
    x.beginPath(); x.arc(r() * 1080, r() * 1100, s, 0, Math.PI * 2); x.fill();
  }
}
document.body.insertBefore(stars, renderer.domElement);
const HEMI_GROUND = new THREE.Color(0x6f9b5a);
function setSky(k, n, az) {
  setTOD(k, az);
  hemi.groundColor.copy(HEMI_GROUND);
  stars.style.opacity = n;
  if (n <= 0) return;
  const c = i => DAYSKY[i].clone().lerp(SETSKY[i], k).lerp(NIGHT[i], n).getStyle();
  skyEl.style.background = `radial-gradient(circle at 76% 20%, rgba(255,250,228,${n}) 0 17px, rgba(205,218,255,${n * 0.35}) 42px, rgba(160,180,255,0) 120px), linear-gradient(to bottom, ${c(0)} 0%, ${c(1)} 48%, ${c(2)} 62%, ${c(2)} 100%)`;
  scene.fog.color.lerp(NIGHT[2], n);
  hemi.color.lerp(new THREE.Color(0x8193d6), n);
  hemi.groundColor.lerp(new THREE.Color(0x25324d), n);
  hemi.intensity = lerp(hemi.intensity, 0.75, n);
  sun.color.lerp(new THREE.Color(0xb3c4ff), n);
  sun.intensity = lerp(sun.intensity, 0.85, n);
}

// ---------- island extension (pulau meluas) ----------
const EXT = V(-10.0, 0, 0.6);
const ext = new THREE.Group(); scene.add(ext);
ext.add(mesh(jitter(new THREE.CylinderGeometry(5.6, 6.6, 1.8, 18, 1), 0.5, true), mat(0xf2d79b), 0, SAND - 0.9, 0));
ext.add(mesh(jitter(new THREE.CylinderGeometry(3.3, 3.8, 0.5, 12, 1), 0.4, true), mat(0x7cc95a), -1.6, GRASS - 0.25, -1.9));
ext.add(palm(-3.0, GRASS, -2.4, 3.3, 0.3, 1.1));
ext.add(palm(-0.9, GRASS, -3.6, 2.8, 0.25, 3.0));
ext.add(palm(-4.7, SAND, 1.2, 2.7, 0.4, 2.2));
for (const [x, z, s] of [[-4.2, 3.4, 0.42], [-3.6, 4.0, 0.25], [2.8, -4.4, 0.4]]) {
  const r = mesh(new THREE.DodecahedronGeometry(s, 0), mat(0x9aa3a8), x, SAND + s * 0.3, z);
  r.rotation.set(R() * 3, R() * 3, R() * 3); ext.add(r);
}
for (let i = 0; i < 22; i++) {
  const a = R() * Math.PI * 2, d = R() * 3.0;
  ext.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 3), mat(0x4f9d3a), -1.6 + Math.cos(a) * d, GRASS + 0.12, -1.9 + Math.sin(a) * d, false));
}
ext.position.copy(EXT);
const foam2 = foam.clone(); scene.add(foam2);

// ---------- Madura Mart ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const WG = new THREE.Group(); scene.add(WG);
WG.position.set(EXT.x + 1.7, SAND, EXT.z + 2.1);
WG.rotation.y = 0.38;
const parts = [];
function part(obj, k0, k1, mode = 'pop') { WG.add(obj); parts.push({ obj, k0, k1, mode, s: obj.scale.clone() }); return obj; }
const white = mat(0xf3efe6), woodM = mat(0xa3713f), greenM = mat(0x1f9a5c);
part(mesh(new THREE.BoxGeometry(3.6, 0.38, 2.6), mat(0xd8d2c4), 0, 0.19, 0), 0.0, 0.1, 'grow');
part(mesh(new THREE.BoxGeometry(3.6, 2.3, 0.16), white, 0, 1.5, -1.22), 0.1, 0.26, 'grow');
part(mesh(new THREE.BoxGeometry(0.16, 2.3, 2.5), white, -1.72, 1.5, 0), 0.16, 0.32, 'grow');
part(mesh(new THREE.BoxGeometry(0.16, 2.3, 2.5), white, 1.72, 1.5, 0), 0.2, 0.36, 'grow');
part(mesh(new THREE.BoxGeometry(3.62, 0.32, 0.18), greenM, 0, 0.55, -1.21), 0.26, 0.32);
for (const [i, y] of [[0, 1.05], [1, 1.55], [2, 2.05]]) {
  part(mesh(new THREE.BoxGeometry(3.2, 0.07, 0.48), woodM, 0, y, -0.95), 0.36 + i * 0.04, 0.44 + i * 0.04);
}
const GOODS = [0xe63946, 0xffb703, 0x2a9d8f, 0x219ebc, 0xf4a261, 0x8ecae6, 0xd62828, 0x06d6a0, 0xffd166, 0x9b5de5];
{
  const r = rnd(42);
  for (const y of [1.05, 1.55, 2.05]) for (let x = -1.45; x < 1.5; x += 0.24 + r() * 0.08) {
    const h = 0.18 + r() * 0.2, w = 0.14 + r() * 0.06;
    const g = mesh(new THREE.BoxGeometry(w, h, 0.22), mat(GOODS[Math.floor(r() * GOODS.length)]), x, y + 0.035 + h / 2, -0.95, false);
    part(g, 0.86 + r() * 0.08, 0.98);
  }
}
const roof = part(mesh(new THREE.BoxGeometry(4.3, 0.12, 3.4), mat(0x3d9b63), 0, 2.78, 0.25), 0.5, 0.62);
roof.rotation.x = 0.1;
part(mesh(new THREE.BoxGeometry(2.7, 0.55, 0.52), greenM, 0, 0.66, 0.95), 0.62, 0.7);
part(mesh(new THREE.BoxGeometry(2.7, 0.42, 0.52), new THREE.MeshStandardMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.45, roughness: 0.1 }), 0, 1.15, 0.95, false), 0.66, 0.74);
part(mesh(new THREE.BoxGeometry(2.72, 0.05, 0.54), white, 0, 1.38, 0.95), 0.68, 0.76);
for (let i = 0; i < 6; i++) part(mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), mat(GOODS[i + 2]), -1.0 + i * 0.4, 1.05, 0.95, false), 0.9, 1);
// signboard
const signTexMM = canvasTex(1024, 200, (x, w, h) => {
  x.fillStyle = '#13844a'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#ffffff'; x.lineWidth = 12; x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = '#ffffff'; x.font = '700 104px Poppins'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('MADURA MART', w / 2 - 70, h / 2 + 6);
  x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(w - 120, h / 2, 64, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#13844a'; x.font = '700 50px Poppins'; x.fillText('24', w - 120, h / 2 - 12);
  x.font = '700 26px Poppins'; x.fillText('JAM', w - 120, h / 2 + 30);
});
const mmFace = new THREE.MeshStandardMaterial({ map: signTexMM, roughness: 0.8, emissive: 0xffffff, emissiveMap: signTexMM, emissiveIntensity: 0 });
const mmSign = part(mesh(new THREE.BoxGeometry(3.5, 0.7, 0.1), [greenM, greenM, greenM, greenM, mmFace, greenM], 0, 3.2, 1.85), 0.74, 0.84);
part(mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), woodM, -1.4, 2.85, 1.82), 0.74, 0.8);
part(mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), woodM, 1.4, 2.85, 1.82), 0.74, 0.8);
// plaque
const plaqueTex = canvasTex(640, 200, (x, w, h) => {
  x.fillStyle = '#fffaf0'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#c1121f'; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = '#c1121f'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '700 50px Poppins'; x.fillText('BUKA: 24 JAM', w / 2, 66);
  x.font = '700 50px Poppins'; x.fillText('TUTUP: HARI KIAMAT', w / 2, 140);
});
const plaque = part(mesh(new THREE.BoxGeometry(1.5, 0.47, 0.04), [white, white, white, white, new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.8 }), white], 1.83, 1.75, 0.35), 0.84, 0.9);
plaque.rotation.y = Math.PI / 2;
// LPG melon + bench
for (const dx of [1.25, 1.5]) part(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8), mat(0x6ab04c), dx, 0.53, 1.05), 0.92, 1);
part(mesh(new THREE.BoxGeometry(1.8, 0.08, 0.42), woodM, -0.2, 0.44, 2.05), 0.92, 1);
for (const dx of [-0.95, 0.55]) part(mesh(new THREE.BoxGeometry(0.08, 0.42, 0.36), woodM, dx, 0.21, 2.05), 0.92, 1);
// lamp
const bulbM = new THREE.MeshStandardMaterial({ color: 0xfff1c1, emissive: 0xffd27a, emissiveIntensity: 0 });
part(mesh(new THREE.SphereGeometry(0.1, 8, 6), bulbM, 0, 2.5, 1.25, false), 0.8, 0.86);
const lamp = new THREE.PointLight(0xffc56b, 0, 9, 1.6); lamp.position.set(0, 2.4, 1.4); WG.add(lamp);
const lampIn = new THREE.PointLight(0xfff0c8, 0, 5, 1.6); lampIn.position.set(0, 2.2, -0.3); WG.add(lampIn);

function buildWarung(k) {
  for (const p of parts) {
    const u = clamp((k - p.k0) / (p.k1 - p.k0));
    const s = p.mode === 'grow' ? ease(u) : pop(u);
    p.obj.visible = u > 0.001;
    if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s), p.s.z);
    else p.obj.scale.setScalar(Math.max(0.001, s));
  }
}
const wl = (x, y, z) => { WG.updateMatrixWorld(true); return WG.localToWorld(V(x, y, z)); };

// ---------- villagers ----------
const SKINS = [0xc98a5a, 0xb07446, 0xdba57a, 0x9c6238];
function makeVillager({ shirt, pants, skin, hat, hatColor }) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.13, 0.44, 0);
    hip.add(mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.36, 6), mat(pants), 0, -0.2, 0));
    hip.add(mesh(new THREE.BoxGeometry(0.16, 0.07, 0.25), mat(0x3b2a1e), 0, -0.4, 0.04));
    body.add(hip); legs.push(hip);
  }
  const torso = mesh(new THREE.SphereGeometry(0.34, 9, 7), mat(shirt), 0, 0.78, 0); torso.scale.set(1, 1.1, 0.88); body.add(torso);
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.32, 0.95, 0);
    sh.add(mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.4, 6), mat(skin), 0, -0.2, 0));
    sh.add(mesh(new THREE.SphereGeometry(0.08, 6, 5), mat(skin), 0, -0.42, 0));
    sh.rotation.z = sx * 0.18; body.add(sh); arms.push(sh);
  }
  const head = new THREE.Group(); head.position.set(0, 1.28, 0); body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.29, 12, 9), mat(skin), 0, 0, 0));
  for (const sx of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), mat(0x1c1410), sx * 0.1, 0.05, 0.26, false));
    head.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), mat(0xd9786a), sx * 0.17, -0.05, 0.21, false));
  }
  const mouth = mesh(new THREE.BoxGeometry(0.1, 0.025, 0.03), mat(0x5a2a1a), 0, -0.09, 0.27, false); head.add(mouth);
  if (hat === 'peci') head.add(mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.17, 12), mat(0x161616), 0, 0.22, 0));
  if (hat === 'cap') {
    const c = mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(hatColor), 0, 0.06, 0); head.add(c);
    head.add(mesh(new THREE.BoxGeometry(0.34, 0.04, 0.26), mat(hatColor), 0, 0.08, 0.3));
  }
  if (hat === 'hair') head.add(mesh(new THREE.SphereGeometry(0.305, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0x1c1410), 0, 0.03, -0.02));
  if (hat === 'hijab') {
    const hj = mesh(new THREE.SphereGeometry(0.335, 12, 9), mat(hatColor), 0, 0.02, -0.075); head.add(hj);
    const dr = mesh(new THREE.ConeGeometry(0.42, 0.45, 10), mat(hatColor), 0, -0.3, -0.04); head.add(dr);
  }
  root.scale.setScalar(0.92);
  return { root, body, legs, arms, head };
}
const VCFG = [
  { shirt: 0x3b82f6, pants: 0x374151, hat: 'cap', hatColor: 0xd23c32 },
  { shirt: 0xec4899, pants: 0x1f2937, hat: 'hijab', hatColor: 0x7c3aed },
  { shirt: 0xfacc15, pants: 0x2b4c8c, hat: 'hair' },
  { shirt: 0x10b981, pants: 0x4b5563, hat: 'peci' },
  { shirt: 0xf97316, pants: 0x1e3a8a, hat: 'hijab', hatColor: 0x0ea5e9 },
  { shirt: 0xf8fafc, pants: 0x6b7280, hat: 'hair' },
  { shirt: 0x8b5cf6, pants: 0x1f2937, hat: 'cap', hatColor: 0x111827 },
  { shirt: 0x0f766e, pants: 0x111827, hat: 'peci' },
];
const VIL = VCFG.map((c, i) => { const v = makeVillager({ ...c, skin: SKINS[i % 4] }); scene.add(v.root); return v; });
function vPose(v, { walk = 0, cheer = 0, hammer = 0, t = 0, ph = 0 }) {
  const s = Math.sin(walk);
  v.legs[0].rotation.x = s * 0.55; v.legs[1].rotation.x = -s * 0.55;
  v.body.position.y = walk ? Math.abs(Math.cos(walk)) * 0.05 : 0;
  v.arms[0].rotation.set(-s * 0.5, 0, -0.18); v.arms[1].rotation.set(s * 0.5, 0, 0.18);
  v.head.rotation.set(0, 0, 0);
  if (cheer) {
    const w = Math.sin(t * 10 + ph) * 0.25;
    v.arms[0].rotation.set(0, 0, -lerp(0.18, 2.7, cheer) + w);
    v.arms[1].rotation.set(0, 0, lerp(0.18, 2.7, cheer) - w);
    v.body.position.y = Math.abs(Math.sin(t * 7 + ph)) * 0.14 * cheer;
  }
  if (hammer) v.arms[1].rotation.set(-1.2 - Math.max(0, Math.sin(t * 14 + ph)) * 1.1, 0, 0.1);
}
const faceTo = (from, x, z) => Math.atan2(x - from.x, z - from.z);

// name tag sprites
function tagSprite(text, bg = '#ffffff', fg = '#14181f', W = 512) {
  const t = canvasTex(W, 96, (x, w, h) => {
    x.font = '700 44px Poppins'; const tw = x.measureText(text).width + 56;
    x.fillStyle = bg; x.beginPath(); x.roundRect((w - tw) / 2, 8, tw, h - 16, 40); x.fill();
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.4 * W / 512, 0.45, 1); s.renderOrder = 10; scene.add(s); return s;
}
const tagLando = tagSprite('@lando_094');
const tagTetii = tagSprite('usulan @tetii_efaridha', '#ffd23f', '#3a2300', 1024);

// ---------- obor (torch) near sign ----------
const torch = new THREE.Group(); scene.add(torch);
torch.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6), mat(0x6b4a2a), 0, 0.95, 0));
torch.add(mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.22, 6), mat(0x3a2a1a), 0, 1.95, 0));
const flameM = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1f, emissiveIntensity: 2.5 });
const flame = mesh(new THREE.ConeGeometry(0.11, 0.32, 6), flameM, 0, 2.2, 0, false); torch.add(flame);
const torchL = new THREE.PointLight(0xffa04a, 0, 8, 1.5); torchL.position.set(0, 2.3, 0.2); torch.add(torchL);
torch.position.set(-0.2, SAND, 5.4);

// ---------- sign counter ----------
const signCache = new Map();
function setSign(text) {
  if (!signCache.has(text)) signCache.set(text, signTex(text));
  signFace.map = signCache.get(text); signFace.needsUpdate = true;
}

// ---------- UI ----------
const SUBS2 = [
  [0.3, 2.2, 'Day 2.'],
  [2.3, 4.4, 'Pulaunya… nambah luas.'],
  [4.6, 7.4, 'Semalam, banyak yang minta jadi penduduk.'],
  [7.6, 10.6, 'Selamat datang, penduduk baru!'],
  [10.8, 13.8, 'Anggap saja rumah sendiri.'],
  [14.2, 16.4, 'Penduduk sekarang…'],
  [16.6, 18.8, 'dua puluh enam orang!'],
  [19.0, 20.9, 'Kepiting? Masih belum follow.'],
  [21.2, 23.0, 'Usulan paling rame…'],
  [23.1, 26.3, 'warung Madura. Buka 24 jam, tutup hari kiamat.'],
  [26.6, 28.8, 'Oke. Kita bangun.'],
  [29.0, 33.8, 'Biar penduduk nggak kelaparan tengah malam.'],
  [34.2, 37.3, 'Madura Mart… resmi buka!'],
  [37.7, 41.8, 'Jam dua pagi… masih buka.'],
  [42.2, 44.6, 'Besok bangun apa lagi?'],
  [44.7, 47.5, 'Follow biar jadi penduduk. Komen, mau dibangun apa.'],
];
const cmtEl = document.getElementById('cmt'), cav = document.getElementById('cav'), cname = document.getElementById('cname'), cago = document.getElementById('cago'), ctext = document.getElementById('ctext');
const CMTS = [
  { a: 4.8, b: 7.45, name: 'lando_094', ago: '17j', col: '#6b7280', text: 'Bang mau jadi warga plis' },
  { a: 21.4, b: 26.45, name: 'tetii_efaridha', ago: '16j', col: '#b5838d', text: 'Karena kita membutuhkan makanan pokok setiap harinya jadi day 1 bikin warung Madura yang buka 24 jam tutup hari kiamat 😂' },
];

// ---------- timeline ----------
const CUTS2 = [4.5, 7.5, 14, 21, 26.5, 34, 37.5, 42];
const GATHER = [[0.9, 4.9], [1.8, 4.2], [2.7, 5.0], [3.4, 3.9], [0.3, 3.6], [2.2, 3.2], [3.8, 2.8], [1.2, 2.6]];
const BOAT_DOCK = 15.4;

function renderAt2(t, rt = t) {
  updateOcean(rt);
  foam.scale.x = foam.scale.y = 1 + Math.sin(rt * 1.6) * 0.012;
  foam.position.y = 0.1 + Math.sin(rt * 1.6) * 0.03;
  foam2.scale.set(0.84 * (1 + Math.sin(rt * 1.6 + 1) * 0.012), 0.84 * (1 + Math.sin(rt * 1.6 + 1) * 0.012), 0.25);
  foam2.position.set(EXT.x, foam.position.y, EXT.z);

  let cam, focus = V(0, 0, 3), tod = 0, night = 0, az = 0.7;
  let cpos = V(-0.4, SAND, 5.6), crot = 0;
  const P = { t };
  let mmPop = 1, wk = 1, extK = 1, signText = 'PENDUDUK: 26';
  crab.visible = false; tagLando.visible = false; tagTetii.visible = false;
  pierPosts.forEach(p => { p.visible = true; p.scale.set(1, 1, 1); });
  pierPlanks.forEach(p => { p.visible = true; p.scale.setScalar(1); });
  boat.scale.setScalar(1.6); boat.rotation.set(0, Math.PI / 2, 0);
  const dockBoat = (x) => {
    boat.position.set(x, waveH(x, 1.0, rt) + 0.05, 1.0);
    boat.rotation.z = Math.sin(rt * 1.7) * 0.04; boat.rotation.x = Math.sin(rt * 1.3) * 0.03;
  };
  dockBoat(BOAT_DOCK);
  const onBoat = () => VIL.forEach((v, i) => {
    v.root.visible = true;
    const dx = -1.7 + (i >> 1) * 1.05, dz = (i % 2 ? 0.42 : -0.42);
    v.root.position.set(boat.position.x + dx, boat.position.y + 0.55, 1.0 + dz);
    v.root.rotation.y = -Math.PI / 2; vPose(v, { t, cheer: 0.35, ph: i });
  });
  const atGather = (cheer = 0, faceX = -1.4, faceZ = 5.0) => VIL.forEach((v, i) => {
    v.root.visible = true; v.root.position.set(GATHER[i][0], SAND, GATHER[i][1]);
    v.root.rotation.y = faceTo(v.root.position, faceX, faceZ); vPose(v, { t, cheer, ph: i * 1.3 });
  });
  const hideV = () => VIL.forEach(v => v.root.visible = false);
  clockEl.style.display = 'none';

  if (t < 4.5) { // S1 aerial: pulau meluas
    extK = ease(seg(t, 0.8, 3.4));
    wk = 0; signText = 'PENDUDUK: 1';
    cam = shot(t, 0, 4.5, V(10, 44, 52), V(6, 28, 34), V(-3.5, 0, 0.5), V(-3.5, 0, 1.5));
    focus = V(-4, 0, 1);
    dockBoat(60); hideV();
    cpos = V(-0.4, SAND, 5.6);
  } else if (t < 7.5) { // S2 boat full of people approaching
    wk = 0; signText = 'PENDUDUK: 1';
    const bx = lerp(40, BOAT_DOCK, easeOut(seg(t, 4.5, 7.5)));
    dockBoat(bx); onBoat();
    cpos = V(5.3, SAND, 3.4); crot = Math.PI / 2 - 0.3;
    if (t > 5.2) P.wave = ease(seg(t, 5.2, 5.6));
    cam = shot(t, 4.5, 7.5, V(4.6, 3.2, 12.0), V(5.2, 3.0, 11.2), V(13.0, 1.2, 0.6), V(13.6, 1.2, 0.6));
    focus = V(9, 0, 2);
  } else if (t < 14) { // S3 welcome walk along pier
    wk = 0; signText = 'PENDUDUK: 1';
    cpos = V(5.0, SAND, 2.7); crot = Math.PI / 2 - 0.2;
    P.wave = ease(seg(t, 7.6, 8.0));
    P.talk = 1;
    VIL.forEach((v, i) => {
      v.root.visible = true;
      const z0 = 1.0 + (i % 2 ? 0.35 : -0.35);
      const st = 7.7 + i * 0.42, sp = 3.0;
      const g = V(GATHER[i][0], SAND, GATHER[i][1]);
      const a = V(12.6, PIER.y + 0.04, z0), b = V(6.1, PIER.y + 0.04, z0), b2 = V(5.6, SAND, z0 + 0.6);
      const L1 = a.distanceTo(b), L2 = b2.distanceTo(g);
      let d = Math.max(0, (t - st) * sp), p, dir;
      if (d < L1) { p = vlerp(a, b, d / L1); dir = b.clone().sub(a); }
      else if (d < L1 + 0.6) { p = vlerp(b, b2, (d - L1) / 0.6); dir = b2.clone().sub(b); }
      else if (d < L1 + 0.6 + L2) { p = vlerp(b2, g, (d - L1 - 0.6) / L2); dir = g.clone().sub(b2); }
      else { p = g; dir = V(-1.4 - g.x, 0, 5 - g.z); }
      const moving = d > 0 && d < L1 + 0.6 + L2;
      if (t < st) { p = V(13.0 + (i >> 1) * 0.5, PIER.y + 0.04, z0); dir = V(-1, 0, 0); }
      v.root.position.copy(p); v.root.rotation.y = Math.atan2(dir.x, dir.z);
      vPose(v, { walk: moving ? (t - st) * 11 : 0, t, ph: i });
    });
    tagLando.visible = true;
    tagLando.position.copy(VIL[0].root.position).add(V(0, 2.05, 0));
    cam = shot(t, 7.5, 14, V(2.4, 4.4, 11.5), V(1.6, 3.8, 11.0), V(8.0, 0.9, 1.8), V(5.0, 0.9, 3.2));
    focus = V(7, 0, 2);
  } else if (t < 21) { // S4 sign counter 1 -> 26
    const ck = ease(seg(t, 14.6, 16.4));
    const n = Math.round(1 + 25 * ck);
    signText = t > 16.4 ? 'PENDUDUK: 26' : `PENDUDUK: ${n}`;
    wk = 0;
    atGather(t > 16.5 && t < 19 ? ease(seg(t, 16.5, 16.9)) : 0, -0.5, 12);
    cpos = V(-0.3, SAND, 5.7); crot = -0.35; P.talk = 1;
    if (t > 16.5 && t < 19) P.wave = ease(seg(t, 16.5, 16.9));
    tagLando.visible = t < 18.8;
    tagLando.position.copy(VIL[0].root.position).add(V(0, 2.05, 0));
    cam = shot(t, 14, 21, V(1.0, 3.3, 14.8), V(0.5, 3.1, 13.8), V(0.1, 1.5, 4.6), V(0.0, 1.5, 4.6));
    focus = V(0.5, 0, 5);
    board.scale.setScalar(t > 14.6 && t < 16.6 ? 1 + 0.05 * Math.abs(Math.sin(t * 40)) : (t >= 16.4 ? 1 + 0.18 * Math.sin(seg(t, 16.4, 16.9) * Math.PI) : 1));
    if (t > 19.0) {
      crab.visible = true;
      const k = seg(t, 19.0, 21.0);
      crab.position.set(lerp(4.0, -3.0, k), SAND + Math.abs(Math.sin(t * 22)) * 0.03, 7.0);
      crabLegs.forEach((l, i) => l.rotation.x = Math.sin(t * 26 + i) * 0.5);
    }
  } else if (t < 26.5) { // S5 usulan Madura
    wk = 0;
    cpos = V(-6.2, SAND, 5.0); crot = 0.35; P.talk = t > 22 ? 1 : 0;
    VIL.forEach((v, i) => {
      v.root.visible = i < 5;
      const p = [[-8.8, 5.6], [-9.6, 4.6], [-4.8, 3.8], [-7.6, 6.4], [-4.2, 5.0]][i] || [0, 0];
      v.root.position.set(p[0], SAND, p[1]); v.root.rotation.y = faceTo(v.root.position, -6.2, 5.0);
      vPose(v, { t });
    });
    cam = shot(t, 21, 26.5, V(-3.0, 3.6, 14.0), V(-3.6, 3.4, 13.0), V(-7.4, 1.3, 3.6), V(-7.6, 1.3, 3.6));
    focus = V(-7, 0, 3);
  } else if (t < 34) { // S6 time-lapse build
    wk = seg(t, 26.9, 33.6);
    tod = ease(seg(t, 31.5, 34)) * 0.55; az = lerp(-0.6, 2.2, seg(t, 26.5, 34));
    const front = wl(0.9, 0, 2.9);
    cpos = V(front.x, SAND, front.z); crot = faceTo(cpos, WG.position.x, WG.position.z);
    P.hammer = 1; P.tool = 'hammer'; P.t = t * 1.6;
    VIL.forEach((v, i) => {
      v.root.visible = i < 4;
      const p = [wl(-2.4, 0, 0.6), wl(2.5, 0, -0.4), wl(-1.2, 0, 2.6), wl(2.2, 0, 1.9)][i] || V();
      v.root.position.set(p.x, SAND, p.z); v.root.rotation.y = faceTo(v.root.position, WG.position.x, WG.position.z);
      vPose(v, { t: t * 1.6, hammer: 1, ph: i * 1.7 });
    });
    cam = shot(t, 26.5, 34, V(-2.4, 6.0, 13.4), V(-3.6, 5.0, 12.0), V(-8.0, 1.2, 2.8), V(-8.2, 1.4, 2.8));
    focus = V(-8, 0, 3);
    clockEl.style.display = 'block';
    const hr = 8 + wk * 10, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60);
    clockT.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    clockL.textContent = 'x24 TIME-LAPSE';
  } else if (t < 37.5) { // S7 reveal at sunset
    tod = 1; az = -0.15;
    const front = wl(0, 0, 3.3);
    cpos = V(front.x, SAND, front.z);
    crot = WG.rotation.y; P.wave = ease(seg(t, 34.3, 34.7));
    VIL.forEach((v, i) => {
      v.root.visible = true;
      const p = wl(-2.6 + (i % 4) * 1.15 + (i > 3 ? 0.55 : 0), 0, 3.0 + (i > 3 ? 1.2 : 0));
      if (i === 3) { p.copy(wl(-1.1, 0, 4.3)); }
      v.root.position.set(p.x, SAND, p.z); v.root.rotation.y = WG.rotation.y;
      vPose(v, { t, cheer: ease(seg(t, 34.3 + i * 0.05, 34.7 + i * 0.05)), ph: i * 1.3 });
    });
    if (VIL[1]) { const p = wl(2.6, 0, 3.4); VIL[1].root.position.set(p.x, SAND, p.z); }
    tagTetii.visible = t > 34.6;
    tagTetii.position.copy(wl(0, 3.95, 1.9));
    tagTetii.scale.set(4.4 * pop(seg(t, 34.6, 35.0)) + 0.001, 0.41 * pop(seg(t, 34.6, 35.0)) + 0.001, 1);
    cam = shot(t, 34, 37.5, V(-3.0, 3.6, 16.0), V(-3.6, 3.5, 15.0), V(-8.0, 2.2, 3.0), V(-8.1, 2.2, 3.0));
    focus = V(-8, 0, 3);
    mmPop = 1 + 0.2 * Math.sin(seg(t, 34.2, 34.8) * Math.PI);
  } else if (t < 42) { // S8 night, still open
    tod = 1; night = 1; az = -0.15;
    const bench = wl(-0.3, 0, 2.05);
    cpos = V(bench.x, SAND + 0.42, bench.z); crot = WG.rotation.y; P.sit = 1;
    P.sit = 1; P.tool = 'none';
    hideV();
    const pj = VIL[7], pjp = wl(0, 0.38, -0.45);
    pj.root.visible = true; pj.root.position.copy(pjp); pj.root.rotation.y = WG.rotation.y; vPose(pj, { t });
    pj.head.rotation.x = 0.05 * Math.sin(t * 2);
    const by = VIL[2], byp = wl(0.7, 0, 1.55);
    by.root.visible = true; by.root.position.set(byp.x, SAND, byp.z); by.root.rotation.y = WG.rotation.y + Math.PI;
    vPose(by, { t }); by.arms[1].rotation.set(-1.3 + Math.sin(t * 3) * 0.1, 0, 0.1);
    const b2 = VIL[0], b2p = wl(-1.6, 0, 1.8);
    b2.root.visible = true; b2.root.position.set(b2p.x, SAND, b2p.z); b2.root.rotation.y = WG.rotation.y + Math.PI * 0.8; vPose(b2, { t });
    cam = shot(t, 37.5, 42, V(-3.6, 2.8, 13.0), V(-4.2, 2.7, 12.2), V(-8.2, 1.9, 2.9), V(-8.3, 1.9, 2.9));
    focus = V(-8, 0, 3);
    clockEl.style.display = 'block';
    clockT.textContent = t < 39.8 ? '02:17' : '02:18';
    clockL.textContent = 'x1 REAL TIME · MASIH BUKA';
  } else { // S9 CTA at sign, night
    tod = 1; night = 1; az = -0.15;
    signText = t > 43.0 ? 'PENDUDUK: 26 → ?' : 'PENDUDUK: 26';
    board.scale.setScalar(t > 43 ? 1 + 0.15 * Math.sin(seg(t, 43, 43.5) * Math.PI) : 1);
    cpos = V(-0.4, SAND, 5.6); crot = -0.15; P.talk = 1;
    if (t > 44.8) P.wave = ease(seg(t, 44.8, 45.2));
    atGather(0, -0.5, 12);
    VIL.forEach((v, i) => v.root.visible = i < 4 || i === 6);
    cam = shot(t, 42, 47.5, V(0.8, 2.4, 12.4), V(0.2, 2.3, 11.2), V(-0.8, 1.95, 5.0), V(-0.9, 1.95, 5.0));
    focus = V(-0.8, 0, 5);
  }

  torch.visible = night > 0 && t >= 42;
  torchL.intensity = torch.visible ? 7 + Math.sin(rt * 17) * 0.8 : 0;
  flame.scale.set(1, 1 + Math.sin(rt * 21) * 0.12, 1);
  // extension rise
  ext.position.y = lerp(-2.6, 0, extK);
  ext.visible = extK > 0.01;
  foam2.visible = extK > 0.9;
  // warung
  buildWarung(wk);
  WG.visible = wk > 0.001;
  const lit = Math.max(night, t > 34.5 ? 0.35 : 0);
  bulbM.emissiveIntensity = wk > 0.85 ? lerp(0.2, 2.2, lit) : 0;
  lamp.intensity = WG.visible ? 9 * lit : 0; lampIn.intensity = WG.visible ? 5 * lit : 0;
  mmFace.emissiveIntensity = 0.55 * night;
  if (wk >= 1) mmSign.scale.setScalar(mmPop);

  // character
  ch.root.position.copy(cpos); ch.root.rotation.y = crot;
  pose(ch, P);
  sign.position.y = SAND;
  setSign(signText);

  setSky(tod, night, az);
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 35);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);

  // UI
  const s = SUBS2.find(([a, b]) => t >= a && t < b);
  subEl.textContent = s ? s[2] : '';
  if (s) { const k = seg(t, s[0], s[0] + 0.18); subEl.style.opacity = k; subEl.style.transform = `scale(${lerp(0.85, 1, pop(k))})`; }
  const c = CMTS.find(c => t >= c.a && t < c.b);
  if (c) {
    cname.textContent = c.name; cago.textContent = c.ago; ctext.textContent = c.text;
    cav.textContent = c.name[0].toUpperCase(); cav.style.background = c.col;
    const k = pop(seg(t, c.a, c.a + 0.35)), o = 1 - seg(t, c.b - 0.25, c.b);
    cmtEl.style.opacity = Math.min(1, k * 1.5) * o; cmtEl.style.transform = `scale(${Math.max(0.01, k)})`;
  } else cmtEl.style.opacity = 0;
  const rulesOn = t >= 44.7;
  const rs = (t0) => pop(seg(t, t0, t0 + 0.35));
  [[r1, 44.8], [r2, 45.05], [r3, 45.3]].forEach(([el, t0]) => {
    const k = rs(t0); el.style.opacity = rulesOn ? Math.min(1, k * 1.5) : 0; el.style.transform = `scale(${Math.max(0.01, k)})`;
  });
  const dc = Math.min(...CUTS2.map(c => t >= c ? t - c : 99));
  flash.style.opacity = dc < 0.12 ? (1 - dc / 0.12) * 0.35 : 0;

  renderer.render(scene, camera);
}

const subEl = document.getElementById('sub');
const r1 = document.getElementById('r1'), r2 = document.getElementById('r2'), r3 = document.getElementById('r3');
const clockEl = document.getElementById('clock'), clockT = document.getElementById('clockT'), clockL = document.getElementById('clockL');
const flash = document.getElementById('flash');
function shot(t, a, b, p0, p1, l0, l1, e = ease) {
  const k = e(seg(t, a, b)); return { pos: vlerp(p0, p1, k), look: vlerp(l0, l1, k) };
}

window.DURATION = D2DUR;
window.renderAt = renderAt2;
document.fonts.load('700 40px Poppins').then(() => { renderAt2(0); window.READY = true; });

// ================= PENDUDUK PEKERJA =================
const WM = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, ...o });
const wadd = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
function wtex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function vest(v, color, front = 0x000000) {
  const torso = v.body.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry');
  const ve = wadd(v.body, new THREE.SphereGeometry(0.355, 10, 8, Math.PI * 0.62, Math.PI * 1.76), WM(color), 0, 0.78, 0);
  ve.scale.set(1, 1.1, 0.9); ve.rotation.y = 0;
  return torso;
}
const WORKERS = {
  nelayan: () => {
    const v = makeVillager({ shirt: 0x1e3a5f, pants: 0x4b5563, skin: 0xa86b3c, hat: 'none' });
    wadd(v.head, new THREE.CylinderGeometry(0.24, 0.27, 0.16, 12), WM(0x6b7a3a), 0, 0.24, 0);
    wadd(v.head, new THREE.CylinderGeometry(0.42, 0.42, 0.03, 14), WM(0x5c6a30), 0, 0.17, 0);
    vest(v, 0xff7a1a);
    const fish = new THREE.Group(); v.arms[1].add(fish); fish.position.set(0.02, -0.55, 0.12);
    const fb = wadd(fish, new THREE.SphereGeometry(0.13, 10, 7), WM(0x7fb3d5, { roughness: 0.35, metalness: 0.2 }), 0, 0, 0); fb.scale.set(0.55, 1.7, 0.9);
    const ft = wadd(fish, new THREE.ConeGeometry(0.1, 0.16, 4), WM(0x5d9cc9), 0, -0.27, 0); ft.rotation.x = Math.PI;
    wadd(fish, new THREE.SphereGeometry(0.02, 5, 4), WM(0x111111), 0.055, 0.12, 0.06);
    return { v, pose: 'hold' };
  },
  madura: () => {
    const v = makeVillager({ shirt: 0xf8fafc, pants: 0x1f2937, skin: 0xc98a5a, hat: 'cap', hatColor: 0x13844a });
    vest(v, 0x13844a);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09), new THREE.MeshStandardMaterial({ map: wtex(200, 90, (x, w, h) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#13844a'; x.fillRect(0, 0, w, 26);
      x.fillStyle = '#ffffff'; x.font = '700 20px Poppins'; x.textAlign = 'center'; x.fillText('MADURA MART', w / 2, 20);
      x.fillStyle = '#13844a'; x.font = '700 34px Poppins'; x.fillText('24 JAM', w / 2, 70);
    }) }));
    tag.position.set(-0.14, 0.92, 0.315); tag.rotation.y = -0.35; v.body.add(tag);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.26), new THREE.MeshStandardMaterial({ flatShading: true, map: wtex(128, 96, (x, w, h) => {
      x.fillStyle = '#c69c6d'; x.fillRect(0, 0, w, h); x.fillStyle = '#8a6a44'; x.fillRect(0, h / 2 - 4, w, 8);
      x.fillStyle = '#5a3f22'; x.font = '700 22px Poppins'; x.textAlign = 'center'; x.fillText('MIE', w / 2, 34);
    }) }));
    v.arms[1].add(box); box.position.set(-0.05, -0.6, 0.16);
    return { v, pose: 'hold' };
  },
  pancing: () => {
    const v = makeVillager({ shirt: 0x9a3412, pants: 0x3f3f46, skin: 0xb07446, hat: 'cap', hatColor: 0x1e3a8a });
    vest(v, 0x6b5b3e);
    for (const [x, y] of [[-0.18, 0.72], [0.18, 0.72], [-0.2, 0.92], [0.2, 0.92]]) wadd(v.body, new THREE.BoxGeometry(0.11, 0.1, 0.04), WM(0x55482f), x, y, 0.29);
    const rod = new THREE.Group(); v.arms[1].add(rod); rod.position.set(0, -0.45, 0.05); rod.rotation.x = 1.25;
    wadd(rod, new THREE.CylinderGeometry(0.016, 0.024, 1.4, 5), WM(0x2b2b2b), 0, 0.7, 0);
    wadd(rod, new THREE.CylinderGeometry(0.045, 0.045, 0.06, 8), WM(0xc0c6cc, { metalness: 0.7 }), 0.05, 0.25, 0).rotation.z = Math.PI / 2;
    const bucket = wadd(v.root, new THREE.CylinderGeometry(0.17, 0.13, 0.28, 10), WM(0x2563eb, { roughness: 0.5 }), -0.55, 0.14, 0.15);
    wadd(v.root, new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10), WM(0x7fd3e6, { roughness: 0.2 }), -0.55, 0.26, 0.15);
    return { v, pose: 'rod' };
  },
  pemandu: () => {
    const v = makeVillager({ shirt: 0x0ea5e9, pants: 0x1f2937, skin: 0xdba57a, hat: 'hijab', hatColor: 0xf59e0b });
    const lan = wadd(v.body, new THREE.TorusGeometry(0.18, 0.012, 4, 18), WM(0xf59e0b), 0, 1.04, 0.12); lan.rotation.x = Math.PI / 2 + 0.6;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.18), new THREE.MeshStandardMaterial({ map: wtex(140, 180, (x, w, h) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#f59e0b'; x.fillRect(0, 0, w, 50);
      x.fillStyle = '#ffffff'; x.font = '700 30px Poppins'; x.textAlign = 'center'; x.fillText('GUIDE', w / 2, 36);
      x.fillStyle = '#0d2b4e'; x.font = '700 22px Poppins'; x.fillText('PULAU', w / 2, 100); x.fillText('WISATA', w / 2, 130);
    }) }));
    card.position.set(0, 0.86, 0.32); v.body.add(card);
    const fl = new THREE.Group(); v.body.add(fl); fl.position.set(0.68, 0, 0.05);
    wadd(fl, new THREE.CylinderGeometry(0.015, 0.015, 1.7, 6), WM(0x8a5a33), 0, 1.15, 0);
    const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(0.42, 0.13); tri.lineTo(0, 0.26); tri.closePath();
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: 0xf59e0b, side: THREE.DoubleSide }));
    flag.position.set(0, 1.72, 0); fl.add(flag);
    return { v, pose: 'flag' };
  },
  mercusuar: () => {
    const v = makeVillager({ shirt: 0x1e3a8a, pants: 0x374151, skin: 0x9c6238, hat: 'none' });
    const beanie = wadd(v.head, new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.1), WM(0xb91c1c), 0, 0.06, 0);
    wadd(v.head, new THREE.CylinderGeometry(0.305, 0.305, 0.08, 12), WM(0x991b1b), 0, 0.08, 0);
    wadd(v.head, new THREE.SphereGeometry(0.07, 6, 5), WM(0xffffff), 0, 0.37, 0);
    const torso = v.body.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry');
    torso.material = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95, map: wtex(64, 128, (x, w, h) => {
      x.fillStyle = '#1e3a8a'; x.fillRect(0, 0, w, h); x.fillStyle = '#e5e7eb'; x.fillRect(0, 40, w, 10); x.fillRect(0, 60, w, 4);
    }) });
    const lan = new THREE.Group(); v.arms[1].add(lan); lan.position.set(0, -0.62, 0.1);
    wadd(lan, new THREE.CylinderGeometry(0.1, 0.11, 0.05, 8), WM(0x2b2b2b), 0, -0.12, 0);
    wadd(lan, new THREE.CylinderGeometry(0.085, 0.085, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xfff1b5, emissive: 0xffc94a, emissiveIntensity: 1.6 }), 0, 0, 0);
    wadd(lan, new THREE.ConeGeometry(0.11, 0.1, 8), WM(0x2b2b2b), 0, 0.15, 0);
    wadd(lan, new THREE.TorusGeometry(0.05, 0.01, 4, 12), WM(0x2b2b2b), 0, 0.23, 0);
    return { v, pose: 'hold' };
  },
  petani: () => {
    const v = makeVillager({ shirt: 0xfef3c7, pants: 0x065f46, skin: 0xb07446, hat: 'peci' });
    const tw = wadd(v.body, new THREE.TorusGeometry(0.2, 0.05, 6, 16), WM(0xffffff), 0, 1.07, 0.02); tw.rotation.x = Math.PI / 2;
    const co = new THREE.Group(); v.arms[1].add(co); co.position.set(0, -0.62, 0.1);
    wadd(co, new THREE.DodecahedronGeometry(0.16, 0), WM(0x6b4a2a), 0, 0, 0);
    const coT = wadd(co, new THREE.CylinderGeometry(0.1, 0.13, 0.06, 8), WM(0xf5f5dc), 0, 0.13, 0);
    wadd(co, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), WM(0xe63946), 0.03, 0.24, 0).rotation.z = -0.3;
    const sk = new THREE.Group(); v.body.add(sk); sk.position.set(-0.34, 0.75, -0.2); sk.rotation.z = 0.25;
    wadd(sk, new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), WM(0x7a5230), 0, -0.2, 0);
    const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.quadraticCurveTo(0.12, 0.05, 0.08, -0.22); blade.lineTo(0, -0.05); blade.closePath();
    const bm = new THREE.Mesh(new THREE.ShapeGeometry(blade), new THREE.MeshStandardMaterial({ color: 0xc0c6cc, metalness: 0.7, side: THREE.DoubleSide }));
    bm.position.set(0, -0.6, 0); sk.add(bm);
    return { v, pose: 'hold' };
  },
};
let curW = null;
window.renderWorker = (name, p, l, fov = 31) => {
  renderAt(10.5);
  if (curW) scene.remove(curW.root);
  const { v, pose: ps } = WORKERS[name]();
  curW = v; scene.add(v.root);
  v.root.position.set(0, SAND, 6.6); v.root.rotation.y = 0.25; v.root.scale.setScalar(1.0);
  vPose(v, { t: 1 });
  if (ps === 'hold') v.arms[1].rotation.set(-0.95, 0, 0.25);
  if (ps === 'rod') v.arms[1].rotation.set(-0.7, 0, 0.2);
  if (ps === 'flag') v.arms[1].rotation.set(0, 0, 1.15);
  const keep = new Set([v.root, hemi, sun, sun.target]);
  const vis = scene.children.map(o => o.visible);
  scene.children.forEach(o => { if (!keep.has(o)) o.visible = false; });
  const fog = scene.fog; scene.fog = null;
  stars.style.opacity = 0;
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.set(...p); camera.lookAt(...l);
  sun.position.set(p[0] + 8, 12, p[2] + 6); sun.target.position.set(...l);
  renderer.render(scene, camera);
  scene.children.forEach((o, i) => o.visible = vis[i]); scene.fog = fog;
};

// ================= PEDAGANG =================
function apron(v, color, text, fg = '#ffffff', icon = null) {
  const t = wtex(512, 256, (x, w, h) => {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 6; x.strokeRect(150, 20, 212, h - 40);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 54; x.font = `700 ${fs}px Poppins`;
    while (x.measureText(text).width > 196 && fs > 22) { fs -= 2; x.font = `700 ${fs}px Poppins`; }
    x.fillText(text, w / 2, icon ? 150 : h / 2);
    if (icon) icon(x, w / 2, 78);
  });
  const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.4, 0.74, 18, 1, true, -1.0, 2.0),
    new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }));
  ap.position.set(0, 0.6, 0.0); ap.scale.set(1, 1, 0.92); v.body.add(ap);
  const strap = wadd(v.body, new THREE.TorusGeometry(0.16, 0.018, 4, 16, Math.PI), WM(color), 0, 1.0, 0.18);
  strap.rotation.set(-0.5, 0, 0);
  return ap;
}
const VENDORS = {
  buah: () => {
    const v = makeVillager({ shirt: 0x22c55e, pants: 0x374151, skin: 0xc98a5a, hat: 'hair' });
    wadd(v.head, new THREE.CylinderGeometry(0.31, 0.31, 0.05, 14), WM(0xf97316), 0, 0.12, 0);
    apron(v, '#f97316', 'BUAH SEGAR', '#ffffff', (x, cx, cy) => {
      x.fillStyle = '#e63946'; x.beginPath(); x.arc(cx - 30, cy, 26, 0, 7); x.fill();
      x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(cx + 26, cy + 4, 24, 0, 7); x.fill();
      x.fillStyle = '#2d6a4f'; x.fillRect(cx - 32, cy - 36, 6, 14);
    });
    const bk = new THREE.Group(); v.arms[1].add(bk); bk.position.set(-0.05, -0.62, 0.18);
    wadd(bk, new THREE.CylinderGeometry(0.24, 0.18, 0.18, 12), WM(0xb08150), 0, 0, 0);
    const fr = [[0xff8c1a, 0.08], [0xe63946, 0.075], [0xff8c1a, 0.08], [0x7cc95a, 0.07], [0xe63946, 0.07]];
    fr.forEach(([c, r], i) => wadd(bk, new THREE.SphereGeometry(r, 8, 6), WM(c, { roughness: 0.5 }), Math.cos(i * 1.3) * 0.12, 0.12, Math.sin(i * 1.3) * 0.1));
    const ban = wadd(bk, new THREE.TorusGeometry(0.13, 0.035, 5, 10, Math.PI * 0.8), WM(0xffd23f), 0, 0.2, 0); ban.rotation.set(0.3, 0, 0.9);
    return { v, pose: 'hold' };
  },
  seblak: () => {
    const v = makeVillager({ shirt: 0xfde68a, pants: 0x1f2937, skin: 0xdba57a, hat: 'hijab', hatColor: 0xdc2626 });
    apron(v, '#dc2626', 'SEBLAK', '#ffffff', (x, cx, cy) => {
      x.fillStyle = '#ffd23f';
      for (let i = 0; i < 3; i++) { x.save(); x.translate(cx - 44 + i * 44, cy); x.rotate(0.5); x.beginPath(); x.ellipse(0, 0, 9, 26, 0, 0, 7); x.fill(); x.restore(); }
    });
    const bowl = new THREE.Group(); v.arms[1].add(bowl); bowl.position.set(-0.04, -0.6, 0.18);
    wadd(bowl, new THREE.CylinderGeometry(0.2, 0.12, 0.14, 14), WM(0xf8fafc, { roughness: 0.4 }), 0, 0, 0);
    wadd(bowl, new THREE.CylinderGeometry(0.185, 0.185, 0.02, 14), WM(0xd62828, { roughness: 0.3 }), 0, 0.06, 0);
    for (let i = 0; i < 7; i++) {
      const k = wadd(bowl, new THREE.BoxGeometry(0.07, 0.02, 0.05), WM(i % 2 ? 0xffd166 : 0xf4a261), Math.cos(i) * 0.1, 0.08, Math.sin(i * 1.7) * 0.08);
      k.rotation.set(Math.random() * 0.6, i, Math.random() * 0.6);
    }
    wadd(bowl, new THREE.SphereGeometry(0.035, 6, 5), WM(0xffffff), 0.05, 0.085, -0.04);
    const ch = wadd(bowl, new THREE.ConeGeometry(0.025, 0.12, 5), WM(0xff2d2d), -0.08, 0.09, 0.05); ch.rotation.z = 1.3;
    return { v, pose: 'hold' };
  },
  batagor: () => {
    const v = makeVillager({ shirt: 0xf8fafc, pants: 0x1e3a8a, skin: 0xb07446, hat: 'cap', hatColor: 0x2563eb });
    apron(v, '#2563eb', 'BATAGOR', '#ffffff', (x, cx, cy) => {
      x.fillStyle = '#d4a373'; x.fillRect(cx - 50, cy - 16, 30, 30); x.fillRect(cx - 14, cy - 22, 30, 30); x.fillRect(cx + 22, cy - 14, 30, 30);
      x.fillStyle = '#7f4f24'; x.fillRect(cx - 54, cy + 14, 110, 10);
    });
    const plate = new THREE.Group(); v.arms[1].add(plate); plate.position.set(-0.04, -0.6, 0.2);
    wadd(plate, new THREE.CylinderGeometry(0.24, 0.2, 0.03, 16), WM(0xffffff, { roughness: 0.4 }), 0, 0, 0);
    for (let i = 0; i < 6; i++) wadd(plate, new THREE.BoxGeometry(0.09, 0.07, 0.09), WM(0xd4a373), Math.cos(i) * 0.12, 0.05, Math.sin(i) * 0.1).rotation.y = i;
    for (let i = 0; i < 4; i++) wadd(plate, new THREE.SphereGeometry(0.05, 6, 4), WM(0x7f4f24, { roughness: 0.3 }), Math.cos(i * 1.6) * 0.08, 0.09, Math.sin(i * 1.6) * 0.06);
    const sp = new THREE.Group(); v.arms[0].add(sp); sp.position.set(0, -0.48, 0.08); sp.rotation.x = 0.4;
    wadd(sp, new THREE.CylinderGeometry(0.015, 0.015, 0.4, 5), WM(0x7a5230), 0, -0.1, 0);
    wadd(sp, new THREE.BoxGeometry(0.12, 0.01, 0.14), WM(0xc0c6cc, { metalness: 0.7, roughness: 0.3 }), 0, -0.32, 0.03);
    return { v, pose: 'hold' };
  },
  bakso: () => {
    const v = makeVillager({ shirt: 0x9ca3af, pants: 0x1f2937, skin: 0xa86b3c, hat: 'hair' });
    const tw = wadd(v.body, new THREE.TorusGeometry(0.2, 0.05, 6, 16), WM(0xffffff), 0, 1.07, 0.02); tw.rotation.x = Math.PI / 2;
    apron(v, '#7c2d12', 'BAKSO', '#ffd23f');
    const cart = new THREE.Group(); v.root.add(cart); cart.position.set(-0.95, 0, 0.1); cart.rotation.y = 0.35;
    wadd(cart, new THREE.BoxGeometry(0.85, 0.5, 0.5), WM(0x2563eb), 0, 0.55, 0);
    const glass = wadd(cart, new THREE.BoxGeometry(0.8, 0.38, 0.48), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.45, roughness: 0.1 }), 0, 0.99, 0);
    wadd(cart, new THREE.BoxGeometry(0.88, 0.05, 0.54), WM(0xf8fafc), 0, 1.2, 0);
    wadd(cart, new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10), WM(0xc0c6cc, { metalness: 0.7, roughness: 0.3 }), -0.18, 0.95, 0);
    for (let i = 0; i < 5; i++) wadd(cart, new THREE.SphereGeometry(0.045, 6, 5), WM(0xb08968), 0.12 + (i % 3) * 0.09, 0.84 + Math.floor(i / 3) * 0.08, 0.05);
    for (const dx of [-0.32, 0.32]) { const w = wadd(cart, new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12), WM(0x222222), dx, 0.15, 0.27); w.rotation.x = Math.PI / 2; }
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), new THREE.MeshStandardMaterial({ map: wtex(350, 100, (x, w, h) => {
      x.fillStyle = '#ffd23f'; x.fillRect(0, 0, w, h); x.fillStyle = '#7c2d12'; x.font = '700 58px Poppins'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BAKSO', w / 2, h / 2 + 4);
    }) }));
    lab.position.set(0, 0.56, 0.255); cart.add(lab);
    return { v, pose: 'cart' };
  },
  esteh: () => {
    const v = makeVillager({ shirt: 0xfacc15, pants: 0x374151, skin: 0xc98a5a, hat: 'cap', hatColor: 0x16a34a });
    apron(v, '#16a34a', 'ES TEH', '#ffffff', (x, cx, cy) => {
      x.fillStyle = '#c2410c'; x.fillRect(cx - 20, cy - 28, 40, 56); x.fillStyle = '#ffffff'; x.fillRect(cx + 6, cy - 46, 6, 30);
    });
    const cup = new THREE.Group(); v.arms[1].add(cup); cup.position.set(0, -0.6, 0.14);
    wadd(cup, new THREE.CylinderGeometry(0.09, 0.07, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1 }), 0, 0.05, 0);
    wadd(cup, new THREE.CylinderGeometry(0.083, 0.066, 0.24, 12), WM(0xc2410c, { roughness: 0.3 }), 0, 0.02, 0);
    for (let i = 0; i < 3; i++) wadd(cup, new THREE.BoxGeometry(0.05, 0.05, 0.05), WM(0xe0f2fe, { roughness: 0.1 }), Math.cos(i * 2) * 0.03, 0.13, Math.sin(i * 2) * 0.03);
    const straw = wadd(cup, new THREE.CylinderGeometry(0.01, 0.01, 0.4, 5), WM(0xef4444), 0.02, 0.25, 0); straw.rotation.z = -0.15;
    return { v, pose: 'hold' };
  },
  gorengan: () => {
    const v = makeVillager({ shirt: 0xf8fafc, pants: 0x4b5563, skin: 0x9c6238, hat: 'peci' });
    apron(v, '#ca8a04', 'GORENGAN', '#ffffff', (x, cx, cy) => {
      x.fillStyle = '#92400e'; x.beginPath(); x.ellipse(cx - 30, cy, 30, 18, 0.3, 0, 7); x.fill();
      x.fillStyle = '#b45309'; x.beginPath(); x.ellipse(cx + 28, cy + 4, 26, 16, -0.2, 0, 7); x.fill();
    });
    const tray = new THREE.Group(); v.arms[1].add(tray); tray.position.set(-0.04, -0.6, 0.2);
    wadd(tray, new THREE.BoxGeometry(0.46, 0.04, 0.34), WM(0xc0c6cc, { metalness: 0.6, roughness: 0.35 }), 0, 0, 0);
    const cols = [0xc2410c, 0xb45309, 0xd97706, 0x92400e];
    for (let i = 0; i < 8; i++) {
      const g = wadd(tray, new THREE.DodecahedronGeometry(0.06, 0), WM(cols[i % 4]), -0.16 + (i % 4) * 0.105, 0.06, -0.07 + Math.floor(i / 4) * 0.14);
      g.scale.set(1.3, 0.6, 1);
    }
    for (let i = 0; i < 3; i++) { const c = wadd(tray, new THREE.ConeGeometry(0.018, 0.08, 4), WM(0x16a34a), 0.18, 0.08, -0.1 + i * 0.05); c.rotation.z = 1.4; }
    return { v, pose: 'hold' };
  },
};
window.renderVendor = (name, p, l, fov = 31) => {
  renderAt(10.5);
  if (curW) scene.remove(curW.root);
  const { v, pose: ps } = VENDORS[name]();
  curW = v; scene.add(v.root);
  v.root.position.set(name === 'bakso' ? 0.35 : 0, SAND, 6.6); v.root.rotation.y = 0.25;
  vPose(v, { t: 1 });
  if (ps === 'hold') {
    v.arms[1].rotation.set(-0.95, 0, 0.25);
    v.arms[1].children.filter(c => c.isGroup).forEach(g => g.rotation.set(0.95 + 0.35, 0, -0.25));
  }
  if (ps === 'cart') { v.arms[0].rotation.set(-0.6, 0, -0.5); v.arms[1].rotation.set(0, 0, 2.5); }
  if (name === 'batagor') v.arms[0].rotation.set(-0.7, 0, -0.3);
  const keep = new Set([v.root, hemi, sun, sun.target]);
  const vis = scene.children.map(o => o.visible);
  scene.children.forEach(o => { if (!keep.has(o)) o.visible = false; });
  const fog = scene.fog; scene.fog = null;
  stars.style.opacity = 0;
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.set(...p); camera.lookAt(...l);
  sun.position.set(p[0] + 8, 12, p[2] + 6); sun.target.position.set(...l);
  renderer.render(scene, camera);
  scene.children.forEach((o, i) => o.visible = vis[i]); scene.fog = fog;
};

// ================= SERAGAM ABDI NEGARA & KEAMANAN =================
function loreng(cols, seed) {
  const t = wtex(256, 256, (x, w, h) => {
    x.fillStyle = cols[0]; x.fillRect(0, 0, w, h);
    const r = rnd(seed);
    for (let k = 1; k < cols.length; k++) for (let i = 0; i < 26; i++) {
      x.fillStyle = cols[k]; x.beginPath();
      const cx = r() * w, cy = r() * h, rx = 10 + r() * 26, ry = 6 + r() * 16;
      x.ellipse(cx, cy, rx, ry, r() * 3, 0, 7); x.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5);
  return new THREE.MeshStandardMaterial({ map: t, flatShading: true, roughness: 0.95 });
}
const torsoOf = v => v.body.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry');
function setPants(v, m) { v.legs.forEach(l => { l.children[0].material = m; }); }
function boots(v) {
  v.legs.forEach(l => {
    l.children[1].material = WM(0x111111, { roughness: 0.35 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 8), WM(0x111111, { roughness: 0.35 })); b.position.set(0, -0.33, 0); l.add(b);
  });
}
function belt(v, color = 0x111111, buckle = 0xc9a227) {
  const b = wadd(v.body, new THREE.TorusGeometry(0.275, 0.032, 5, 22), WM(color), 0, 0.53, 0); b.rotation.x = Math.PI / 2; b.scale.set(1, 0.9, 1);
  wadd(v.body, new THREE.BoxGeometry(0.08, 0.06, 0.03), WM(buckle, { metalness: 0.6, roughness: 0.3 }), 0, 0.53, 0.27);
}
function peakCap(v, crown, band, brim = 0x111111, badge = 0xc9a227) {
  wadd(v.head, new THREE.CylinderGeometry(0.29, 0.29, 0.13, 14), WM(band), 0, 0.21, 0);
  wadd(v.head, new THREE.CylinderGeometry(0.35, 0.3, 0.09, 14), WM(crown), 0, 0.31, 0.02);
  const b = wadd(v.head, new THREE.BoxGeometry(0.34, 0.03, 0.18), WM(brim, { roughness: 0.3 }), 0, 0.15, 0.3); b.rotation.x = 0.25;
  if (badge) wadd(v.head, new THREE.SphereGeometry(0.045, 6, 5), WM(badge, { metalness: 0.6, roughness: 0.3 }), 0, 0.25, 0.3);
}
function beret(v, color, badge = 0xc9a227) {
  const b = wadd(v.head, new THREE.SphereGeometry(0.31, 12, 8), WM(color, { roughness: 0.95 }), -0.05, 0.19, -0.01);
  b.scale.set(1.12, 0.38, 1.08); b.rotation.z = 0.28;
  wadd(v.head, new THREE.CylinderGeometry(0.3, 0.3, 0.05, 14), WM(color), 0, 0.12, 0);
  if (badge) wadd(v.head, new THREE.SphereGeometry(0.04, 6, 5), WM(badge, { metalness: 0.6, roughness: 0.3 }), 0.14, 0.18, 0.25);
}
function pocketFlaps(v, color) { for (const sx of [-1, 1]) wadd(v.body, new THREE.BoxGeometry(0.13, 0.05, 0.03), WM(color), sx * 0.15, 0.96, 0.3).rotation.y = sx * -0.35; }

const UNIFORMS = {
  satpam: () => {
    const v = makeVillager({ shirt: 0xe7d3a8, pants: 0xcbb489, skin: 0xb07446, hat: 'none' });
    peakCap(v, 0x1f2a44, 0x1f2a44);
    pocketFlaps(v, 0xd6bf8f); belt(v); boots(v);
    const ht = wadd(v.body, new THREE.BoxGeometry(0.08, 0.16, 0.05), WM(0x222222), -0.2, 0.95, 0.3); ht.rotation.y = 0.35;
    wadd(v.body, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), WM(0x222222), -0.2, 1.08, 0.3);
    const bat = wadd(v.body, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), WM(0x111111), 0.33, 0.38, 0.12); bat.rotation.z = 0.2;
    return { v, pose: 'salute' };
  },
  tniad: () => {
    const v = makeVillager({ shirt: 0x4b5b3a, pants: 0x4b5b3a, skin: 0xa86b3c, hat: 'none' });
    const lm = loreng(['#56653f', '#2f3a24', '#7d6b45', '#1d2316'], 11);
    torsoOf(v).material = lm; setPants(v, lm);
    v.arms.forEach(a => a.children[0].material = lm);
    beret(v, 0x2e5a2e);
    pocketFlaps(v, 0x3b4a2c); belt(v, 0x2b2b2b, 0x777777); boots(v);
    return { v, pose: 'salute' };
  },
  tniau: () => {
    const v = makeVillager({ shirt: 0x8fb8de, pants: 0x1e3a5f, skin: 0xc98a5a, hat: 'none' });
    peakCap(v, 0x1e3a5f, 0x1e3a5f, 0x111111, 0xc9a227);
    wadd(v.head, new THREE.BoxGeometry(0.3, 0.025, 0.02), WM(0xc9a227, { metalness: 0.5 }), 0, 0.18, 0.3);
    pocketFlaps(v, 0x7aa6d0); belt(v, 0x1e3a5f); boots(v);
    const wg = new THREE.Group(); v.body.add(wg); wg.position.set(-0.16, 1.03, 0.3); wg.rotation.y = -0.35;
    wadd(wg, new THREE.SphereGeometry(0.025, 6, 5), WM(0xc9a227, { metalness: 0.6 }), 0, 0, 0);
    for (const sx of [-1, 1]) { const w = wadd(wg, new THREE.BoxGeometry(0.09, 0.02, 0.01), WM(0xc9a227, { metalness: 0.6 }), sx * 0.055, 0.005, 0); w.rotation.z = sx * 0.2; }
    return { v, pose: 'salute' };
  },
  tnial: () => {
    const v = makeVillager({ shirt: 0xf8fafc, pants: 0xf8fafc, skin: 0x9c6238, hat: 'none' });
    const cap = wadd(v.head, new THREE.CylinderGeometry(0.3, 0.29, 0.16, 16), WM(0xffffff), 0, 0.22, 0);
    wadd(v.head, new THREE.CylinderGeometry(0.295, 0.295, 0.045, 16), WM(0x111111), 0, 0.17, 0);
    for (const sx of [-1, 1]) { const rb = wadd(v.head, new THREE.BoxGeometry(0.035, 0.18, 0.01), WM(0x111111), sx * 0.04, 0.08, -0.3); rb.rotation.z = sx * 0.15; }
    const col = wadd(v.body, new THREE.BoxGeometry(0.56, 0.34, 0.03), WM(0x1e3a8a), 0, 0.98, -0.27); col.rotation.x = 0.3;
    for (const sx of [-1, 1]) { const f = wadd(v.body, new THREE.BoxGeometry(0.1, 0.3, 0.02), WM(0x1e3a8a), sx * 0.11, 0.98, 0.28); f.rotation.set(-0.3, sx * -0.3, sx * 0.5); }
    for (const sx of [-1, 1]) { const s1 = wadd(v.body, new THREE.BoxGeometry(0.008, 0.26, 0.022), WM(0xffffff), sx * 0.135, 0.98, 0.295); s1.rotation.set(-0.3, sx * -0.3, sx * 0.5); }
    wadd(v.body, new THREE.BoxGeometry(0.1, 0.06, 0.03), WM(0x111111), 0, 0.86, 0.33);
    for (const sx of [-1, 1]) wadd(v.body, new THREE.BoxGeometry(0.04, 0.14, 0.015), WM(0x111111), sx * 0.03, 0.78, 0.33).rotation.z = sx * 0.2;
    belt(v, 0x111111, 0xc9a227);
    v.legs.forEach(l => l.children[1].material = WM(0x111111, { roughness: 0.3 }));
    return { v, pose: 'salute' };
  },
  polisi: () => {
    const v = makeVillager({ shirt: 0xb08a5a, pants: 0x5b3f26, skin: 0xc98a5a, hat: 'none' });
    peakCap(v, 0x8a6a42, 0x5b3f26, 0x111111, 0xc9a227);
    const vt = wadd(v.body, new THREE.SphereGeometry(0.36, 10, 8, Math.PI * 0.56, Math.PI * 1.88), WM(0xc6f82e, { roughness: 0.6 }), 0, 0.76, 0);
    vt.scale.set(1, 1.06, 0.9);
    for (const y of [0.66, 0.86]) { const r = wadd(v.body, new THREE.TorusGeometry(0.365, 0.02, 4, 24), WM(0xe5e7eb, { metalness: 0.6, roughness: 0.2 }), 0, y, 0); r.rotation.x = Math.PI / 2; r.scale.set(1, 0.9, 1); }
    belt(v); boots(v);
    const wh = wadd(v.body, new THREE.CylinderGeometry(0.025, 0.025, 0.08, 6), WM(0xc0c6cc, { metalness: 0.8 }), 0.14, 1.02, 0.3); wh.rotation.z = Math.PI / 2;
    const tb = new THREE.Group(); v.arms[1].add(tb); tb.position.set(0, -0.5, 0.05);
    wadd(tb, new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), WM(0x222222), 0, 0, 0);
    wadd(tb, new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), new THREE.MeshStandardMaterial({ color: 0xff5a36, emissive: 0xff3b1f, emissiveIntensity: 1.2 }), 0, -0.25, 0);
    return { v, pose: 'stop' };
  },
  banser: () => {
    const v = makeVillager({ shirt: 0x3a4a2a, pants: 0x3a4a2a, skin: 0xb07446, hat: 'none' });
    const lm = loreng(['#3c4f2b', '#16200f', '#5b6e3a', '#262626'], 23);
    torsoOf(v).material = lm; setPants(v, lm);
    v.arms.forEach(a => a.children[0].material = lm);
    beret(v, 0x111111, 0xc9a227);
    pocketFlaps(v, 0x2c3a1f); belt(v, 0x1a1a1a, 0xc0c6cc); boots(v);
    return { v, pose: 'stand' };
  },
};
window.renderUniform = (name, p, l, fov = 31) => {
  renderAt(10.5);
  if (curW) scene.remove(curW.root);
  const { v, pose: ps } = UNIFORMS[name]();
  curW = v; scene.add(v.root);
  v.root.position.set(0, SAND, 6.6); v.root.rotation.y = 0.2;
  vPose(v, { t: 1 });
  if (ps === 'salute') { const d = new THREE.Vector3(-0.28, 0.78, 0.56).normalize(); v.arms[1].quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d); }
  if (ps === 'stop') { v.arms[1].rotation.set(0, 0, 2.3); }
  if (ps === 'stand') { v.arms[0].rotation.set(0, 0, -0.08); v.arms[1].rotation.set(0, 0, 0.08); }
  const keep = new Set([v.root, hemi, sun, sun.target]);
  const vis = scene.children.map(o => o.visible);
  scene.children.forEach(o => { if (!keep.has(o)) o.visible = false; });
  const fog = scene.fog; scene.fog = null;
  stars.style.opacity = 0;
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.set(...p); camera.lookAt(...l);
  sun.position.set(p[0] + 8, 12, p[2] + 6); sun.target.position.set(...l);
  renderer.render(scene, camera);
  scene.children.forEach((o, i) => o.visible = vis[i]); scene.fog = fog;
};

// =====================================================================
// DAY 3 — Kampung Penduduk + Pelantikan Pegawai
// =====================================================================
const D3DUR = 60.0;
document.querySelector('.day').textContent = 'DAY 3';

// ---------- new costumes: penjual bunga, penjual ikan ----------
VENDORS.bunga = () => {
  const v = makeVillager({ shirt: 0xfbcfe8, pants: 0x374151, skin: 0xdba57a, hat: 'hair' });
  const crown = wadd(v.head, new THREE.TorusGeometry(0.29, 0.035, 5, 18), WM(0x86efac), 0, 0.14, 0); crown.rotation.x = Math.PI / 2;
  const fc = [0xf472b6, 0xfacc15, 0xffffff, 0xf87171, 0xa78bfa];
  for (let i = 0; i < 7; i++) wadd(v.head, new THREE.SphereGeometry(0.05, 6, 5), WM(fc[i % 5]), Math.cos(i * 0.9) * 0.29, 0.15, Math.sin(i * 0.9) * 0.29);
  apron(v, '#db2777', 'BUNGA', '#ffffff', (x, cx, cy) => {
    for (let i = 0; i < 5; i++) { x.fillStyle = '#fde68a'; x.beginPath(); x.arc(cx + Math.cos(i * 1.256) * 20, cy + Math.sin(i * 1.256) * 20, 14, 0, 7); x.fill(); }
    x.fillStyle = '#f59e0b'; x.beginPath(); x.arc(cx, cy, 12, 0, 7); x.fill();
  });
  const bq = new THREE.Group(); v.arms[1].add(bq); bq.position.set(0, -0.58, 0.14);
  wadd(bq, new THREE.ConeGeometry(0.14, 0.32, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xfef3c7, side: THREE.DoubleSide, flatShading: true }), 0, 0.02, 0).rotation.x = Math.PI;
  for (let i = 0; i < 8; i++) wadd(bq, new THREE.SphereGeometry(0.055, 6, 5), WM(fc[i % 5]), Math.cos(i * 0.8) * 0.08, 0.2 + (i % 2) * 0.04, Math.sin(i * 0.8) * 0.08);
  for (let i = 0; i < 4; i++) wadd(bq, new THREE.ConeGeometry(0.03, 0.1, 3), WM(0x22c55e), Math.cos(i * 1.6) * 0.12, 0.14, Math.sin(i * 1.6) * 0.12);
  return { v, pose: 'hold' };
};
VENDORS.ikan = () => {
  const v = makeVillager({ shirt: 0xe0f2fe, pants: 0x1e3a5f, skin: 0x9c6238, hat: 'cap', hatColor: 0x0ea5e9 });
  apron(v, '#0369a1', 'IKAN SEGAR', '#ffffff', (x, cx, cy) => {
    x.fillStyle = '#7dd3fc'; x.beginPath(); x.ellipse(cx - 6, cy, 42, 18, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(cx + 34, cy); x.lineTo(cx + 58, cy - 18); x.lineTo(cx + 58, cy + 18); x.fill();
    x.fillStyle = '#0c4a6e'; x.beginPath(); x.arc(cx - 32, cy - 4, 4, 0, 7); x.fill();
  });
  v.legs.forEach(l => { l.children[1].material = WM(0x111827, { roughness: 0.4 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8), WM(0x111827, { roughness: 0.4 })); b.position.set(0, -0.31, 0); l.add(b); });
  const tr = new THREE.Group(); v.arms[1].add(tr); tr.position.set(-0.04, -0.6, 0.2);
  wadd(tr, new THREE.BoxGeometry(0.46, 0.05, 0.32), WM(0x93c5fd, { roughness: 0.4 }), 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Group(); tr.add(f); f.position.set(-0.13 + i * 0.13, 0.05, 0); f.rotation.y = 0.3 * (i - 1);
    const b = wadd(f, new THREE.SphereGeometry(0.06, 8, 6), WM(0x94a3b8, { metalness: 0.3, roughness: 0.35 }), 0, 0, 0); b.scale.set(0.7, 0.55, 2.2);
    wadd(f, new THREE.ConeGeometry(0.05, 0.08, 4), WM(0x64748b), 0, 0, -0.16).rotation.x = -Math.PI / 2;
  }
  return { v, pose: 'hold' };
};
function applyHeldPose(v, ps) {
  vPose(v, { t: 1 });
  if (ps === 'hold') {
    v.arms[1].rotation.set(-0.95, 0, 0.25);
    v.arms[1].children.filter(c => c.isGroup).forEach(g => g.rotation.set(1.3, 0, -0.25));
  }
}

// ---------- appointees ----------
const APPOINT = [
  { user: 'zyx_naww', job: 'PENJUAL SEBLAK', make: () => VENDORS.seblak(), casual: { shirt: 0x94a3b8, pants: 0x1f2937, skin: 0xdba57a, hat: 'hijab', hatColor: 0xdc2626 } },
  { user: 'vlhl_vbs_0801', job: 'NELAYAN', make: () => WORKERS.nelayan(), casual: { shirt: 0x65a30d, pants: 0x4b5563, skin: 0xa86b3c, hat: 'hair' } },
  { user: '67_elit_ariza_67', job: 'PENJAGA GERBANG', make: () => UNIFORMS.satpam(), casual: { shirt: 0x7c3aed, pants: 0x1f2937, skin: 0xb07446, hat: 'hair' } },
  { user: 'ghitssna', job: 'PENJUAL BUNGA', make: () => VENDORS.bunga(), casual: { shirt: 0xf9a8d4, pants: 0x374151, skin: 0xdba57a, hat: 'hair' } },
  { user: 'kasmir_994', job: 'PENJUAL IKAN', make: () => VENDORS.ikan(), casual: { shirt: 0xf59e0b, pants: 0x1e3a5f, skin: 0x9c6238, hat: 'cap', hatColor: 0x0ea5e9 } },
];
APPOINT.forEach(a => {
  a.cas = makeVillager(a.casual); scene.add(a.cas.root);
  const u = a.make(); a.uni = u.v; a.ps = u.pose; scene.add(a.uni.root);
  a.tag = tagSprite('@' + a.user, '#ffffff', '#14181f', a.user.length > 12 ? 1024 : 512);
});

// ---------- north land: Kampung Penduduk ----------
const NORTH = V(0.8, 0, -12.6);
const north = new THREE.Group(); scene.add(north);
north.add(mesh(jitter(new THREE.CylinderGeometry(6.0, 7.0, 1.8, 18, 1), 0.5, true), mat(0xf2d79b), 0, SAND - 0.9, 0));
north.add(mesh(jitter(new THREE.CylinderGeometry(4.6, 5.1, 0.5, 14, 1), 0.4, true), mat(0x7cc95a), 0, GRASS - 0.25, -0.6));
north.add(palm(-4.6, SAND, -2.2, 3.2, 0.35, 0.7));
north.add(palm(4.9, SAND, -1.0, 3.0, 0.4, 2.6));
north.add(palm(0.6, GRASS, -4.6, 3.4, 0.25, 4.2));
for (let i = 0; i < 30; i++) {
  const a = R() * Math.PI * 2, d = R() * 4.2;
  north.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 3), mat(0x4f9d3a), Math.cos(a) * d, GRASS + 0.12, -0.6 + Math.sin(a) * d, false));
}
// path from main island
for (let i = 0; i < 7; i++) north.add(mesh(new THREE.BoxGeometry(0.6, 0.06, 0.5), mat(0xd9c08a), 0.2 + Math.sin(i) * 0.15, GRASS + 0.02, 5.2 - i * 0.9, false));
north.position.copy(NORTH);
const foam3 = foam.clone(); scene.add(foam3);

const houseParts = [];
function makeHouse(x, z, roofCol, wallCol, rot, j) {
  const g = new THREE.Group(); g.position.set(NORTH.x + x, GRASS, NORTH.z + z); g.rotation.y = rot; scene.add(g);
  const P = (o, k0, k1, mode = 'pop') => { g.add(o); houseParts.push({ obj: o, k0: j + k0, k1: j + k1, mode, s: o.scale.clone() }); return o; };
  const wood = mat(0x8b5a2b);
  for (const [px, pz] of [[-0.9, -0.7], [0.9, -0.7], [-0.9, 0.7], [0.9, 0.7]]) P(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.75, 6), wood, px, 0.37, pz), 0.0, 0.12, 'grow');
  P(mesh(new THREE.BoxGeometry(2.2, 0.14, 1.8), mat(0xa3713f), 0, 0.78, 0), 0.1, 0.22);
  P(mesh(new THREE.BoxGeometry(1.9, 1.15, 1.5), mat(wallCol), 0, 1.42, -0.05), 0.22, 0.45, 'grow');
  const sh = new THREE.Shape(); sh.moveTo(-1.3, 0); sh.lineTo(1.3, 0); sh.lineTo(0, 0.95); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: 1.95, bevelEnabled: false }); rg.translate(0, 0, -0.975);
  P(mesh(rg, mat(roofCol), 0, 1.98, -0.05), 0.48, 0.66);
  P(mesh(new THREE.BoxGeometry(0.42, 0.72, 0.05), mat(0x5b3a1e), -0.3, 1.24, 0.71, false), 0.66, 0.74);
  P(mesh(new THREE.BoxGeometry(0.38, 0.32, 0.05), mat(0xbfe3ff), 0.45, 1.5, 0.71, false), 0.7, 0.78);
  P(mesh(new THREE.BoxGeometry(0.46, 0.05, 0.06), mat(0x5b3a1e), 0.45, 1.68, 0.73, false), 0.72, 0.8);
  for (let s = 0; s < 3; s++) P(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.24), wood, -0.3, 0.2 + s * 0.22, 1.25 - s * 0.2), 0.78 + s * 0.05, 0.86 + s * 0.05);
  P(mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), wood, 0.25, 0.45, 1.3), 0.88, 0.96);
  return g;
}
const HOUSES = [
  makeHouse(-2.6, 0.8, 0xc2410c, 0xd6b48a, 0.25, 0),
  makeHouse(0.6, 1.6, 0x1d4ed8, 0xe7cfa6, 0.0, 1),
  makeHouse(3.6, 0.6, 0x15803d, 0xd2ab7f, -0.3, 2),
];
function buildHouses(k) {
  for (const p of houseParts) {
    const u = clamp((k - p.k0) / (p.k1 - p.k0));
    const s = p.mode === 'grow' ? ease(u) : pop(u);
    p.obj.visible = u > 0.001;
    if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s), p.s.z);
    else p.obj.scale.setScalar(Math.max(0.001, s));
  }
}
const hl = (h, x, y, z) => { h.updateMatrixWorld(true); return h.localToWorld(V(x, y, z)); };
const tagHouse = tagSprite('Rumah @lando_094', '#ffd23f', '#3a2300', 1024);

// ---------- ceremony props ----------
const CER = V(1.5, SAND, 5.6);
const cere = new THREE.Group(); scene.add(cere);
const podium = mesh(new THREE.BoxGeometry(0.7, 0.9, 0.5), mat(0x8b5a2b), -1.25, SAND + 0.45, 5.2); cere.add(podium);
cere.add(mesh(new THREE.BoxGeometry(0.78, 0.08, 0.58), mat(0xa3713f), -1.25, SAND + 0.92, 5.2));
const mic = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 5), mat(0x222222), -1.15, SAND + 1.12, 5.35); cere.add(mic);
cere.add(mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(0x333333), -1.15, SAND + 1.3, 5.38));
cere.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 3.0, 6), mat(0xe5e7eb), 4.6, SAND + 1.5, 3.4));
const flagRI = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9, map: canvasTex(120, 80, (x, w, h) => {
  x.fillStyle = '#d90429'; x.fillRect(0, 0, w, h / 2); x.fillStyle = '#f5f5f5'; x.fillRect(0, h / 2, w, h / 2);
}) }));
flagRI.position.set(5.06, SAND + 2.68, 3.4); cere.add(flagRI);
const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.55), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: canvasTex(1024, 166, (x, w, h) => {
  x.fillStyle = '#b91c1c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffd23f'; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = '#ffffff'; x.font = '700 70px Poppins'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PELANTIKAN PEGAWAI PULAU', w / 2, h / 2 + 4);
}) }));
banner.position.set(1.6, SAND + 2.55, 3.0); cere.add(banner);
for (const bx of [-0.2, 3.4]) cere.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6), mat(0x8b5a2b), bx, SAND + 1.4, 3.0));
// poof particles
const puffs = [];
for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); scene.add(m); puffs.push({ m, d: V(Math.cos(i * 2.4) * (0.6 + (i % 3) * 0.2), 0.3 + (i % 5) * 0.25, Math.sin(i * 2.4) * (0.6 + (i % 4) * 0.15)) }); }
function poof(center, k) {
  puffs.forEach(p => {
    const vis = k > 0 && k < 1;
    p.m.visible = vis; if (!vis) return;
    p.m.position.copy(center).addScaledVector(p.d, easeOut(k)); p.m.position.y += 0.6;
    p.m.scale.setScalar(0.6 + 1.8 * k); p.m.material.opacity = 0.95 * (1 - k);
  });
}
// confetti
const CONF = [];
{ const cols = [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xec4899, 0xffffff]; const r = rnd(77);
  for (let i = 0; i < 90; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 0.11), new THREE.MeshBasicMaterial({ color: cols[i % 6], side: THREE.DoubleSide })); scene.add(m); m.visible = false; CONF.push({ m, x: (r() - 0.5) * 6.5, z: (r() - 0.5) * 2.5, y0: 3 + r() * 2.5, sp: 0.8 + r() * 0.7, ph: r() * 6 }); } }

// ---------- SK card UI ----------
const sk = document.createElement('div');
sk.innerHTML = `<div style="font-size:10.5px;letter-spacing:1.6px;font-weight:700;color:#7a5a1a">SURAT KEPUTUSAN KEPALA PULAU</div>
<div style="font-size:12.5px;color:#5a4a2a;margin-top:6px;font-weight:500">Dengan ini melantik</div>
<div id="skUser" style="font-size:22px;font-weight:700;color:#1a1d21;margin-top:2px">@user</div>
<div style="font-size:12.5px;color:#5a4a2a;margin-top:4px;font-weight:500">sebagai</div>
<div id="skJob" style="font-size:21px;font-weight:700;color:#b91c1c;margin-top:1px">JOB</div>
<div id="skStamp" style="position:absolute;right:16px;bottom:14px;width:64px;height:64px;border:4px solid #c1121f;border-radius:50%;color:#c1121f;font-weight:700;font-size:20px;display:flex;align-items:center;justify-content:center;transform:rotate(-14deg);opacity:0">SAH</div>`;
Object.assign(sk.style, { position: 'absolute', left: '40px', right: '40px', top: '110px', background: '#fffaf0', border: '3px solid #c9a227', borderRadius: '14px', padding: '14px 18px 16px', fontFamily: 'Poppins, sans-serif', boxShadow: '0 6px 18px rgba(0,0,0,.3)', opacity: '0', transformOrigin: '50% 0%' });
document.getElementById('ui').appendChild(sk);
const skUser = sk.querySelector('#skUser'), skJob = sk.querySelector('#skJob'), skStamp = sk.querySelector('#skStamp');

// ---------- timeline ----------
const SUBS3 = [
  [0.3, 2.3, 'Day 3.'],
  [2.4, 4.8, 'Pulaunya… nambah luas lagi.'],
  [5.1, 7.4, 'Penduduk sekarang…'],
  [7.6, 9.4, 'lima puluh sembilan!'],
  [9.5, 10.9, 'Kepiting? …Masih belum.'],
  [11.1, 13.0, 'Banyak yang minta dibuatkan rumah.'],
  [13.1, 14.9, 'Kampung Penduduk… resmi dibuka!'],
  [15.2, 18.8, 'Rumah pertama… buat @lando_094.'],
  [19.0, 22.8, 'Disusul rumah buat penduduk lainnya.'],
  [23.1, 25.9, 'Silakan masuk. Rumahnya sudah jadi.'],
  [26.1, 29.3, 'Sekarang… pelantikan pegawai pulau.'],
  [29.6, 33.4, 'Saya lantik… penjual seblak. Sah!'],
  [33.6, 37.4, 'Nelayan. Kapalnya… menyusul.'],
  [37.6, 41.4, 'Penjaga gerbang. Senapan? Pentungan dulu, ya.'],
  [41.6, 45.4, 'Penjual bunga. Tamannya… segera.'],
  [45.6, 49.3, 'Penjual ikan. Jangan dijual ke kepiting.'],
  [49.6, 52.8, 'Selamat bertugas, pegawai pulau!'],
  [53.1, 56.0, 'Yang mau jualan… sebutkan jualan apa.'],
  [56.2, 60.0, 'Follow biar jadi penduduk. Komen, mau dibangun apa.'],
];
const CMT3 = { a: 11.2, b: 14.95, name: 'lando_094', ago: '1h', col: '#6b7280', text: 'Mks y bg buatin ak rumah dong' };
const CUTS3 = [5, 11, 15, 23, 26, 29.5, 49.5, 53];
const LINE_X = [-0.6, 0.6, 1.8, 3.0, 4.2];
const LINE_Z = 3.9;
const SPOT = V(2.25, SAND, 5.7);
const BT_SPOT = V(1.0, SAND, 5.7);

function renderAt3(t, rt = t) {
  updateOcean(rt);
  const fs = 1 + Math.sin(rt * 1.6) * 0.012;
  foam.scale.x = foam.scale.y = fs; foam.position.y = 0.1 + Math.sin(rt * 1.6) * 0.03;
  foam2.scale.set(0.84 * fs, 0.84 * fs, 0.25); foam2.position.set(EXT.x, foam.position.y, EXT.z); foam2.visible = true;
  foam3.scale.set(0.86 * fs, 0.86 * fs, 0.25); foam3.position.set(NORTH.x, foam.position.y, NORTH.z);

  let cam, focus = V(0, 0, 3), tod = 0, night = 0, az = 0.7;
  let cpos = V(-0.3, SAND, 5.7), crot = -0.3;
  const P = { t };
  let hk = 3, northK = 1, signText = 'PENDUDUK: 59';
  crab.visible = false; tagLando.visible = false; tagTetii.visible = false; tagHouse.visible = false;
  torch.visible = false; torchL.intensity = 0;
  boat.scale.setScalar(1.6); boat.rotation.set(0, Math.PI / 2, 0);
  boat.position.set(BOAT_DOCK, waveH(BOAT_DOCK, 1, rt) + 0.05, 1.0); boat.rotation.z = Math.sin(rt * 1.7) * 0.04;
  buildWarung(1); WG.visible = true; mmSign.scale.setScalar(1);
  bulbM.emissiveIntensity = 0.3; lamp.intensity = 0; lampIn.intensity = 0; mmFace.emissiveIntensity = 0;
  ext.position.y = 0; ext.visible = true;
  cere.visible = t >= 26 && t < 53;
  CONF.forEach(c => c.m.visible = false);
  poof(V(), 0);
  const hideV = () => VIL.forEach(v => v.root.visible = false);
  const atGather = (cheer = 0) => VIL.forEach((v, i) => {
    v.root.visible = true; v.root.position.set(GATHER[i][0], SAND, GATHER[i][1]);
    v.root.rotation.y = faceTo(v.root.position, -0.5, 12); vPose(v, { t, cheer, ph: i * 1.3 });
  });
  hideV();
  APPOINT.forEach(a => { a.cas.root.visible = false; a.uni.root.visible = false; a.tag.visible = false; });
  clockEl.style.display = 'none'; sk.style.opacity = 0;

  if (t < 5) { // S1 aerial, north land rises
    northK = ease(seg(t, 0.9, 3.8)); hk = 0; signText = 'PENDUDUK: 26';
    cam = shot(t, 0, 5, V(14, 46, 40), V(10, 32, 26), V(-1.5, 0, -3.0), V(-0.5, 0, -4.5));
    focus = V(0, 0, -4);
  } else if (t < 11) { // S2 counter 26 -> 59
    hk = 0;
    const ck = ease(seg(t, 5.6, 7.5));
    signText = t > 7.5 ? 'PENDUDUK: 59' : `PENDUDUK: ${Math.round(26 + 33 * ck)}`;
    atGather(t > 7.6 && t < 9.4 ? ease(seg(t, 7.6, 8.0)) : 0);
    cpos = V(-0.3, SAND, 5.7); crot = -0.35; P.talk = 1;
    if (t > 7.6 && t < 9.4) P.wave = ease(seg(t, 7.6, 8.0));
    board.scale.setScalar(t > 5.6 && t < 7.6 ? 1 + 0.05 * Math.abs(Math.sin(t * 40)) : (t >= 7.5 ? 1 + 0.18 * Math.sin(seg(t, 7.5, 8.0) * Math.PI) : 1));
    cam = shot(t, 5, 11, V(1.0, 3.3, 14.8), V(0.5, 3.1, 13.8), V(0.1, 1.5, 4.6), V(0.0, 1.5, 4.6));
    focus = V(0.5, 0, 5);
    if (t > 9.5) {
      crab.visible = true; const k = seg(t, 9.5, 11);
      crab.position.set(lerp(4.0, -3.0, k), SAND + Math.abs(Math.sin(t * 22)) * 0.03, 7.0);
      crabLegs.forEach((l, i) => l.rotation.x = Math.sin(t * 26 + i) * 0.5);
    }
  } else if (t < 15) { // S3 request + kampung dibuka
    hk = 0;
    cpos = V(1.2, GRASS, -6.4); crot = Math.PI + 0.2; P.talk = 1;
    if (t > 13.1) P.wave = ease(seg(t, 13.1, 13.5));
    VIL.forEach((v, i) => { if (i < 4) { v.root.visible = true; v.root.position.set(-2.6 + i * 0.85, GRASS, -6.6 + (i % 2) * 0.5); v.root.rotation.y = Math.PI; vPose(v, { t, cheer: t > 13.2 ? ease(seg(t, 13.2, 13.6)) : 0, ph: i }); } });
    cam = shot(t, 11, 15, V(4.2, 4.6, -0.8), V(3.8, 4.8, -1.6), V(0.4, 1.3, -10.0), V(0.4, 1.5, -11.0));
    focus = V(1, 0, -9);
  } else if (t < 23) { // S4 timelapse houses
    hk = 3 * seg(t, 15.3, 22.6);
    tod = ease(seg(t, 20.5, 23)) * 0.4; az = lerp(-0.6, 2.0, seg(t, 15, 23));
    const j = Math.min(2, Math.floor(hk)), H = HOUSES[j];
    const w = hl(H, 1.3, 0, 1.6);
    cpos = V(w.x, GRASS, w.z); crot = faceTo(cpos, H.position.x, H.position.z);
    P.hammer = 1; P.tool = 'hammer'; P.t = t * 1.6;
    VIL.forEach((v, i) => {
      if (i > 2) return; v.root.visible = true;
      const p = hl(H, [-1.6, 1.6, -0.2][i], 0, [0.4, -0.6, 1.9][i]);
      v.root.position.set(p.x, GRASS, p.z); v.root.rotation.y = faceTo(v.root.position, H.position.x, H.position.z);
      vPose(v, { t: t * 1.6, hammer: 1, ph: i * 1.7 });
    });
    if (t < 19) { tagHouse.visible = hk > 0.7; tagHouse.position.copy(hl(HOUSES[0], 0, 3.2, 0)); tagHouse.scale.set(4.4, 0.41, 1); }
    cam = shot(t, 15, 23, V(7.6, 7.6, 0.6), V(6.6, 7.0, -0.2), V(0.6, 1.0, -11.0), V(0.7, 1.0, -11.3));
    focus = V(1, 0, -11);
    clockEl.style.display = 'block';
    const hr = 8 + seg(t, 15.3, 22.6) * 9.5, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60);
    clockT.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; clockL.textContent = 'x24 TIME-LAPSE';
  } else if (t < 26) { // S5 lando enters his house
    tod = 0.45; az = 2.0;
    const H = HOUSES[0], v = VIL[0];
    v.root.visible = true;
    const a = hl(H, -0.3, 0, 3.2), b = hl(H, -0.3, 0, 1.45), c = hl(H, -0.3, 0.66, 0.95);
    const k = seg(t, 23.2, 25.0);
    let p;
    if (k < 0.7) { p = vlerp(a, b, k / 0.7); p.y = GRASS; } else { p = vlerp(b, c, (k - 0.7) / 0.3); p.y = GRASS + 0.66 * ((k - 0.7) / 0.3); }
    v.root.position.copy(p); v.root.rotation.y = H.rotation.y + (t > 25.1 ? Math.PI : 0);
    vPose(v, { walk: k > 0 && k < 1 ? (t - 23.2) * 11 : 0, t, cheer: t > 25.1 ? ease(seg(t, 25.1, 25.4)) : 0 });
    tagLando.visible = true; tagLando.position.copy(v.root.position).add(V(0, 2.05, 0));
    const bp = hl(H, 1.4, 0, 2.6); cpos = V(bp.x, GRASS, bp.z); crot = faceTo(cpos, v.root.position.x, v.root.position.z); P.talk = 1;
    cam = shot(t, 23, 26, V(H.position.x + 3.8, 3.4, H.position.z + 9.2), V(H.position.x + 3.2, 3.3, H.position.z + 8.4), V(H.position.x, 1.5, H.position.z + 0.6), V(H.position.x, 1.5, H.position.z + 0.6));
    focus = H.position.clone();
  } else if (t < 49.5) { // S6+S7 ceremony
    tod = 0.15; az = 0.4;
    cpos = BT_SPOT.clone(); crot = Math.PI / 2; P.talk = 1;
    const idx = t < 29.5 ? -1 : Math.min(4, Math.floor((t - 29.5) / 4));
    APPOINT.forEach((a, i) => {
      const slot = V(LINE_X[i], SAND, LINE_Z);
      let pos = slot.clone(), faceY = 0, uniformOn = i < idx, walk = 0;
      if (i === idx) {
        const lt = (t - 29.5) - i * 4;
        if (lt < 0.8) { pos = vlerp(slot, SPOT, ease(lt / 0.8)); walk = lt * 11; faceY = Math.atan2(SPOT.x - slot.x, SPOT.z - slot.z); }
        else if (lt < 3.1) { pos = SPOT.clone(); faceY = -Math.PI / 2; uniformOn = lt > 2.0; }
        else { pos = vlerp(SPOT, slot, ease((lt - 3.1) / 0.85)); walk = lt * 11; faceY = Math.atan2(slot.x - SPOT.x, slot.z - SPOT.z); uniformOn = true; }
        if (lt > 1.0 && lt < 2.0) { P.wave = 0; }
        poof(SPOT, seg(lt, 2.0, 2.7));
        sk.style.opacity = lt > 0.6 && lt < 3.7 ? Math.min(1, (lt - 0.6) * 4, (3.7 - lt) * 4) : 0;
        sk.style.transform = `scale(${lerp(0.85, 1, pop(seg(lt, 0.6, 0.95)))})`;
        skUser.textContent = '@' + a.user; skJob.textContent = a.job;
        skStamp.style.opacity = lt > 2.0 ? 1 : 0; skStamp.style.transform = `rotate(-14deg) scale(${lt > 2.0 ? lerp(1.6, 1, pop(seg(lt, 2.0, 2.3))) : 1})`;
        a.tag.visible = true;
        crot = Math.PI / 2;
        if (lt > 1.0 && lt < 1.9) { ch.arms && 0; }
      }
      const m = uniformOn ? a.uni : a.cas;
      m.root.visible = true; m.root.position.copy(pos); m.root.rotation.y = faceY;
      if (uniformOn && !walk) applyHeldPose(m, a.ps); else vPose(m, { walk, t, ph: i });
      if (i === idx && !walk && (t - 29.5 - i * 4) > 1.0 && (t - 29.5 - i * 4) < 2.0) m.arms[1].rotation.set(-1.25, 0, 0.1);
      a.tag.position.copy(pos).add(V(0, 2.0, 0)); a.tag.visible = i === idx;
      if (t < 29.5) a.tag.scale.set(a.user.length > 12 ? 3.0 : 1.5, 0.28, 1);
      else a.tag.scale.set(a.user.length > 12 ? 4.0 : 2.0, 0.38, 1);
    });
    VIL.forEach((v, i) => {
      if (i > 3) return; v.root.visible = true;
      const p = [[-3.2, 6.6], [-3.6, 5.6], [5.8, 6.4], [6.2, 5.4]][i];
      v.root.position.set(p[0], SAND, p[1]); v.root.rotation.y = faceTo(v.root.position, 1.6, 5.7);
      const lt = t - 29.5 - Math.max(0, idx) * 4;
      vPose(v, { t, cheer: idx >= 0 && lt > 2.0 && lt < 3.2 ? 1 : 0, ph: i });
    });
    if (idx >= 0) { const lt = t - 29.5 - idx * 4; if (lt > 1.0 && lt < 2.0) P.hold = 1; }
    if (t < 29.5) cam = shot(t, 26, 29.5, V(1.6, 4.0, 16.0), V(1.6, 3.4, 14.6), V(1.6, 1.6, 4.0), V(1.6, 1.5, 4.2));
    else cam = { pos: V(1.65, 2.7, 13.2 + Math.sin(t * 0.3) * 0.15), look: V(1.65, 1.55, 4.8) };
    focus = V(1.6, 0, 5);
  } else if (t < 53) { // S8 group photo + confetti
    tod = 0.2; az = 0.4;
    cpos = V(1.65, SAND, 6.1); crot = 0; P.wave = ease(seg(t, 49.6, 50.0));
    APPOINT.forEach((a, i) => {
      const m = a.uni; m.root.visible = true;
      m.root.position.set([-0.7, 0.4, 2.9, 4.0, 5.0][i] - 0.15, SAND, [5.6, 6.0, 6.0, 5.6, 5.0][i]);
      m.root.rotation.y = faceTo(m.root.position, 1.65, 12);
      applyHeldPose(m, a.ps);
      if (i === 2) m.arms[1].quaternion.setFromUnitVectors(V(0, -1, 0), V(-0.28, 0.78, 0.56).normalize());
      a.tag.visible = true; a.tag.position.copy(m.root.position).add(V(0, 2.0, 0)); a.tag.scale.set(a.user.length > 12 ? 3.2 : 1.6, 0.3, 1);
    });
    VIL.forEach((v, i) => {
      if (i > 3) return; v.root.visible = true;
      const p = [[-2.6, 4.2], [-1.4, 3.6], [4.8, 3.6], [6.0, 4.2]][i];
      v.root.position.set(p[0], SAND, p[1]); v.root.rotation.y = faceTo(v.root.position, 1.6, 12); vPose(v, { t, cheer: 1, ph: i });
    });
    CONF.forEach(c => {
      c.m.visible = true;
      const y = c.y0 - ((t - 49.5) * c.sp) % 4.2;
      c.m.position.set(1.6 + c.x + Math.sin(t * 2 + c.ph) * 0.2, SAND + Math.max(0.05, y), 5.4 + c.z);
      c.m.rotation.set(t * 3 + c.ph, t * 2 + c.ph, 0);
    });
    cam = shot(t, 49.5, 53, V(2.0, 2.9, 14.2), V(1.8, 2.7, 13.2), V(1.8, 1.4, 5.0), V(1.8, 1.4, 5.0));
    focus = V(1.6, 0, 5);
  } else { // S9 CTA at sign, sunset
    tod = 1; az = -0.15;
    signText = t > 53.8 ? 'PENDUDUK: 59 → ?' : 'PENDUDUK: 59';
    board.scale.setScalar(t > 53.8 ? 1 + 0.15 * Math.sin(seg(t, 53.8, 54.3) * Math.PI) : 1);
    cpos = V(-0.4, SAND, 5.6); crot = -0.15; P.talk = 1;
    if (t > 56.3) P.wave = ease(seg(t, 56.3, 56.7));
    cam = shot(t, 53, 60, V(0.8, 2.4, 12.4), V(0.2, 2.3, 11.2), V(-0.8, 1.95, 5.0), V(-0.9, 1.95, 5.0));
    focus = V(-0.8, 0, 5);
    APPOINT.forEach((a, i) => { if (i < 2) { const m = a.uni; m.root.visible = true; m.root.position.set(0.9 + i * 1.0, SAND, 4.4 + i * 0.4); m.root.rotation.y = faceTo(m.root.position, 0, 12); applyHeldPose(m, a.ps); } });
  }

  north.position.y = lerp(-2.6, 0, northK); north.visible = northK > 0.01; foam3.visible = northK > 0.9;
  buildHouses(hk);
  HOUSES.forEach(h => h.visible = hk > 0.001);

  ch.root.position.copy(cpos); ch.root.rotation.y = crot;
  pose(ch, P);
  if (P.hold) ch.arms[1].rotation.set(-1.25, 0, 0.15);
  sign.position.y = SAND;
  setSign(signText);
  if (t >= 53 || t < 26) board.scale.x = board.scale.x;

  setSky(tod, night, az);
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 35);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);

  const s = SUBS3.find(([a, b]) => t >= a && t < b);
  subEl.textContent = s ? s[2] : '';
  if (s) { const k = seg(t, s[0], s[0] + 0.18); subEl.style.opacity = k; subEl.style.transform = `scale(${lerp(0.85, 1, pop(k))})`; }
  const c = t >= CMT3.a && t < CMT3.b ? CMT3 : null;
  if (c) {
    cname.textContent = c.name; cago.textContent = c.ago; ctext.textContent = c.text; cav.textContent = 'L'; cav.style.background = c.col;
    const k = pop(seg(t, c.a, c.a + 0.35)), o = 1 - seg(t, c.b - 0.25, c.b);
    cmtEl.style.opacity = Math.min(1, k * 1.5) * o; cmtEl.style.transform = `scale(${Math.max(0.01, k)})`;
  } else cmtEl.style.opacity = 0;
  const rulesOn = t >= 56.2;
  [[r1, 56.3], [r2, 56.55], [r3, 56.8]].forEach(([el, t0]) => {
    const k = pop(seg(t, t0, t0 + 0.35)); el.style.opacity = rulesOn ? Math.min(1, k * 1.5) : 0; el.style.transform = `scale(${Math.max(0.01, k)})`;
  });
  const dc = Math.min(...CUTS3.map(c => t >= c ? t - c : 99));
  let fl = dc < 0.12 ? (1 - dc / 0.12) * 0.35 : 0;
  if (t >= 29.5 && t < 49.5) { const lt = (t - 29.5) % 4; if (lt > 2.0 && lt < 2.25) fl = Math.max(fl, (1 - (lt - 2.0) / 0.25) * 0.5); }
  flash.style.opacity = fl;

  renderer.render(scene, camera);
}

window.DURATION = D3DUR;
window.renderAt = renderAt3;

// =====================================================================
// DAY 4 — Tempat Pemancingan + RM Padang "Lamak Bana" + Pelantikan
// =====================================================================
const D4DUR = 73.0;
document.querySelector('.day').textContent = 'DAY 4';
subEl.style.display = 'none'; // subtitles are added by the owner in CapCut

const recolor = (root, from, to) => root.traverse(o => {
  if (!o.isMesh) return;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  ms.forEach(m => { if (m && m.color && m.color.getHex() === from) m.color.setHex(to); });
});

// ---------- new costumes ----------
VENDORS.mieayam = () => {
  const v = makeVillager({ shirt: 0xf8fafc, pants: 0x1f2937, skin: 0xc98a5a, hat: 'hair' });
  const tw = wadd(v.body, new THREE.TorusGeometry(0.2, 0.05, 6, 16), WM(0xfacc15), 0, 1.07, 0.02); tw.rotation.x = Math.PI / 2;
  apron(v, '#b45309', 'MIE AYAM', '#ffffff', (x, cx, cy) => {
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx, cy + 6, 46, 20, 0, 0, Math.PI); x.fill();
    x.strokeStyle = '#fde68a'; x.lineWidth = 5; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(cx + i * 12, cy + 4); x.quadraticCurveTo(cx + i * 12 + 8, cy - 16, cx + i * 12 + 2, cy - 30); x.stroke(); }
  });
  const bw = new THREE.Group(); v.arms[1].add(bw); bw.position.set(-0.04, -0.6, 0.18);
  wadd(bw, new THREE.CylinderGeometry(0.2, 0.12, 0.14, 14), WM(0xffffff, { roughness: 0.4 }), 0, 0, 0);
  for (let i = 0; i < 9; i++) { const n = wadd(bw, new THREE.TorusGeometry(0.06, 0.014, 4, 10), WM(0xfcd34d), Math.cos(i * 0.7) * 0.08, 0.07, Math.sin(i * 1.3) * 0.07); n.rotation.set(Math.PI / 2 + i * 0.3, 0, i); }
  for (let i = 0; i < 4; i++) wadd(bw, new THREE.BoxGeometry(0.05, 0.035, 0.05), WM(0x92400e), Math.cos(i * 1.7) * 0.07, 0.1, Math.sin(i * 1.7) * 0.06);
  for (let i = 0; i < 3; i++) wadd(bw, new THREE.BoxGeometry(0.08, 0.015, 0.05), WM(0x16a34a), -0.09 + i * 0.07, 0.1, 0.08);
  for (const dx of [0.1, 0.13]) { const c = wadd(bw, new THREE.CylinderGeometry(0.008, 0.008, 0.38, 4), WM(0x8b5a2b), dx, 0.18, -0.05); c.rotation.z = -0.5; }
  return { v, pose: 'hold' };
};
WORKERS.kapal = () => {
  const v = makeVillager({ shirt: 0x1e3a8a, pants: 0x78350f, skin: 0x9c6238, hat: 'hair' });
  wadd(v.head, new THREE.TorusGeometry(0.3, 0.035, 5, 18), WM(0xdc2626), 0, 0.1, 0).rotation.x = Math.PI / 2;
  apron(v, '#78350f', 'GALANGAN', '#fde68a', (x, cx, cy) => {
    x.fillStyle = '#fde68a'; x.beginPath(); x.moveTo(cx - 50, cy); x.lineTo(cx + 50, cy); x.lineTo(cx + 34, cy + 22); x.lineTo(cx - 34, cy + 22); x.fill();
    x.fillRect(cx - 3, cy - 40, 6, 40); x.beginPath(); x.moveTo(cx + 3, cy - 38); x.lineTo(cx + 34, cy - 6); x.lineTo(cx + 3, cy - 6); x.fill();
  });
  const bt = new THREE.Group(); v.arms[1].add(bt); bt.position.set(-0.04, -0.62, 0.16);
  const hull = new THREE.Shape(); hull.moveTo(-0.22, 0); hull.lineTo(0.22, 0); hull.lineTo(0.16, -0.08); hull.lineTo(-0.16, -0.08); hull.closePath();
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.12, bevelEnabled: false }); hg.translate(0, 0.06, -0.06);
  wadd(bt, hg, WM(0x2f6fb5), 0, 0, 0);
  wadd(bt, new THREE.CylinderGeometry(0.008, 0.008, 0.28, 4), WM(0x8b5a2b), 0, 0.2, 0);
  const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(0.13, 0); sail.lineTo(0, 0.2); sail.closePath();
  const sm = new THREE.Mesh(new THREE.ShapeGeometry(sail), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); sm.position.set(0.01, 0.1, 0); bt.add(sm);
  const ham = new THREE.Group(); v.arms[0].add(ham); ham.position.set(0, -0.45, 0.06); ham.rotation.x = Math.PI / 2;
  wadd(ham, new THREE.CylinderGeometry(0.022, 0.022, 0.32, 5), WM(0x8a5a33), 0, -0.1, 0);
  wadd(ham, new THREE.BoxGeometry(0.14, 0.07, 0.07), WM(0x6b7178), 0, 0.07, 0);
  return { v, pose: 'hold' };
};
VENDORS.sayur = () => {
  const v = makeVillager({ shirt: 0xfef08a, pants: 0x374151, skin: 0xdba57a, hat: 'hijab', hatColor: 0x16a34a });
  apron(v, '#15803d', 'SAYUR SEGAR', '#ffffff', (x, cx, cy) => {
    x.fillStyle = '#f97316'; x.beginPath(); x.moveTo(cx - 40, cy - 20); x.lineTo(cx - 28, cy + 26); x.lineTo(cx - 16, cy - 20); x.fill();
    x.fillStyle = '#86efac'; x.beginPath(); x.arc(cx + 20, cy + 2, 24, 0, 7); x.fill();
  });
  const bk = new THREE.Group(); v.arms[1].add(bk); bk.position.set(-0.05, -0.62, 0.18);
  wadd(bk, new THREE.CylinderGeometry(0.24, 0.18, 0.16, 12), WM(0xb08150), 0, 0, 0);
  for (let i = 0; i < 4; i++) { const c = wadd(bk, new THREE.ConeGeometry(0.035, 0.2, 6), WM(0xf97316), -0.12 + i * 0.05, 0.12, -0.05); c.rotation.z = Math.PI / 2 + 0.3; }
  for (let i = 0; i < 2; i++) wadd(bk, new THREE.SphereGeometry(0.08, 8, 6), WM(0x86efac), 0.06 + i * 0.1, 0.12, 0.04);
  for (let i = 0; i < 5; i++) { const l = wadd(bk, new THREE.ConeGeometry(0.03, 0.16, 3), WM(0x15803d), -0.14 + i * 0.07, 0.2, 0.08); l.rotation.x = -0.3; }
  return { v, pose: 'hold' };
};
VENDORS.parfum = () => {
  const v = makeVillager({ shirt: 0x6b21a8, pants: 0x111827, skin: 0xc98a5a, hat: 'hair' });
  vest(v, 0x111827);
  const bowL = new THREE.Group(); v.body.add(bowL); bowL.position.set(0, 1.07, 0.3);
  for (const sx of [-1, 1]) { const b = wadd(bowL, new THREE.ConeGeometry(0.05, 0.09, 4), WM(0xfacc15), sx * 0.045, 0, 0); b.rotation.z = sx * Math.PI / 2; }
  const tr = new THREE.Group(); v.arms[1].add(tr); tr.position.set(-0.04, -0.6, 0.2);
  wadd(tr, new THREE.BoxGeometry(0.42, 0.03, 0.26), WM(0xd4a017, { metalness: 0.5, roughness: 0.3 }), 0, 0, 0);
  [[0xf472b6, -0.13], [0x60a5fa, 0], [0xfbbf24, 0.13]].forEach(([c, x]) => {
    wadd(tr, new THREE.CylinderGeometry(0.045, 0.05, 0.16, 8), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.75, roughness: 0.1, metalness: 0.1 }), x, 0.1, 0);
    wadd(tr, new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6), WM(0xd4a017, { metalness: 0.6 }), x, 0.2, 0);
    wadd(tr, new THREE.SphereGeometry(0.03, 6, 5), WM(0xe5e7eb, { metalness: 0.6 }), x, 0.24, 0);
  });
  return { v, pose: 'hold' };
};

// ---------- Day 4 appointees ----------
const LANDO = VIL[0];
const APPOINT4 = [
  { user: 'lando_094', job: 'TNI ANGKATAN LAUT', casV: LANDO, make: () => { const u = UNIFORMS.tnial(); recolor(u.v.root, 0x9c6238, 0xc98a5a); return u; } },
  { user: 'kadee_630', job: 'PENJAGA PEMANCINGAN', make: () => WORKERS.pancing(), casual: { shirt: 0x0d9488, pants: 0x374151, skin: 0xb07446, hat: 'cap', hatColor: 0x1e3a8a } },
  { user: 'zerooakubaru', job: 'PENJAGA PEMANCINGAN', make: () => { const u = WORKERS.pancing(); recolor(u.v.root, 0xb07446, 0xdba57a); recolor(u.v.root, 0x1e3a8a, 0xea580c); return u; }, casual: { shirt: 0x475569, pants: 0x1f2937, skin: 0xdba57a, hat: 'cap', hatColor: 0xea580c } },
  { user: 'flyjouze', job: 'TUKANG MIE AYAM', make: () => VENDORS.mieayam(), casual: { shirt: 0x1d4ed8, pants: 0x1f2937, skin: 0xc98a5a, hat: 'hair' } },
  { user: 'lek1321hatim', job: 'PEMBUAT KAPAL', make: () => WORKERS.kapal(), casual: { shirt: 0x92400e, pants: 0x78350f, skin: 0x9c6238, hat: 'hair' } },
  { user: 'ainiyz0', job: 'PENJUAL SAYUR', make: () => VENDORS.sayur(), casual: { shirt: 0xfde047, pants: 0x374151, skin: 0xdba57a, hat: 'hijab', hatColor: 0x16a34a } },
  { user: 'hoinos.edit1', job: 'PENJUAL PARFUM', make: () => VENDORS.parfum(), casual: { shirt: 0x0f172a, pants: 0x111827, skin: 0xc98a5a, hat: 'hair' } },
];
APPOINT4.forEach(a => {
  if (a.casV) a.cas = a.casV; else { a.cas = makeVillager(a.casual); scene.add(a.cas.root); }
  const u = a.make(); a.uni = u.v; a.ps = u.pose; scene.add(a.uni.root);
  a.tag = tagSprite('@' + a.user, '#ffffff', '#14181f', a.user.length > 11 ? 1024 : 512);
});

// ---------- new land: south-east cape (tanjung) ----------
const SEL = V(7.2, 0, 7.4);
const sel = new THREE.Group(); scene.add(sel);
sel.add(mesh(jitter(new THREE.CylinderGeometry(3.7, 4.5, 1.8, 16, 1), 0.45, true), mat(0xf2d79b), 0, SAND - 0.9, 0));
sel.add(mesh(jitter(new THREE.CylinderGeometry(1.9, 2.2, 0.45, 10, 1), 0.3, true), mat(0x7cc95a), -0.9, GRASS - 0.25, -0.9));
sel.add(palm(-1.4, GRASS, -1.2, 3.0, 0.3, 0.4));
sel.add(palm(1.6, SAND, -1.8, 2.6, 0.45, 2.1));
sel.position.copy(SEL);
const foam4 = foam.clone(); scene.add(foam4);

// ---------- Tempat Pemancingan ----------
const PM = new THREE.Group(); scene.add(PM);
PM.position.set(SEL.x + 1.9, 0, SEL.z + 1.9); PM.rotation.y = Math.PI / 4;
const pmParts = [];
const PP = (o, k0, k1, mode = 'pop') => { PM.add(o); pmParts.push({ obj: o, k0, k1, mode, s: o.scale.clone() }); return o; };
{
  const wd = mat(0x8b5a2b), pl = mat(0xb07e4f);
  for (let z = 0; z <= 4.01; z += 1.0) for (const dx of [-1.1, 1.1]) PP(mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.9, 6), wd, dx, PIER.y - 0.75, z), z / 4 * 0.25, z / 4 * 0.25 + 0.08, 'grow');
  let i = 0;
  for (let z = -0.1; z <= 4.1; z += 0.27, i++) PP(mesh(new THREE.BoxGeometry(2.4, 0.08, 0.24), i % 2 ? pl : mat(0xa3713f), 0, PIER.y, z), 0.05 + z / 4 * 0.3, 0.1 + z / 4 * 0.3);
  for (const dx of [-1.15, 1.15]) PP(mesh(new THREE.BoxGeometry(0.06, 0.06, 4.2), wd, dx, PIER.y + 0.5, 2.0), 0.4, 0.48);
  for (let z = 0; z <= 4.01; z += 0.7) for (const dx of [-1.15, 1.15]) PP(mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), wd, dx, PIER.y + 0.25, z), 0.38, 0.46);
  // saung (gazebo) at the end
  for (const [dx, dz] of [[-0.9, 2.9], [0.9, 2.9], [-0.9, 4.1], [0.9, 4.1]]) PP(mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.6, 6), wd, dx, PIER.y + 0.8, dz), 0.5, 0.6, 'grow');
  const rf = PP(mesh(new THREE.ConeGeometry(1.75, 0.9, 4), mat(0xc8a165), 0, PIER.y + 2.05, 3.5), 0.6, 0.72); rf.rotation.y = Math.PI / 4;
  PP(mesh(new THREE.BoxGeometry(1.6, 0.07, 0.36), pl, 0, PIER.y + 0.42, 3.0), 0.72, 0.78);
  for (const dx of [-0.65, 0.65]) PP(mesh(new THREE.BoxGeometry(0.06, 0.4, 0.3), wd, dx, PIER.y + 0.2, 3.0), 0.72, 0.78);
  // rods
  for (const [dx, a] of [[-0.8, -0.4], [0.0, 0], [0.8, 0.4]]) {
    const r = PP(mesh(new THREE.CylinderGeometry(0.014, 0.02, 2.2, 5), mat(0x222222), dx, PIER.y + 0.9, 4.3), 0.8, 0.88);
    r.rotation.set(0.9, 0, a);
  }
  PP(mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.28, 10), mat(0x2563eb), 0.5, PIER.y + 0.18, 2.4), 0.88, 0.94);
  // sign
  const st = canvasTex(800, 200, (x, w, h) => {
    x.fillStyle = '#0e7490'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffffff'; x.lineWidth = 12; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#ffffff'; x.font = '700 84px Poppins'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PEMANCINGAN', w / 2, h / 2 + 4);
  });
  const sg = new THREE.Group(); sg.position.set(-1.5, 0, -0.4); sg.rotation.y = Math.PI;
  sg.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6), wd, -0.8, SAND + 0.9, 0)); sg.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6), wd, 0.8, SAND + 0.9, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshStandardMaterial({ map: st, side: THREE.DoubleSide })); face.position.set(0, SAND + 1.6, 0.06); sg.add(face);
  PP(sg, 0.94, 1.0);
}
function buildPM(k) {
  for (const p of pmParts) {
    const u = clamp((k - p.k0) / (p.k1 - p.k0)); const s = p.mode === 'grow' ? ease(u) : pop(u);
    p.obj.visible = u > 0.001;
    if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s), p.s.z); else p.obj.scale.setScalar(Math.max(0.001, s));
  }
}
const pml = (x, y, z) => { PM.updateMatrixWorld(true); return PM.localToWorld(V(x, y, z)); };

// ---------- RM Padang "LAMAK BANA" ----------
const RM = new THREE.Group(); scene.add(RM);
RM.position.set(EXT.x - 2.4, SAND, EXT.z + 2.6); RM.rotation.y = 0.32;
const rmParts = [];
const RP = (o, k0, k1, mode = 'pop') => { RM.add(o); rmParts.push({ obj: o, k0, k1, mode, s: o.scale.clone() }); return o; };
{
  const gold = mat(0xd4a017, { metalness: 0.3 });
  RP(mesh(new THREE.BoxGeometry(3.8, 0.4, 2.7), mat(0x8b5a2b), 0, 0.2, 0), 0, 0.1, 'grow');
  RP(mesh(new THREE.BoxGeometry(3.5, 1.7, 2.3), mat(0x7f1d1d), 0, 1.25, -0.05), 0.1, 0.32, 'grow');
  for (const y of [0.55, 1.95]) RP(mesh(new THREE.BoxGeometry(3.56, 0.1, 2.36), gold, 0, y, -0.05), 0.32, 0.38);
  for (let i = 0; i < 7; i++) RP(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), gold, -1.5 + i * 0.5, 1.75, 1.14), 0.34, 0.4);
  const rs = new THREE.Shape(); rs.moveTo(-2.35, 1.75); rs.quadraticCurveTo(-1.2, 0.55, 0, 0.75); rs.quadraticCurveTo(1.2, 0.55, 2.35, 1.75); rs.lineTo(1.95, 0); rs.lineTo(-1.95, 0); rs.closePath();
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 2.7, bevelEnabled: false }); rg.translate(0, 0, -1.4);
  RP(mesh(rg, mat(0x3f3f46), 0, 2.05, -0.05), 0.42, 0.6);
  for (const sx of [-1, 1]) RP(mesh(new THREE.ConeGeometry(0.07, 0.35, 5), gold, sx * 2.35, 2.05 + 1.88, -0.05), 0.6, 0.66);
  // door + windows
  RP(mesh(new THREE.BoxGeometry(0.6, 1.0, 0.05), mat(0x451a03), 0.9, 0.95, 1.12, false), 0.66, 0.72);
  // etalase with stacked plates
  RP(mesh(new THREE.BoxGeometry(1.7, 0.6, 0.6), mat(0x7c2d12), -0.6, 0.7, 1.45), 0.7, 0.76);
  RP(mesh(new THREE.BoxGeometry(1.7, 0.75, 0.6), new THREE.MeshStandardMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.4, roughness: 0.1 }), -0.6, 1.38, 1.45, false), 0.74, 0.8);
  const dishes = [0xea580c, 0x92400e, 0xdc2626, 0xfbbf24, 0x65a30d, 0xb45309];
  let di = 0;
  for (let lv = 0; lv < 3; lv++) for (let j = 0; j < 4 - lv; j++) {
    const x = -0.6 - (3 - lv) * 0.19 + j * 0.38 + 0.19, y = 1.06 + lv * 0.2;
    RP(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.04, 10), mat(0xffffff), x, y, 1.45, false), 0.8 + di * 0.012, 0.86 + di * 0.012);
    RP(mesh(new THREE.SphereGeometry(0.09, 6, 4), mat(dishes[di % 6]), x, y + 0.06, 1.45, false), 0.8 + di * 0.012, 0.86 + di * 0.012);
    di++;
  }
  // sign
  const st = canvasTex(1024, 300, (x, w, h) => {
    x.fillStyle = '#b91c1c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#facc15'; x.lineWidth = 14; x.strokeRect(12, 12, w - 24, h - 24);
    x.fillStyle = '#facc15'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 52px Poppins'; x.fillText('RUMAH MAKAN PADANG', w / 2, 82);
    x.font = '700 120px Poppins'; x.fillText('LAMAK BANA', w / 2, 192);
  });
  const sm = new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0 });
  RP(mesh(new THREE.BoxGeometry(2.9, 0.85, 0.1), [mat(0xb91c1c), mat(0xb91c1c), mat(0xb91c1c), mat(0xb91c1c), sm, mat(0xb91c1c)], 0, 2.55, 1.32), 0.9, 1.0);
}
function buildRM(k) {
  for (const p of rmParts) {
    const u = clamp((k - p.k0) / (p.k1 - p.k0)); const s = p.mode === 'grow' ? ease(u) : pop(u);
    p.obj.visible = u > 0.001;
    if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s), p.s.z); else p.obj.scale.setScalar(Math.max(0.001, s));
  }
}
const rml = (x, y, z) => { RM.updateMatrixWorld(true); return RM.localToWorld(V(x, y, z)); };
const tagPM = tagSprite('usulan @kadee_630 & @zerooakubaru', '#ffd23f', '#3a2300', 1024);
const tagRM = tagSprite('usulan @ruryfauziah', '#ffd23f', '#3a2300', 1024);

// ---------- UI overlays ----------
function overlay(html, style) {
  const d = document.createElement('div'); d.innerHTML = html;
  Object.assign(d.style, { position: 'absolute', fontFamily: 'Poppins, sans-serif', opacity: '0', transformOrigin: '50% 50%', ...style });
  document.getElementById('ui').appendChild(d); return d;
}
const plusBadge = overlay('<div style="font-size:30px;font-weight:700;color:#14532d">+25</div><div style="font-size:13px;font-weight:700;color:#14532d;letter-spacing:1px">PENDUDUK BARU</div>',
  { left: '50%', top: '150px', marginLeft: '-95px', width: '190px', textAlign: 'center', background: '#bbf7d0', border: '4px solid #fff', borderRadius: '18px', padding: '8px 0', boxShadow: '0 6px 16px rgba(0,0,0,.25)' });
const WELCOME = ['eygellpermanasembiring', 'kriukk_______', 'cittamahasandika_ganteng228', 'smyxvw', 'adamibrahimmakmur', 'arch1v3barc', 'ezra_ajjjj', 'ainiyz0', 'mizarhng', 'hoinos.edit1', 'lek1321hatim', 'zyunn60', 'dhoooo__13',
  'flyjouze', 'i_okey2', 'aqi_laimup', 'akmdsbr', '_5e7a1_', 'tmpa58', 'itzur.ashraf', 'laba_laba_lokal', 'zeyaa918'];
const wel = overlay(`<div style="font-size:12px;letter-spacing:2px;font-weight:700;color:#0e7490;text-align:center">🏝️ SELAMAT DATANG</div>
<div style="font-size:21px;font-weight:700;color:#0f172a;text-align:center;margin-bottom:8px">PENDUDUK BARU</div>
<div style="height:232px;overflow:hidden;position:relative"><div id="welList" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;position:absolute;left:0;right:0;top:0">
${WELCOME.map(n => `<div style="font-size:12.5px;font-weight:700;color:#1e293b;background:#e0f2fe;border-radius:8px;padding:5px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">@${n}</div>`).join('')}
</div></div><div style="font-size:12px;font-weight:700;color:#0e7490;text-align:center;margin-top:8px">+3 lainnya</div>`,
  { left: '34px', right: '34px', top: '120px', background: 'rgba(255,255,255,.96)', borderRadius: '18px', padding: '14px 14px 12px', boxShadow: '0 8px 22px rgba(0,0,0,.3)' });
const welList = wel.querySelector('#welList');
const later = overlay(`<div style="font-size:11px;letter-spacing:1.6px;font-weight:700;color:#7a5a1a">DILANTIK MENYUSUL</div>
<div style="margin-top:8px;font-size:15px;font-weight:700;color:#1a1d21">@tetii_efaridha · <span style="color:#b91c1c">DOKTER</span></div>
<div style="font-size:12px;color:#5a4a2a;font-weight:500">menunggu klinik dibangun</div>
<div style="margin-top:8px;font-size:15px;font-weight:700;color:#1a1d21">@jamalae32 · <span style="color:#b91c1c">GURU</span></div>
<div style="font-size:12px;color:#5a4a2a;font-weight:500">menunggu sekolah dibangun</div>`,
  { left: '40px', right: '40px', top: '120px', background: '#fffaf0', border: '3px solid #c9a227', borderRadius: '14px', padding: '14px 18px', boxShadow: '0 6px 18px rgba(0,0,0,.3)' });

// ---------- timeline ----------
const NARR4 = [
  [0.2, 3.4, 'Ini Pulau Netizen.'],
  [3.4, 7.0, 'Pulau yang dibangun dari komentar kalian. Komen paling rame, besok saya bangun, biar pulaunya makin bagus.'],
  [7.1, 9.9, 'Day 4. Pulaunya… nambah luas lagi.'],
  [10.1, 13.0, 'Penduduk sekarang… delapan puluh empat!'],
  [13.1, 15.9, 'Bertambah dua puluh lima orang dari kemarin.'],
  [16.1, 21.0, 'Selamat datang, penduduk baru! Anggap saja rumah sendiri.'],
  [21.1, 25.0, 'Dari kemarin banyak yang minta tempat pemancingan.'],
  [25.1, 31.0, 'Oke… kita bangun!'],
  [31.1, 34.0, 'Lalu… ada yang minta rumah makan Padang.'],
  [34.1, 40.0, 'Namanya… Lamak Bana! Biar penduduk makan enak tiap hari.'],
  [40.1, 42.4, 'Sekarang… pelantikan pegawai baru.'],
  [42.5, 45.4, 'TNI Angkatan Laut. Siap jaga pelabuhan!'],
  [45.4, 48.3, 'Penjaga pemancingan.'],
  [48.3, 51.2, 'Penjaga pemancingan… yang kedua.'],
  [51.2, 54.1, 'Tukang mie ayam. Jangan lupa pangsitnya.'],
  [54.1, 57.0, 'Pembuat kapal. Kapal buat nelayan… kamu yang buat.'],
  [57.0, 59.9, 'Penjual sayur. Biar penduduk sehat.'],
  [59.9, 62.8, 'Penjual parfum. Biar pulau wangi.'],
  [63.0, 67.0, 'Dokter dan guru… dilantik menyusul, setelah klinik dan sekolahnya jadi.'],
  [67.1, 69.9, 'Besok bangun apa lagi?'],
  [70.0, 73.0, 'Follow biar jadi penduduk. Komen, mau dibangun apa.'],
];
window.NARR = NARR4;
const CMT4 = [
  { a: 21.2, b: 23.1, name: 'kadee_630', ago: '2h', col: '#64748b', text: 'Ak jadi warga dong, buatin tempat pemancingan' },
  { a: 23.1, b: 25.0, name: 'zerooakubaru', ago: '2h', col: '#0f766e', text: 'bang mau jadi warga juga dong, tapi mau buat tempat pemancingan' },
  { a: 31.2, b: 34.0, name: 'ruryfauziah', ago: '1h', col: '#9d174d', text: 'Jual nasi Padang dong Bg tanjung .. nama rumah makannya LAMAK BANA' },
];
const CUTS4 = [10, 16, 21, 25, 31, 34, 40, 63, 67];
const L4X = [-1.4, -0.55, 0.3, 1.15, 2.0, 2.85, 3.7];
const SLOT = 2.9, CER0 = 42.5;

function renderAt4(t, rt = t) {
  updateOcean(rt);
  const fs = 1 + Math.sin(rt * 1.6) * 0.012;
  foam.scale.x = foam.scale.y = fs; foam.position.y = 0.1 + Math.sin(rt * 1.6) * 0.03;
  foam2.scale.set(0.84 * fs, 0.84 * fs, 0.25); foam2.position.set(EXT.x, foam.position.y, EXT.z); foam2.visible = true;
  foam3.scale.set(0.86 * fs, 0.86 * fs, 0.25); foam3.position.set(NORTH.x, foam.position.y, NORTH.z); foam3.visible = true;
  foam4.scale.set(0.55 * fs, 0.55 * fs, 0.25); foam4.position.set(SEL.x, foam.position.y, SEL.z);

  let cam, focus = V(0, 0, 3), tod = 0, night = 0, az = 0.7;
  let cpos = V(-0.3, SAND, 5.7), crot = -0.3;
  const P = { t };
  let selK = 1, pmK = 1, rmK = 1, signText = 'PENDUDUK: 84';
  crab.visible = false; tagLando.visible = false; tagTetii.visible = false; tagHouse.visible = false; tagPM.visible = false; tagRM.visible = false;
  torch.visible = false; torchL.intensity = 0;
  boat.scale.setScalar(1.6); boat.rotation.set(0, Math.PI / 2, 0);
  boat.position.set(BOAT_DOCK, waveH(BOAT_DOCK, 1, rt) + 0.05, 1.0); boat.rotation.z = Math.sin(rt * 1.7) * 0.04;
  buildWarung(1); WG.visible = true; mmSign.scale.setScalar(1);
  bulbM.emissiveIntensity = 0.3; lamp.intensity = 0; lampIn.intensity = 0; mmFace.emissiveIntensity = 0;
  ext.position.y = 0; ext.visible = true; north.position.y = 0; north.visible = true;
  buildHouses(3); HOUSES.forEach(h => h.visible = true);
  cere.visible = t >= 40 && t < 63;
  CONF.forEach(c => c.m.visible = false); poof(V(), 0);
  VIL.forEach(v => v.root.visible = false);
  APPOINT.forEach(a => { a.cas.root.visible = false; a.uni.root.visible = false; a.tag.visible = false; });
  APPOINT4.forEach(a => { if (a.cas !== LANDO) a.cas.root.visible = false; a.uni.root.visible = false; a.tag.visible = false; });
  clockEl.style.display = 'none'; sk.style.opacity = 0;
  plusBadge.style.opacity = 0; wel.style.opacity = 0; later.style.opacity = 0;
  const showDay3Staff = (pts) => APPOINT.forEach((a, i) => { const p = pts[i]; if (!p) return; const m = a.uni; m.root.visible = true; m.root.position.set(p[0], SAND, p[1]); m.root.rotation.y = p[2] ?? 0; applyHeldPose(m, a.ps); });

  if (t < 10) { // intro + SE land rises
    selK = ease(seg(t, 7.2, 9.6)); pmK = 0; rmK = 0; signText = 'PENDUDUK: 59';
    cam = shot(t, 0, 10, V(16, 50, 46), V(9, 30, 28), V(-1.5, 0, 0.0), V(0.5, 0, 1.5));
    focus = V(0, 0, 1);
  } else if (t < 16) { // counter 59 -> 84 and +25
    pmK = 0; rmK = 0;
    const ck = ease(seg(t, 10.5, 12.6));
    signText = t > 12.6 ? 'PENDUDUK: 84' : `PENDUDUK: ${Math.round(59 + 25 * ck)}`;
    VIL.forEach((v, i) => { v.root.visible = true; v.root.position.set(GATHER[i][0], SAND, GATHER[i][1]); v.root.rotation.y = faceTo(v.root.position, -0.5, 12); vPose(v, { t, cheer: t > 12.7 ? ease(seg(t, 12.7, 13.1)) : 0, ph: i * 1.3 }); });
    cpos = V(-0.3, SAND, 5.7); crot = -0.35; P.talk = 1;
    if (t > 12.7) P.wave = ease(seg(t, 12.7, 13.1));
    board.scale.setScalar(t > 10.5 && t < 12.7 ? 1 + 0.05 * Math.abs(Math.sin(t * 40)) : (t >= 12.6 ? 1 + 0.18 * Math.sin(seg(t, 12.6, 13.1) * Math.PI) : 1));
    cam = shot(t, 10, 16, V(1.0, 3.3, 14.8), V(0.5, 3.1, 13.8), V(0.1, 1.5, 4.6), V(0.0, 1.5, 4.6));
    focus = V(0.5, 0, 5);
    const k = pop(seg(t, 13.1, 13.5)); plusBadge.style.opacity = t > 13.1 ? Math.min(1, k * 1.5) : 0; plusBadge.style.transform = `scale(${Math.max(0.01, k)})`;
  } else if (t < 21) { // welcome new residents
    pmK = 0; rmK = 0;
    VIL.forEach((v, i) => { v.root.visible = true; const a = i * 0.8; v.root.position.set(NORTH.x + Math.cos(a) * 3.0, GRASS, NORTH.z + 3.6 + Math.sin(a) * 1.2); v.root.rotation.y = faceTo(v.root.position, 4, 0); vPose(v, { t, cheer: 1, ph: i }); });
    cpos = V(NORTH.x + 0.4, GRASS, NORTH.z + 5.2); crot = 0.5; P.wave = 1;
    cam = shot(t, 16, 21, V(7.0, 6.0, 2.5), V(6.0, 5.6, 1.5), V(0.6, 1.0, -9.5), V(0.6, 1.0, -10.0));
    focus = V(1, 0, -9);
    const k = pop(seg(t, 16.2, 16.6)); wel.style.opacity = Math.min(1, k * 1.5) * (1 - seg(t, 20.7, 21)); wel.style.transform = `scale(${Math.max(0.01, k)})`;
    welList.style.transform = `translateY(${-Math.max(0, 316 - 232) * ease(seg(t, 17.2, 20.2))}px)`;
  } else if (t < 25) { // pemancingan request
    pmK = 0; rmK = 0;
    cpos = V(SEL.x - 0.4, SAND, SEL.z + 0.4); crot = Math.PI / 4 + 0.3; P.talk = 1;
    APPOINT4.forEach((a, i) => { if (i === 1 || i === 2) { const m = a.cas; m.root.visible = true; m.root.position.set(SEL.x - 2.6 + (i - 1) * 0.9, SAND, SEL.z - 0.8 + (i - 1) * 0.4); m.root.rotation.y = faceTo(m.root.position, SEL.x + 3, SEL.z + 3); vPose(m, { t }); } });
    cam = shot(t, 21, 25, V(SEL.x - 7.5, 5.4, SEL.z + 11.0), V(SEL.x - 6.8, 5.0, SEL.z + 10.2), V(SEL.x + 1.0, 0.8, SEL.z + 1.0), V(SEL.x + 1.2, 0.8, SEL.z + 1.2));
    focus = V(SEL.x + 1, 0, SEL.z + 1);
  } else if (t < 31) { // timelapse pemancingan
    pmK = seg(t, 25.3, 30.6); rmK = 0;
    tod = ease(seg(t, 28.5, 31)) * 0.3; az = lerp(-0.6, 1.6, seg(t, 25, 31));
    const w = pml(1.6, 0, Math.min(3.8, pmK * 4.2)); cpos = V(w.x, pmK > 0.1 ? PIER.y + 0.04 : SAND, w.z); crot = Math.PI / 4 - Math.PI / 2;
    P.hammer = 1; P.tool = 'hammer'; P.t = t * 1.6;
    cam = shot(t, 25, 31, V(SEL.x - 7.0, 9.6, SEL.z + 13.5), V(SEL.x - 5.8, 8.4, SEL.z + 12.4), V(PM.position.x + 1.2, 0.6, PM.position.z + 1.2), V(PM.position.x + 1.4, 0.9, PM.position.z + 1.4));
    focus = V(PM.position.x + 1.4, 0, PM.position.z + 1.4);
    clockEl.style.display = 'block';
    const hr = 8 + pmK * 9, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60);
    clockT.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; clockL.textContent = 'x24 TIME-LAPSE';
    if (t > 30.3) { tagPM.visible = true; tagPM.position.copy(pml(-0.6, 3.1, 1.4)); tagPM.scale.set(4.0, 0.37, 1); }
  } else if (t < 34) { // RM Padang request
    rmK = 0; tod = 0.1;
    cpos = rml(1.2, 0, 3.0); cpos.y = SAND; crot = RM.rotation.y + Math.PI * 0.85; P.talk = 1;
    showDay3Staff([[-6.6, 5.2, 0.6], null, null, null, [-7.4, 6.0, 0.3]]);
    cam = shot(t, 31, 34, V(EXT.x + 5.0, 4.8, EXT.z + 14.5), V(EXT.x + 4.4, 4.5, EXT.z + 13.6), V(EXT.x - 1.6, 1.2, EXT.z + 2.4), V(EXT.x - 1.8, 1.3, EXT.z + 2.4));
    focus = V(EXT.x - 1.5, 0, EXT.z + 2.5);
  } else if (t < 40) { // timelapse RM + reveal
    rmK = seg(t, 34.2, 38.6);
    tod = lerp(0.1, 0.5, seg(t, 34, 40)); az = lerp(-0.4, 1.8, seg(t, 34, 40));
    const w = rml(-2.4, 0, 1.8); cpos = V(w.x, SAND, w.z); crot = faceTo(cpos, RM.position.x, RM.position.z);
    if (t < 38.6) { P.hammer = 1; P.tool = 'hammer'; P.t = t * 1.6; } else { P.wave = ease(seg(t, 38.6, 39)); }
    showDay3Staff([[-6.6, 5.2, -0.3], null, null, null, [-7.4, 6.0, -0.4]]);
    VIL.forEach((v, i) => { if (i > 2) return; v.root.visible = true; const p = rml([-2.6, 2.6, -3.4][i], 0, [3.4, 3.4, 1.6][i]); v.root.position.set(p.x, SAND, p.z); v.root.rotation.y = faceTo(v.root.position, RM.position.x, RM.position.z); vPose(v, t < 38.6 ? { t: t * 1.6, hammer: 1, ph: i * 1.7 } : { t, cheer: 1, ph: i }); });
    cam = shot(t, 34, 40, V(EXT.x + 5.0, 6.4, EXT.z + 15.5), V(EXT.x + 3.8, 4.8, EXT.z + 13.8), V(RM.position.x, 1.2, RM.position.z), V(RM.position.x, 1.8, RM.position.z));
    focus = RM.position.clone();
    clockEl.style.display = t < 38.6 ? 'block' : 'none';
    const hr = 8 + rmK * 9, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60);
    clockT.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (t > 38.7) { tagRM.visible = true; tagRM.position.copy(rml(0, 4.6, 1.3)); const k = pop(seg(t, 38.7, 39.1)); tagRM.scale.set(4.0 * k + 0.001, 0.38 * k + 0.001, 1); }
  } else if (t < 63) { // ceremony
    tod = 0.15; az = 0.4;
    cpos = BT_SPOT.clone(); crot = Math.PI / 2; P.talk = 1;
    const idx = t < CER0 ? -1 : Math.min(6, Math.floor((t - CER0) / SLOT));
    APPOINT4.forEach((a, i) => {
      const slot = V(L4X[i], SAND, LINE_Z);
      let pos = slot.clone(), faceY = 0, uniformOn = i < idx, walk = 0;
      const lt = (t - CER0) - i * SLOT;
      if (i === idx) {
        if (lt < 0.6) { pos = vlerp(slot, SPOT, ease(lt / 0.6)); walk = lt * 11; faceY = Math.atan2(SPOT.x - slot.x, SPOT.z - slot.z); }
        else if (lt < 2.2) { pos = SPOT.clone(); faceY = -Math.PI / 2; uniformOn = lt > 1.5; }
        else { pos = vlerp(SPOT, slot, ease((lt - 2.2) / 0.65)); walk = lt * 11; faceY = Math.atan2(slot.x - SPOT.x, slot.z - SPOT.z); uniformOn = true; }
        poof(SPOT, seg(lt, 1.5, 2.1));
        sk.style.opacity = lt > 0.4 && lt < 2.8 ? Math.min(1, (lt - 0.4) * 5, (2.8 - lt) * 5) : 0;
        sk.style.transform = `scale(${lerp(0.85, 1, pop(seg(lt, 0.4, 0.7)))})`;
        skUser.textContent = '@' + a.user; skJob.textContent = a.job;
        skStamp.style.opacity = lt > 1.5 ? 1 : 0; skStamp.style.transform = `rotate(-14deg) scale(${lt > 1.5 ? lerp(1.6, 1, pop(seg(lt, 1.5, 1.75))) : 1})`;
        if (lt > 0.7 && lt < 1.5) P.hold = 1;
      }
      const m = uniformOn ? a.uni : a.cas;
      (uniformOn ? a.cas : a.uni).root.visible = false;
      m.root.visible = true; m.root.position.copy(pos); m.root.rotation.y = faceY;
      if (uniformOn && !walk) applyHeldPose(m, a.ps); else vPose(m, { walk, t, ph: i });
      if (i === idx && !walk && lt > 0.7 && lt < 1.5) m.arms[1].rotation.set(-1.25, 0, 0.1);
      a.tag.visible = i === idx; a.tag.position.copy(pos).add(V(0, 2.0, 0)); a.tag.scale.set(a.user.length > 11 ? 4.0 : 2.0, 0.38, 1);
    });
    VIL.forEach((v, i) => {
      if (i < 1 || i > 4) return; v.root.visible = true;
      const p = [null, [-3.2, 6.6], [-3.6, 5.6], [5.8, 6.4], [6.2, 5.4]][i];
      v.root.position.set(p[0], SAND, p[1]); v.root.rotation.y = faceTo(v.root.position, 1.6, 5.7);
      const lt = t - CER0 - Math.max(0, idx) * SLOT;
      vPose(v, { t, cheer: idx >= 0 && lt > 1.5 && lt < 2.5 ? 1 : 0, ph: i });
    });
    if (t < CER0) cam = shot(t, 40, CER0, V(1.6, 4.0, 16.0), V(1.6, 3.4, 14.6), V(1.6, 1.6, 4.0), V(1.6, 1.5, 4.2));
    else cam = { pos: V(1.65, 2.7, 13.2 + Math.sin(t * 0.3) * 0.15), look: V(1.65, 1.55, 4.8) };
    focus = V(1.6, 0, 5);
  } else if (t < 67) { // dilantik menyusul + group
    tod = 0.3; az = 0.4;
    cpos = V(1.65, SAND, 6.1); crot = 0; P.talk = 1;
    APPOINT4.forEach((a, i) => {
      const m = a.uni; m.root.visible = true; if (a.cas === LANDO) LANDO.root.visible = false;
      m.root.position.set(-1.6 + i * 1.05, SAND, 5.0 + Math.abs(i - 3) * 0.25); m.root.rotation.y = faceTo(m.root.position, 1.65, 13);
      applyHeldPose(m, a.ps);
      if (i === 0) m.arms[1].quaternion.setFromUnitVectors(V(0, -1, 0), V(-0.28, 0.78, 0.56).normalize());
    });
    CONF.forEach(c => { c.m.visible = true; const y = c.y0 - ((t - 63) * c.sp) % 4.2; c.m.position.set(1.6 + c.x + Math.sin(t * 2 + c.ph) * 0.2, SAND + Math.max(0.05, y), 5.4 + c.z); c.m.rotation.set(t * 3 + c.ph, t * 2 + c.ph, 0); });
    cam = shot(t, 63, 67, V(1.8, 3.0, 14.6), V(1.8, 2.8, 13.6), V(1.6, 1.3, 5.0), V(1.6, 1.3, 5.0));
    focus = V(1.6, 0, 5);
    const k = pop(seg(t, 63.3, 63.7)); later.style.opacity = Math.min(1, k * 1.5) * (1 - seg(t, 66.6, 67)); later.style.transform = `scale(${Math.max(0.01, k)})`;
  } else { // CTA sunset
    tod = 1; az = -0.15;
    signText = t > 67.6 ? 'PENDUDUK: 84 → ?' : 'PENDUDUK: 84';
    board.scale.setScalar(t > 67.6 ? 1 + 0.15 * Math.sin(seg(t, 67.6, 68.1) * Math.PI) : 1);
    cpos = V(-0.4, SAND, 5.6); crot = -0.15; P.talk = 1;
    if (t > 70.1) P.wave = ease(seg(t, 70.1, 70.5));
    cam = shot(t, 67, 73, V(0.8, 2.4, 12.4), V(0.2, 2.3, 11.2), V(-0.8, 1.95, 5.0), V(-0.9, 1.95, 5.0));
    focus = V(-0.8, 0, 5);
    [0, 3].forEach((i, j) => { const m = APPOINT4[i].uni; m.root.visible = true; m.root.position.set(0.9 + j * 1.0, SAND, 4.4 + j * 0.4); m.root.rotation.y = faceTo(m.root.position, 0, 12); applyHeldPose(m, APPOINT4[i].ps); });
    LANDO.root.visible = false;
  }
  if (t >= 40 && t < 63) { /* lando casual handled in ceremony */ } else if (!(t >= 10 && t < 21)) LANDO.root.visible = false;

  sel.position.y = lerp(-2.6, 0, selK); sel.visible = selK > 0.01; foam4.visible = selK > 0.9;
  buildPM(pmK); PM.visible = pmK > 0.001;
  buildRM(rmK); RM.visible = rmK > 0.001;

  ch.root.position.copy(cpos); ch.root.rotation.y = crot;
  pose(ch, P);
  if (P.hold) ch.arms[1].rotation.set(-1.25, 0, 0.15);
  sign.position.y = SAND;
  setSign(signText);

  setSky(tod, night, az);
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 35);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);

  const c = CMT4.find(c => t >= c.a && t < c.b);
  if (c) {
    cname.textContent = c.name; cago.textContent = c.ago; ctext.textContent = c.text; cav.textContent = c.name[0].toUpperCase(); cav.style.background = c.col;
    const k = pop(seg(t, c.a, c.a + 0.3)), o = 1 - seg(t, c.b - 0.2, c.b);
    cmtEl.style.opacity = Math.min(1, k * 1.5) * o; cmtEl.style.transform = `scale(${Math.max(0.01, k)})`;
  } else cmtEl.style.opacity = 0;
  const introRules = t >= 3.6 && t < 7.0, ctaRules = t >= 70.0;
  [[r1, 3.7, 70.1], [r2, 3.95, 70.35], [r3, 4.2, 70.6]].forEach(([el, a0, b0]) => {
    const t0 = introRules ? a0 : b0; const k = pop(seg(t, t0, t0 + 0.35));
    const on = introRules || ctaRules; el.style.opacity = on ? Math.min(1, k * 1.5) * (introRules ? 1 - seg(t, 6.7, 7.0) : 1) : 0; el.style.transform = `scale(${Math.max(0.01, k)})`;
  });
  const dc = Math.min(...CUTS4.map(c => t >= c ? t - c : 99));
  let fl = dc < 0.12 ? (1 - dc / 0.12) * 0.35 : 0;
  if (t >= CER0 && t < CER0 + 7 * SLOT) { const lt = (t - CER0) % SLOT; if (lt > 1.5 && lt < 1.72) fl = Math.max(fl, (1 - (lt - 1.5) / 0.22) * 0.5); }
  flash.style.opacity = fl;

  renderer.render(scene, camera);
}

window.DURATION = D4DUR;
window.renderAt = (t, rt) => { window.__t = t; renderAt4(t, rt ?? t); };

// ================= LIFE: blink, breathing, mouth (runs inside HQ render wrapper) =================
{
  const chars = [];
  const add = (body, head, ph) => {
    if (!body || !head) return;
    const eyes = [];
    head.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius < 0.045 && o.material.color && o.material.color.getHex() === 0x1c1410) eyes.push(o); });
    chars.push({ body, head, eyes, ph });
  };
  add(ch.body, ch.head, 0.3);
  VIL.forEach((v, i) => add(v.body, v.head, 1.1 + i * 0.77));
  if (typeof APPOINT !== 'undefined') APPOINT.forEach((a, i) => { add(a.cas.body, a.cas.head, 2.3 + i); add(a.uni.body, a.uni.head, 2.3 + i); });
  if (typeof APPOINT4 !== 'undefined') APPOINT4.forEach((a, i) => { if (a.cas !== VIL[0]) add(a.cas.body, a.cas.head, 4.1 + i * 0.6); add(a.uni.body, a.uni.head, 4.1 + i * 0.6); });
  // Bang Tanjung mouth under the mustache
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x4a1a10 }));
  mouth.position.set(0, -0.175, 0.27); ch.head.add(mouth);
  window.__life = (t) => {
    chars.forEach(c => {
      const b = ((t + c.ph) % 3.6) < 0.11;
      c.eyes.forEach(e => e.scale.y = b ? 0.12 : 1);
      c.body.scale.set(1 + 0.006 * Math.sin(t * 2.2 + c.ph), 1 + 0.014 * Math.sin(t * 2.2 + c.ph), 1);
    });
    const talking = Math.abs(ch.head.rotation.x) > 1e-4;
    mouth.scale.y = talking ? 0.4 + 1.6 * Math.abs(Math.sin(t * 13)) * (0.6 + 0.4 * Math.sin(t * 3.1)) : 0.4;
  };
}

// ================= LAYOUT BARU (mulai Day 5): pulau diperluas, Pasar & Kuliner ditata rapi =================
// Daratan barat = daratan memanjang besar. Deret belakang = 4 slot bangunan (menghadap selatan),
// tengah = jalan pasar berpaving, depan = 14 lapak pedagang dengan papan nama jualan.
const PASAR = V(-17.2, 0, 1.6);
const PASAR_S = { x: 11.2, z: 6.4 }; // half-size of the land (top)
{
  while (ext.children.length) ext.remove(ext.children[0]);
  const land = mesh(new THREE.CylinderGeometry(1, 1.1, 1.8, 34, 1), mat(0xf2d79b), 0, SAND - 0.9, 0);
  land.scale.set(PASAR_S.x, 1, PASAR_S.z); ext.add(land);
  const grass = mesh(new THREE.CylinderGeometry(1, 1.1, 0.5, 26, 1), mat(0x7cc95a), 0, GRASS - 0.25, -4.1);
  grass.scale.set(9.8, 1, 1.85); ext.add(grass);
  for (let i = 0; i < 8; i++) ext.add(palm(-9.0 + i * 2.57, GRASS, -4.4 - (i % 2) * 0.55, 2.9 + (i % 3) * 0.25, 0.18, i * 1.3));
  for (let i = 0; i < 36; i++) ext.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 3), mat(0x4f9d3a), -9 + R() * 18, GRASS + 0.12, -5.2 + R() * 1.7, false));
  // street: paving stones east-west
  const pave = [mat(0xd8c7a3), mat(0xcbb990)];
  for (let x = -10.2; x <= 10.2; x += 0.62) for (let z = 0.55; z <= 1.6; z += 0.52)
    ext.add(mesh(new THREE.BoxGeometry(0.58, 0.05, 0.48), pave[(Math.round(x / 0.62) + Math.round(z / 0.52)) % 2], x, SAND + 0.02, z, false));
  for (const x of [-10.0, -5.0, 0, 5.0, 10.0]) {
    ext.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), mat(0x374151), x, SAND + 1.2, 0.3));
    ext.add(mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffd27a, emissiveIntensity: 0.4 }), x, SAND + 2.45, 0.3, false));
  }
  // gapura (gate) on the east end
  const gp = mat(0x7f1d1d);
  for (const z of [0.2, 2.0]) ext.add(mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), gp, 10.9, SAND + 1.3, z));
  const gt = canvasTex(1024, 200, (x, w, h) => { x.fillStyle = '#7f1d1d'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.font = '800 96px Poppins'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('PASAR PULAU', w / 2, h / 2 + 4); });
  const gb = mesh(new THREE.BoxGeometry(0.2, 0.5, 2.5), [new THREE.MeshStandardMaterial({ map: gt }), new THREE.MeshStandardMaterial({ map: gt }), gp, gp, gp, gp], 10.9, SAND + 2.75, 1.1); ext.add(gb);
  ext.position.copy(PASAR);
}
// building row: 4 slots, evenly spaced
const PASAR_SLOTS = [-7.5, -2.5, 2.5, 7.5].map(x => V(PASAR.x + x, SAND, PASAR.z - 1.55));
RM.position.copy(PASAR_SLOTS[0]); RM.rotation.y = 0;
WG.position.copy(PASAR_SLOTS[1]); WG.position.z -= 0.1; WG.rotation.y = 0;
const KAVLING = [];
function makeKavling(p) {
  const g = new THREE.Group(); scene.add(g); g.position.copy(p);
  const wd = mat(0x8b5a2b);
  for (const [x, z] of [[-1.7, -1.2], [1.7, -1.2], [-1.7, 1.2], [1.7, 1.2]]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 5), wd, x, 0.3, z));
  for (const z of [-1.2, 1.2]) g.add(mesh(new THREE.BoxGeometry(3.4, 0.04, 0.04), mat(0xf59e0b), 0, 0.5, z));
  for (const x of [-1.7, 1.7]) g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 2.4), mat(0xf59e0b), x, 0.5, 0));
  const t = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#fff8e6'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8b5a2b'; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14);
    x.fillStyle = '#7a4b00'; x.font = '800 64px Poppins'; x.textAlign = 'center'; x.fillText('KAVLING', w / 2, 100);
    x.font = '700 40px Poppins'; x.fillText('usulan berikutnya', w / 2, 170);
  });
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 5), wd, 0, 0.7, 1.25));
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.65, 0.05), [wd, wd, wd, wd, new THREE.MeshStandardMaterial({ map: t }), wd], 0, 1.35, 1.3));
  KAVLING.push(g); return g;
}
makeKavling(PASAR_SLOTS[2]); makeKavling(PASAR_SLOTS[3]);

// lapak with sign boards: [owner username, what they sell, awning color]
const LAPAK_JUAL = [
  ['zyx_naww', 'SEBLAK', 0xef4444], ['ghitssna', 'BUNGA', 0xec4899], ['kasmir_994', 'IKAN SEGAR', 0x0ea5e9],
  ['flyjouze', 'MIE AYAM', 0xf59e0b], ['ainiyz0', 'SAYUR', 0x22c55e], ['hoinos.edit1', 'PARFUM', 0x8b5cf6],
  ['nindriluvita7', 'ES TEH JUMBO', 0x14b8a6], ['nyong__01__', 'SEGERA BUKA', 0xf97316], ['_attyyyy1', 'SEGERA BUKA', 0x84cc16],
  [null, 'DISEWAKAN', 0x64748b], [null, 'DISEWAKAN', 0x3b82f6], [null, 'DISEWAKAN', 0xa855f7], [null, 'DISEWAKAN', 0xeab308], [null, 'DISEWAKAN', 0x0f766e],
];
const LAPAK = [];
function lapakSign(text, col) {
  return canvasTex(512, 160, (x, w, h) => {
    x.fillStyle = '#fff8e6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#' + new THREE.Color(col).getHexString(); x.fillRect(0, 0, w, 18); x.fillRect(0, h - 18, w, 18);
    x.fillStyle = text === 'DISEWAKAN' || text === 'SEGERA BUKA' ? '#6b7280' : '#14181f';
    let fs = 76; x.font = `800 ${fs}px Poppins`; while (x.measureText(text).width > w - 40 && fs > 30) { fs -= 4; x.font = `800 ${fs}px Poppins`; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 3);
  });
}
{
  const n = LAPAK_JUAL.length, step = 1.45, x0 = -step * (n - 1) / 2;
  LAPAK_JUAL.forEach(([owner, label, col], i) => {
    const x = x0 + i * step, g = new THREE.Group(); scene.add(g);
    g.position.set(PASAR.x + x, SAND, PASAR.z + 3.25);
    const wd = mat(0x9a6a3a);
    g.add(mesh(new THREE.BoxGeometry(1.15, 0.08, 0.6), mat(0xb07e4f), 0, 0.78, 0));
    const sm = new THREE.MeshStandardMaterial({ map: lapakSign(label, col), roughness: 0.8 });
    g.add(mesh(new THREE.BoxGeometry(1.12, 0.5, 0.05), [wd, wd, wd, wd, sm, wd], 0, 0.45, 0.28));
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.28, 0.28]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), wd, sx, 1.1, sz));
    const roof = mesh(new THREE.BoxGeometry(1.3, 0.06, 0.95), mat(col), 0, 2.24, 0.05); roof.rotation.x = -0.18; g.add(roof);
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(0.3, 0.12, 0.02), mat(k % 2 ? 0xffffff : col), -0.48 + k * 0.32, 2.12, 0.53, false));
    LAPAK.push({ g, owner, label, vendor: V(PASAR.x + x, SAND, PASAR.z + 2.72) });
  });
}
// kampung diperluas
north.scale.set(1.3, 1, 1.3);
const NORTH_R = 5.3 * 1.3;
const layoutFoam = (fs, y) => {
  foam2.position.set(PASAR.x, y, PASAR.z); foam2.scale.set(PASAR_S.x * 1.09 / 7.25 * fs, PASAR_S.z * 1.12 / 7.25 * fs, 0.25); foam2.visible = true;
  foam3.position.set(NORTH.x, y, NORTH.z); foam3.scale.set(0.86 * 1.3 * fs, 0.86 * 1.3 * fs, 0.25); foam3.visible = true;
};
// kampung: rumah diperbanyak & dirapikan (2 deret x 4, jalan tengah dari pulau utama)
{
  const pos = [[-2.3, 1.4], [2.3, 1.4], [4.8, 1.4], [-4.8, 1.4], [-2.3, -2.6], [2.3, -2.6], [-4.8, -2.6], [4.8, -2.6]];
  HOUSES.forEach((h, i) => { h.position.set(NORTH.x + pos[i][0], GRASS, NORTH.z + pos[i][1]); h.rotation.y = 0; });
  const cols = [[0xca8a04, 0xe7cfa6], [0x7c3aed, 0xd6b48a], [0x0f766e, 0xe7cfa6], [0xdb2777, 0xd2ab7f], [0xb91c1c, 0xd6b48a]];
  for (let i = HOUSES.length; i < pos.length; i++) { const [r, w] = cols[i - 3]; HOUSES.push(makeHouse(pos[i][0], pos[i][1], r, w, 0, i)); }
}

// ================= DESA TANI: daratan kebun & ternak warga (game "Kebunku") =================
const DESA = { x0: -36.4, z0: -5.2, cols: 6, rows: 8, PW: 5.0, PD: 5.2 };
DESA.W = DESA.cols * DESA.PW + 1.4; DESA.D = DESA.rows * DESA.PD + 1.6;
DESA.cx = DESA.x0 + DESA.W / 2; DESA.cz = DESA.z0 - DESA.D / 2;
const desa = new THREE.Group(); scene.add(desa);
{
  // land: sand base + grass top, rounded corners via scaled cylinders at the corners
  const sandM = mat(0xf2d79b), grassM = mat(0x86cf62);
  desa.add(mesh(new THREE.BoxGeometry(DESA.W, 1.8, DESA.D), sandM, DESA.cx, SAND - 0.9, DESA.cz));
  desa.add(mesh(new THREE.BoxGeometry(DESA.W - 1.0, 0.1, DESA.D - 1.0), grassM, DESA.cx, SAND + 0.0, DESA.cz));
  // gate
  const gp = mat(0x14532d);
  const gx = -17.2, gz = DESA.z0 - 0.2;
  for (const dx of [-1.1, 1.1]) desa.add(mesh(new THREE.BoxGeometry(0.22, 2.4, 0.22), gp, gx + dx, SAND + 1.2, gz));
  const gt = canvasTex(1024, 200, (x, w, h) => { x.fillStyle = '#14532d'; x.fillRect(0, 0, w, h); x.fillStyle = '#fde68a'; x.font = '800 96px Poppins'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🌾 DESA TANI', w / 2, h / 2 + 4); });
  desa.add(mesh(new THREE.BoxGeometry(2.6, 0.5, 0.18), [gp, gp, gp, gp, new THREE.MeshStandardMaterial({ map: gt }), new THREE.MeshStandardMaterial({ map: gt })], gx, SAND + 2.55, gz));
  // a few palms on the outer edge
  for (let i = 0; i < 7; i++) desa.add(palm(DESA.x0 + 0.5, SAND, DESA.z0 - 3 - i * 5.6, 2.8 + (i % 3) * 0.3, 0.2, i));
}
// plot slot origin (center of plot), plot faces +z (south)
const desaPlot = i => {
  const c = i % DESA.cols, r = Math.floor(i / DESA.cols);
  return V(DESA.x0 + 0.7 + DESA.PW * (c + 0.5), SAND + 0.05, DESA.z0 - 0.8 - DESA.PD * (r + 0.5));
};
// walkers keep to the paths between plots (only the inner farm area of a CLAIMED plot is blocked)
const DESA_TAKEN = new Set();
const desaBlocked = (x, z) => {
  if (x < DESA.x0 || x > DESA.x0 + DESA.W || z > DESA.z0 || z < DESA.z0 - DESA.D) return false;
  const c = Math.floor((x - DESA.x0 - 0.7) / DESA.PW), r = Math.floor((DESA.z0 - 0.8 - z) / DESA.PD);
  if (c < 0 || r < 0 || c >= DESA.cols || r >= DESA.rows) return false;
  if (!DESA_TAKEN.has(r * DESA.cols + c)) return false;
  const p = desaPlot(r * DESA.cols + c);
  return Math.abs(x - p.x) < DESA.PW / 2 - 0.55 && Math.abs(z - p.z) < DESA.PD / 2 - 0.75;
};

// ================= RUMAH BANG TANJUNG (ikon pulau, di atas bukit pulau utama) =================
// Atap berbentuk CAPING raksasa, dinding belang oranye-putih seperti kaosnya, hiasan KUMIS di atas pintu,
// teras dengan kursi goyang, KOTAK KOMEN NETIZEN, dan bendera merah putih di puncak caping.
const RBT = new THREE.Group(); scene.add(RBT);
const RBT_POS = V(-1.55, 0, -3.15);
const rbtParts = [];
const RBP = (o, k0, k1, mode = 'pop') => { RBT.add(o); rbtParts.push({ obj: o, k0, k1, mode, s: o.scale.clone() }); return o; };
let RBT_Y = 2.3;
{
  // find the hill top under the footprint
  scene.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(); let top = 0;
  for (const [dx, dz] of [[0, 0], [-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) {
    rc.set(V(RBT_POS.x + dx, 20, RBT_POS.z + dz), V(0, -1, 0)); const h = rc.intersectObjects([island.children[1], island.children[2]], false)[0]; if (h) top = Math.max(top, h.point.y);
  }
  RBT_Y = Math.min(top, 2.4) + 0.45;
  RBT.position.set(RBT_POS.x, 0, RBT_POS.z); RBT.rotation.y = 0.18;
  const Y = RBT_Y, wood = mat(0x7c4a1e), wood2 = mat(0xa0663a);
  // stilts
  for (const [x, z] of [[-1.2, -0.95], [1.2, -0.95], [-1.2, 0.95], [1.2, 0.95], [0, -0.95], [0, 0.95]]) RBP(mesh(new THREE.CylinderGeometry(0.09, 0.11, Y + 0.6, 7), wood, x, (Y - 0.6) / 2, z), 0, 0.12, 'grow');
  // floor + veranda
  RBP(mesh(new THREE.BoxGeometry(2.9, 0.16, 2.4), wood2, 0, Y, 0), 0.1, 0.2);
  RBP(mesh(new THREE.BoxGeometry(2.9, 0.12, 1.0), mat(0xb07e4f), 0, Y - 0.02, 1.65), 0.16, 0.24);
  for (const x of [-1.4, -0.7, 0.7, 1.4]) RBP(mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), wood, x, Y + 0.3, 2.12), 0.22, 0.28);
  RBP(mesh(new THREE.BoxGeometry(2.9, 0.06, 0.06), wood, 0, Y + 0.55, 2.12), 0.24, 0.3);
  // walls with orange-white stripes (his shirt!)
  const stripes = canvasTex(512, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#f97316'; x.fillRect(0, i * h / 8, w, h / 8 + 1); } });
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  const wallM = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.85 });
  RBP(mesh(new THREE.BoxGeometry(2.5, 1.45, 2.0), wallM, 0, Y + 0.8, 0), 0.26, 0.48, 'grow');
  // door + kumis (mustache) carving above it
  RBP(mesh(new THREE.BoxGeometry(0.62, 1.0, 0.05), mat(0x5b3a1e), 0, Y + 0.58, 1.02, false), 0.5, 0.56);
  RBP(mesh(new THREE.SphereGeometry(0.04, 6, 5), mat(0xfacc15, { metalness: 0.6 }), 0.2, Y + 0.6, 1.06, false), 0.54, 0.58);
  const kum = new THREE.Group(); kum.position.set(0, Y + 1.22, 1.03);
  for (const sx of [-1, 1]) { const k = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0x1c1410), sx * 0.2, 0, 0, false); k.scale.set(1.25, 0.36, 0.3); k.rotation.z = sx * -0.28; kum.add(k);
    kum.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0x1c1410), sx * 0.44, 0.07, 0, false)); }
  RBP(kum, 0.56, 0.62);
  // round porthole windows
  for (const sx of [-1, 1]) {
    RBP(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16), mat(0x7c4a1e), sx * 0.85, Y + 0.95, 1.02, false), 0.58, 0.64).rotation.x = Math.PI / 2;
    RBP(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xbfe3ff, emissive: 0xffd27a, emissiveIntensity: 0.15 }), sx * 0.85, Y + 0.95, 1.04, false), 0.6, 0.66).rotation.x = Math.PI / 2;
  }
  // CAPING roof: huge straw cone with weave lines + brim + red band
  const weave = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#e3c27a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c9a25a'; x.lineWidth = 6; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } x.strokeStyle = '#b8914f'; x.lineWidth = 4; for (let j = 0; j < h; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); } });
  const capM = new THREE.MeshStandardMaterial({ map: weave, roughness: 0.9 });
  RBP(mesh(new THREE.ConeGeometry(2.35, 1.55, 28, 1), capM, 0, Y + 2.3, 0), 0.66, 0.8);
  RBP(mesh(new THREE.CylinderGeometry(2.38, 2.38, 0.1, 28), mat(0xc1121f), 0, Y + 1.58, 0), 0.78, 0.84);
  RBP(mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xe3c27a), 0, Y + 3.1, 0), 0.8, 0.86);
  // flag on the tip
  RBP(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 5), mat(0xe5e7eb), 0, Y + 3.6, 0), 0.84, 0.9, 'grow');
  const flag = new THREE.Group(); flag.position.set(0, Y + 3.95, 0);
  flag.add(mesh(new THREE.BoxGeometry(0.55, 0.16, 0.02), mat(0xdc2626), 0.29, 0.08, 0, false)); flag.add(mesh(new THREE.BoxGeometry(0.55, 0.16, 0.02), mat(0xffffff), 0.29, -0.08, 0, false));
  RBP(flag, 0.88, 0.94); RBT.userData.flag = flag;
  // name board
  const nb = canvasTex(1024, 256, (x, w, h) => { x.fillStyle = '#7c4a1e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#facc15'; x.lineWidth = 12; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#fde68a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 76px Poppins'; x.fillText('RUMAH BANG TANJUNG', w / 2, 100); x.font = '700 54px Poppins'; x.fillStyle = '#ffffff'; x.fillText('Kepala Pulau Netizen', w / 2, 190); });
  const nm = new THREE.MeshStandardMaterial({ map: nb });
  RBP(mesh(new THREE.BoxGeometry(1.7, 0.42, 0.06), [wood, wood, wood, wood, nm, wood], 0.55, Y + 0.42, 2.17), 0.86, 0.92);
  // rocking chair + coffee table on the veranda
  const chair = new THREE.Group(); chair.position.set(-0.95, Y + 0.08, 1.6); chair.rotation.y = 0.5;
  chair.add(mesh(new THREE.BoxGeometry(0.45, 0.06, 0.42), wood2, 0, 0.35, 0)); chair.add(mesh(new THREE.BoxGeometry(0.45, 0.5, 0.06), wood2, 0, 0.6, -0.2));
  for (const sx of [-1, 1]) { const r = mesh(new THREE.TorusGeometry(0.35, 0.025, 4, 12, Math.PI * 0.6), wood, sx * 0.2, 0.32, 0, false); r.rotation.set(0, Math.PI / 2, Math.PI * 1.2); chair.add(r); }
  RBP(chair, 0.9, 0.95); RBT.userData.chair = chair;
  const tbl = new THREE.Group(); tbl.position.set(-0.35, Y + 0.08, 1.65);
  tbl.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), wood2, 0, 0.32, 0)); tbl.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), wood, 0, 0.15, 0));
  tbl.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 8), mat(0xffffff), 0.05, 0.38, 0, false)); // kopi
  RBP(tbl, 0.92, 0.96);
  // stairs down the hill
  for (let i = 0; i < 6; i++) RBP(mesh(new THREE.BoxGeometry(0.7, 0.08, 0.32), wood2, 1.0, Y - 0.15 - i * 0.32, 2.35 + i * 0.3), 0.2 + i * 0.01, 0.28 + i * 0.01);
  // KOTAK KOMEN NETIZEN (mailbox)
  const mb = new THREE.Group(); mb.position.set(1.85, 0, 3.6);
  { rc.set(V(RBT_POS.x + 1.85, 20, RBT_POS.z + 3.6), V(0, -1, 0)); const h = rc.intersectObjects([island.children[0], island.children[1], island.children[2]], false)[0]; mb.position.y = h ? h.point.y : GRASS; }
  mb.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), wood, 0, 0.45, 0));
  mb.add(mesh(new THREE.BoxGeometry(0.42, 0.32, 0.3), mat(0xdc2626), 0, 0.98, 0));
  const mbt = canvasTex(512, 200, (x, w, h) => { x.fillStyle = '#dc2626'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 64px Poppins'; x.fillText('KOTAK KOMEN', w / 2, 70); x.font = '700 46px Poppins'; x.fillText('NETIZEN 💬', w / 2, 145); });
  mb.add(mesh(new THREE.BoxGeometry(0.43, 0.2, 0.31), [mat(0xdc2626), mat(0xdc2626), mat(0xdc2626), mat(0xdc2626), new THREE.MeshStandardMaterial({ map: mbt }), mat(0xdc2626)], 0, 1.25, 0, false));
  mb.add(mesh(new THREE.BoxGeometry(0.2, 0.025, 0.02), mat(0x111111), 0, 1.04, 0.16, false));
  RBP(mb, 0.94, 0.99); RBT.userData.mb = mb;
  // flower bushes around
  for (const [x, z, c] of [[-1.7, 1.5, 0xf472b6], [1.75, 1.2, 0xfacc15], [-1.75, -0.4, 0xef4444]]) RBP(mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(0x3f9d3a), x, Y - 0.25, z), 0.95, 0.99);
}
function buildRBT(k) {
  for (const p of rbtParts) {
    const u = clamp((k - p.k0) / (p.k1 - p.k0)); const s = p.mode === 'grow' ? ease(u) : pop(u);
    p.obj.visible = u > 0.001;
    if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s), p.s.z); else p.obj.scale.setScalar(Math.max(0.001, s));
  }
}
const rbtl = (x, y, z) => { RBT.updateMatrixWorld(true); return RBT.localToWorld(V(x, y, z)); };
const rbtTick = t => { const f = RBT.userData.flag; if (f) f.children.forEach((c, i) => c.rotation.y = Math.sin(t * 4 + i) * 0.15); const c = RBT.userData.chair; if (c) c.rotation.x = Math.sin(t * 1.8) * 0.06; };
buildRBT(1);
// palms right next to the house would hide it: move them aside
island.children.forEach(c => { if (c.isGroup && Math.hypot(c.position.x - RBT_POS.x, c.position.z - RBT_POS.z) < 3.6) c.visible = false; });

// ================= FASILITAS UMUM (timur laut): KLINIK + SEKOLAH, dan kostum dokter & guru =================
const FAS = V(12.6, 0, -8.6);
const fasL = new THREE.Group(); scene.add(fasL);
fasL.add(mesh(jitter(new THREE.CylinderGeometry(5.0, 5.9, 1.8, 20, 1), 0.35, true), mat(0xf2d79b), 0, SAND - 0.9, 0));
fasL.add(mesh(jitter(new THREE.CylinderGeometry(3.9, 4.3, 0.5, 16, 1), 0.3, true), mat(0x7cc95a), 0, GRASS - 0.25, -0.4));
for (const [x, z, h] of [[-3.6, -2.6, 3.0], [3.9, -2.0, 3.2], [0.2, -4.1, 2.8]]) fasL.add(palm(x, GRASS, z, h, 0.2, x));
fasL.position.copy(FAS);
const foam5 = foam.clone(); scene.add(foam5);
// paths
for (let i = 0; i < 9; i++) fasL.add(mesh(new THREE.BoxGeometry(0.55, 0.05, 0.45), mat(0xd8c7a3), -0.0, GRASS + 0.02, 3.6 - i * 0.55, false));
const FB = new THREE.Group(); scene.add(FB); FB.position.copy(FAS);
const fbParts = [];
const FP = (o, k0, k1, mode = 'pop') => { FB.add(o); fbParts.push({ obj: o, k0, k1, mode, s: o.scale.clone() }); return o; };
function buildFB(k) { for (const p of fbParts) { const u = clamp((k - p.k0) / (p.k1 - p.k0)), s = p.mode === 'grow' ? ease(u) : pop(u); p.obj.visible = u > 0.001; if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s), p.s.z); else p.obj.scale.setScalar(Math.max(0.001, s)); } }
const signBoard = (txt, sub, bg, fg) => canvasTex(1024, 256, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffffff'; x.lineWidth = 12; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 88px Poppins'; x.fillText(txt, w / 2, sub ? 100 : h / 2); if (sub) { x.font = '700 50px Poppins'; x.fillText(sub, w / 2, 192); } });
// ---- KLINIK (kiri) ----
{
  const g = new THREE.Group(); g.position.set(-1.9, GRASS, -0.6); FB.add(g);
  const P = (o, a, b, m) => { g.add(o); fbParts.push({ obj: o, k0: a, k1: b, mode: m || 'pop', s: o.scale.clone() }); return o; };
  P(mesh(new THREE.BoxGeometry(3.0, 0.16, 2.4), mat(0xcbd5e1), 0, 0.08, 0), 0.0, 0.08);
  P(mesh(new THREE.BoxGeometry(2.8, 1.6, 2.2), mat(0xf8fafc), 0, 0.96, 0), 0.06, 0.26, 'grow');
  P(mesh(new THREE.BoxGeometry(3.1, 0.16, 2.5), mat(0x16a34a), 0, 1.84, 0), 0.24, 0.32);
  P(mesh(new THREE.BoxGeometry(2.86, 0.22, 0.06), mat(0x16a34a), 0, 1.5, 1.12, false), 0.26, 0.32);
  P(mesh(new THREE.BoxGeometry(0.7, 1.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xbfe3ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }), 0, 0.68, 1.12, false), 0.3, 0.36);
  for (const sx of [-1, 1]) P(mesh(new THREE.BoxGeometry(0.55, 0.45, 0.05), mat(0xbfe3ff), sx * 0.95, 0.95, 1.12, false), 0.32, 0.38);
  // green plus sign on top
  const cross = new THREE.Group(); cross.position.set(0, 2.45, 0.2);
  const cm = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.5 });
  cross.add(mesh(new THREE.BoxGeometry(0.7, 0.22, 0.12), cm, 0, 0, 0)); cross.add(mesh(new THREE.BoxGeometry(0.22, 0.7, 0.12), cm, 0, 0, 0));
  P(cross, 0.36, 0.42);
  const sm = new THREE.MeshStandardMaterial({ map: signBoard('KLINIK PULAU', 'buka 24 jam', '#15803d', '#ffffff') });
  P(mesh(new THREE.BoxGeometry(2.2, 0.55, 0.06), [mat(0x15803d), mat(0x15803d), mat(0x15803d), mat(0x15803d), sm, mat(0x15803d)], 0, 2.05, 1.25), 0.38, 0.44);
  // bench + potted plant
  P(mesh(new THREE.BoxGeometry(0.8, 0.08, 0.3), mat(0x8b5a2b), 1.0, 0.45, 1.6), 0.42, 0.46);
  P(mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0x3f9d3a), -1.1, 0.5, 1.5), 0.44, 0.48);
}
// ---- SEKOLAH (kanan) ----
{
  const g = new THREE.Group(); g.position.set(2.0, GRASS, -0.9); g.rotation.y = -0.12; FB.add(g);
  const P = (o, a, b, m) => { g.add(o); fbParts.push({ obj: o, k0: a, k1: b, mode: m || 'pop', s: o.scale.clone() }); return o; };
  P(mesh(new THREE.BoxGeometry(3.4, 0.16, 2.3), mat(0xd6d3d1), 0, 0.08, 0), 0.5, 0.58);
  P(mesh(new THREE.BoxGeometry(3.2, 1.5, 2.1), mat(0xfef3c7), 0, 0.9, 0), 0.56, 0.74, 'grow');
  const sh = new THREE.Shape(); sh.moveTo(-1.85, 0); sh.lineTo(1.85, 0); sh.lineTo(0, 0.9); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: 2.4, bevelEnabled: false }); rg.translate(0, 0, -1.2);
  const roof = new THREE.Mesh(rg, mat(0xb91c1c)); roof.castShadow = true; roof.position.y = 1.65; P(roof, 0.72, 0.8);
  for (let i = 0; i < 3; i++) P(mesh(new THREE.BoxGeometry(0.6, 0.5, 0.05), mat(0xbfe3ff), -1.05 + i * 1.05, 1.0, 1.07, false), 0.78 + i * 0.01, 0.82 + i * 0.01);
  P(mesh(new THREE.BoxGeometry(0.55, 0.9, 0.05), mat(0x7c4a1e), 1.25, 0.55, 1.07, false), 0.8, 0.84);
  const sm = new THREE.MeshStandardMaterial({ map: signBoard('SD PULAU NETIZEN', 'Belajar setiap hari', '#1d4ed8', '#ffffff') });
  P(mesh(new THREE.BoxGeometry(2.4, 0.55, 0.06), [mat(0x1d4ed8), mat(0x1d4ed8), mat(0x1d4ed8), mat(0x1d4ed8), sm, mat(0x1d4ed8)], 0, 2.05, 1.25), 0.84, 0.88);
  // bell tower + flag pole
  P(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), mat(0xe5e7eb), -2.2, 1.3, 1.3), 0.86, 0.9, 'grow');
  const fl = new THREE.Group(); fl.position.set(-2.2, 2.45, 1.3); fl.add(mesh(new THREE.BoxGeometry(0.55, 0.16, 0.02), mat(0xdc2626), 0.29, 0.08, 0, false)); fl.add(mesh(new THREE.BoxGeometry(0.55, 0.16, 0.02), mat(0xffffff), 0.29, -0.08, 0, false));
  P(fl, 0.88, 0.92); FB.userData.flag = fl;
  // swing (ayunan)
  const sw = new THREE.Group(); sw.position.set(2.4, 0, 2.0);
  for (const sx of [-1, 1]) sw.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 5), mat(0xef4444), sx * 0.45, 0.65, 0));
  sw.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 5), mat(0xef4444), 0, 1.3, 0)).rotation.z = Math.PI / 2;
  sw.add(mesh(new THREE.BoxGeometry(0.35, 0.04, 0.18), mat(0xfacc15), 0, 0.45, 0));
  P(sw, 0.92, 0.97);
}
const fbl = (x, y, z) => { FB.updateMatrixWorld(true); return FB.localToWorld(V(x, y, z)); };
const fbTick = t => { const f = FB.userData.flag; if (f) f.children.forEach((c, i) => c.rotation.y = Math.sin(t * 4 + i) * 0.15); };
buildFB(1);

// ---- kostum dokter & guru ----
function stetho(v) {
  const t = wadd(v.body, new THREE.TorusGeometry(0.2, 0.014, 5, 18, Math.PI * 1.4), WM(0x111827), 0, 1.02, 0.12); t.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI * 0.8);
  wadd(v.body, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), WM(0xc0c6cc, { metalness: 0.7 }), 0.08, 0.83, 0.32).rotation.x = Math.PI / 2;
}
WORKERS.dokter = () => {
  const v = makeVillager({ shirt: 0xffffff, pants: 0x334155, skin: 0xdba57a, hat: 'hijab', hatColor: 0x93c5fd });
  for (const sx of [-1, 1]) wadd(v.body, new THREE.BoxGeometry(0.05, 0.55, 0.02), WM(0xe2e8f0), sx * 0.07, 0.75, 0.33); // coat edges
  wadd(v.body, new THREE.BoxGeometry(0.1, 0.06, 0.02), WM(0x93c5fd), -0.15, 0.95, 0.31);
  stetho(v);
  const cb = new THREE.Group(); v.arms[1].add(cb); cb.position.set(-0.03, -0.58, 0.14);
  wadd(cb, new THREE.BoxGeometry(0.2, 0.26, 0.02), WM(0x8b5a2b), 0, 0, 0); wadd(cb, new THREE.BoxGeometry(0.17, 0.2, 0.021), WM(0xffffff), 0, -0.02, 0.002);
  wadd(cb, new THREE.BoxGeometry(0.06, 0.03, 0.03), WM(0xc0c6cc, { metalness: 0.7 }), 0, 0.13, 0.01);
  return { v, pose: 'hold' };
};
const batikTex = wtex(256, 256, (x, w, h) => { x.fillStyle = '#7c2d12'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fbbf24'; x.lineWidth = 5; for (let y = 0; y < h; y += 48) for (let xx = 0; xx < w; xx += 48) { x.beginPath(); x.arc(xx + 24, y + 24, 15, 0, 7); x.stroke(); x.beginPath(); x.moveTo(xx, y + 24); x.lineTo(xx + 24, y); x.lineTo(xx + 48, y + 24); x.lineTo(xx + 24, y + 48); x.closePath(); x.stroke(); } });
function book(v, col) { const bk = new THREE.Group(); v.arms[1].add(bk); bk.position.set(-0.03, -0.58, 0.14); wadd(bk, new THREE.BoxGeometry(0.22, 0.28, 0.06), WM(col), 0, 0, 0); wadd(bk, new THREE.BoxGeometry(0.2, 0.26, 0.061), WM(0xffffff), 0.012, 0, 0); }
function glasses(v) { for (const sx of [-1, 1]) wadd(v.head, new THREE.TorusGeometry(0.06, 0.012, 5, 12), WM(0x111827), sx * 0.1, 0.05, 0.28); wadd(v.head, new THREE.BoxGeometry(0.07, 0.012, 0.012), WM(0x111827), 0, 0.06, 0.29); }
WORKERS.guru = () => {
  const v = makeVillager({ shirt: 0x7c2d12, pants: 0x111827, skin: 0xb07446, hat: 'peci' });
  const t = v.body.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry'); if (t) t.material = new THREE.MeshStandardMaterial({ map: batikTex, roughness: 0.85 });
  glasses(v); book(v, 0x1d4ed8);
  return { v, pose: 'hold' };
};
WORKERS.guru2 = () => {
  const v = makeVillager({ shirt: 0xf8fafc, pants: 0x1e3a5f, skin: 0xc98a5a, hat: 'hijab', hatColor: 0x7f1d1d });
  wadd(v.body, new THREE.BoxGeometry(0.1, 0.06, 0.02), WM(0x1e3a5f), -0.15, 0.95, 0.31);
  glasses(v); book(v, 0xdc2626);
  return { v, pose: 'hold' };
};
// =====================================================================
// DAY 6 WORLD (web): Masjid Pulau + jembatan, Sewa Jetski, kostum nazir & petugas jetski
// =====================================================================
// ---------------------------------------------------------------------
// MASJID PULAU — pulau kecil baru di utara Fasilitas Umum
// ---------------------------------------------------------------------
const MSJ = V(14.6, 0, -19.6);
const msjL = new THREE.Group(); scene.add(msjL); msjL.position.copy(MSJ);
msjL.add(mesh(jitter(new THREE.CylinderGeometry(4.4, 5.2, 1.8, 20, 1), 0.3, true), mat(0xf2d79b), 0, SAND - 0.9, 0));
msjL.add(mesh(jitter(new THREE.CylinderGeometry(3.5, 3.9, 0.5, 16, 1), 0.25, true), mat(0x7cc95a), 0, GRASS - 0.25, -0.3));
for (const [x, z, h] of [[-3.1, -1.9, 2.9], [3.2, -1.6, 3.1], [-2.6, 2.3, 2.6]]) msjL.add(palm(x, GRASS, z, h, 0.2, x * 2));
for (let i = 0; i < 6; i++) msjL.add(mesh(new THREE.BoxGeometry(0.55, 0.05, 0.45), mat(0xd8c7a3), 0, GRASS + 0.02, 3.3 - i * 0.5, false));
const foam6 = foam.clone(); scene.add(foam6);
// bridge from Fasilitas Umum (north tip) to the masjid islet (south tip)
const BRG = new THREE.Group(); scene.add(BRG);
{
  const a = V(FAS.x + 0.9, 0, FAS.z - 5.0), b = V(MSJ.x - 0.6, 0, MSJ.z + 4.4);
  const d = b.clone().sub(a), L = d.length(), ang = Math.atan2(d.x, d.z);
  const n = Math.round(L / 0.42);
  for (let i = 0; i <= n; i++) { const p = vlerp(a, b, i / n); const pl = mesh(new THREE.BoxGeometry(1.2, 0.07, 0.34), mat(i % 2 ? 0x9a6a3a : 0xa97c4f), p.x, SAND + 0.05, p.z); pl.rotation.y = ang; BRG.add(pl); }
  for (let i = 0; i <= n; i += 3) for (const sx of [-0.6, 0.6]) { const p = vlerp(a, b, i / n); const o = V(Math.cos(ang) * sx, 0, -Math.sin(ang) * sx); BRG.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), mat(0x7a5230), p.x + o.x, SAND + 0.2, p.z + o.z)); }
  for (const sx of [-0.6, 0.6]) { const o = V(Math.cos(ang) * sx, 0, -Math.sin(ang) * sx); const r = mesh(new THREE.BoxGeometry(0.05, 0.05, L), mat(0x7a5230), (a.x + b.x) / 2 + o.x, SAND + 0.62, (a.z + b.z) / 2 + o.z); r.rotation.y = ang; BRG.add(r); }
}
const MB = new THREE.Group(); scene.add(MB); MB.position.set(MSJ.x, GRASS, MSJ.z - 0.4);
const mbParts = [];
const MP = (o, k0, k1, mode = 'pop') => { MB.add(o); mbParts.push({ obj: o, k0, k1, mode, s: o.scale.clone() }); return o; };
function buildMB(k) { for (const p of mbParts) { const u = clamp((k - p.k0) / (p.k1 - p.k0)), s = p.mode === 'grow' ? ease(u) : pop(u); p.obj.visible = u > 0.001; if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s * p.s.y), p.s.z); else p.obj.scale.setScalar(Math.max(0.001, s)); } }
{
  const white = mat(0xf8fafc), cream = mat(0xefe6d2), green = mat(0x15803d, { roughness: 0.45 }), gold = mat(0xe0b43a, { metalness: 0.6, roughness: 0.3 }), dark = mat(0x3b2a1e);
  const g = (geo, m, x, y, z) => mesh(geo, m, x, y, z);
  // floor / terrace
  MP(g(new THREE.BoxGeometry(4.6, 0.22, 4.0), mat(0xd6cfc0), 0, 0.11, 0.2), 0.0, 0.12, 'grow');
  // main hall (grows up)
  const hall = new THREE.Group(); hall.position.set(0, 0.22, 0); hall.add(g(new THREE.BoxGeometry(3.4, 1.9, 2.8), white, 0, 0.95, 0));
  // green trim band + arched door + windows
  hall.add(g(new THREE.BoxGeometry(3.46, 0.12, 2.86), green, 0, 1.86, 0));
  hall.add(g(new THREE.BoxGeometry(0.8, 1.15, 0.06), dark, 0, 0.58, 1.41));
  hall.add(g(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 14, 1, false, 0, Math.PI), dark, 0, 1.15, 1.41)).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  for (const x of [-1.15, 1.15]) { hall.add(g(new THREE.BoxGeometry(0.5, 0.7, 0.06), mat(0x7dd3fc, { roughness: 0.2 }), x, 0.95, 1.41)); hall.add(g(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12, 1, false, 0, Math.PI), mat(0x7dd3fc, { roughness: 0.2 }), x, 1.3, 1.41)).rotation.set(Math.PI / 2, 0, Math.PI / 2); }
  for (const z of [-0.7, 0.7]) for (const sx of [-1, 1]) hall.add(g(new THREE.BoxGeometry(0.06, 0.7, 0.45), mat(0x7dd3fc, { roughness: 0.2 }), sx * 1.71, 0.95, z));
  MP(hall, 0.12, 0.42, 'grow');
  // porch roof (serambi) + pillars
  const por = new THREE.Group(); por.position.set(0, 0.22, 1.75);
  for (const x of [-1.5, -0.5, 0.5, 1.5]) por.add(g(new THREE.CylinderGeometry(0.07, 0.08, 1.4, 8), cream, x, 0.7, 0.3));
  por.add(g(new THREE.BoxGeometry(3.5, 0.12, 0.9), green, 0, 1.45, 0.15));
  MP(por, 0.4, 0.52);
  // drum + big dome + finial
  MP(g(new THREE.CylinderGeometry(1.05, 1.1, 0.4, 20), white, 0, 2.32, 0), 0.5, 0.6);
  const dome = g(new THREE.SphereGeometry(1.08, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), green, 0, 2.5, 0); dome.scale.y = 1.15;
  MP(dome, 0.58, 0.72);
  const fin = new THREE.Group(); fin.position.set(0, 3.75, 0);
  fin.add(g(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), gold, 0, 0.2, 0));
  fin.add(g(new THREE.SphereGeometry(0.08, 8, 6), gold, 0, 0.12, 0));
  const cr = g(new THREE.TorusGeometry(0.17, 0.035, 6, 18, Math.PI * 1.35), gold, 0, 0.58, 0); cr.rotation.z = -0.6 + Math.PI * 0.5; fin.add(cr);
  MP(fin, 0.72, 0.8);
  // small corner domes
  for (const sx of [-1, 1]) { const d = g(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), green, sx * 1.35, 2.12, 1.05); MP(d, 0.6, 0.7); }
  // minaret (right back)
  const mn = new THREE.Group(); mn.position.set(1.95, 0.22, -1.2);
  mn.add(g(new THREE.CylinderGeometry(0.27, 0.32, 3.6, 10), white, 0, 1.8, 0));
  for (const y of [1.2, 2.4]) mn.add(g(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), green, 0, y, 0));
  mn.add(g(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12), green, 0, 3.6, 0));
  mn.add(g(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 10), white, 0, 3.9, 0));
  const md = g(new THREE.ConeGeometry(0.3, 0.55, 12), green, 0, 4.42, 0); mn.add(md);
  mn.add(g(new THREE.SphereGeometry(0.06, 6, 5), gold, 0, 4.75, 0));
  MP(mn, 0.42, 0.66, 'grow');
  // sign board in front
  const st = canvasTex(1024, 256, (x, w, h) => { x.fillStyle = '#15803d'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e0b43a'; x.lineWidth = 14; x.strokeRect(9, 9, w - 18, h - 18);
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 96px Poppins'; x.fillText('MASJID PULAU', w / 2, 104); x.font = '700 48px Poppins'; x.fillStyle = '#fde68a'; x.fillText('Pulau Netizen', w / 2, 190); });
  const sg = new THREE.Group(); sg.position.set(-1.2, 0, 3.15);
  for (const x of [-0.55, 0.55]) sg.add(g(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5), mat(0x7a5230), x, 0.5, 0));
  sg.add(g(new THREE.BoxGeometry(1.3, 0.34, 0.05), [mat(0x15803d), mat(0x15803d), mat(0x15803d), mat(0x15803d), new THREE.MeshStandardMaterial({ map: st }), mat(0x15803d)], 0, 0.95, 0.02));
  MP(sg, 0.82, 0.9);
  // beduk (drum) under the porch, wudhu tap wall, sandals
  const bd = new THREE.Group(); bd.position.set(1.7, 0.22, 2.25);
  bd.add(g(new THREE.BoxGeometry(0.6, 0.4, 0.3), mat(0x7a5230), 0, 0.2, 0));
  const drum = g(new THREE.CylinderGeometry(0.28, 0.28, 0.55, 14), mat(0x9a3412), 0, 0.62, 0); drum.rotation.z = Math.PI / 2; bd.add(drum);
  for (const sx of [-1, 1]) { const f = g(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 14), mat(0xe7d3a8), sx * 0.29, 0.62, 0); f.rotation.z = Math.PI / 2; bd.add(f); }
  MP(bd, 0.88, 0.95);
  for (let i = 0; i < 4; i++) MP(g(new THREE.BoxGeometry(0.12, 0.03, 0.22), mat([0x1d4ed8, 0x111827, 0xb91c1c, 0x15803d][i]), -0.7 + i * 0.3, 0.24, 2.55), 0.9, 0.97);
}

// ---------------------------------------------------------------------
// SEWA JETSKI — ponton terapung di Pelabuhan (selatan dermaga)
// ---------------------------------------------------------------------
const JET = V(12.4, 0, 4.6);
const JT = new THREE.Group(); scene.add(JT); JT.position.copy(JET);
const jtParts = [];
const JP = (o, k0, k1, mode = 'pop') => { JT.add(o); jtParts.push({ obj: o, k0, k1, mode, s: o.scale.clone() }); return o; };
function buildJT(k) { for (const p of jtParts) { const u = clamp((k - p.k0) / (p.k1 - p.k0)), s = p.mode === 'grow' ? ease(u) : pop(u); p.obj.visible = u > 0.001; if (p.mode === 'grow') p.obj.scale.set(p.s.x, Math.max(0.001, s * p.s.y), p.s.z); else p.obj.scale.setScalar(Math.max(0.001, s)); } }
function makeJetski(col) {
  const j = new THREE.Group();
  const hull = mesh(new THREE.BoxGeometry(0.62, 0.26, 1.5), mat(0xf8fafc, { roughness: 0.35 }), 0, 0.13, 0); j.add(hull);
  const nose = mesh(new THREE.ConeGeometry(0.31, 0.62, 4), mat(0xf8fafc, { roughness: 0.35 }), 0, 0.13, 1.05); nose.rotation.set(Math.PI / 2, Math.PI / 4, 0); nose.scale.set(1, 1, 0.42); j.add(nose);
  const top = mesh(new THREE.BoxGeometry(0.56, 0.16, 1.0), mat(col, { roughness: 0.35 }), 0, 0.33, 0.25); j.add(top);
  const hood = mesh(new THREE.ConeGeometry(0.28, 0.5, 4), mat(col, { roughness: 0.35 }), 0, 0.33, 0.95); hood.rotation.set(Math.PI / 2, Math.PI / 4, 0); hood.scale.set(1, 1, 0.3); j.add(hood);
  j.add(mesh(new THREE.BoxGeometry(0.34, 0.14, 0.8), mat(0x111827), 0, 0.46, -0.25));
  j.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 5), mat(0x111827), 0, 0.55, 0.5));
  const hb = mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), mat(0x111827), 0, 0.68, 0.5); j.add(hb);
  j.add(mesh(new THREE.BoxGeometry(0.64, 0.05, 1.3), mat(0x111827), 0, 0.02, -0.05, false));
  return j;
}
{
  const wd = mat(0xa97c4f), wd2 = mat(0x8b5a2b), blu = mat(0x0ea5e9);
  // pontoon deck (floats)
  const deck = new THREE.Group(); deck.position.set(0, 0, 0);
  for (let i = 0; i < 8; i++) deck.add(mesh(new THREE.BoxGeometry(4.2, 0.12, 0.42), i % 2 ? wd : wd2, 0, 0.3, -1.5 + i * 0.43));
  for (const [x, z] of [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]]) deck.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10), mat(0x1d4ed8), x, 0.12, z));
  JP(deck, 0.0, 0.2);
  // walkway to the dock
  const wk = new THREE.Group();
  for (let i = 0; i < 7; i++) wk.add(mesh(new THREE.BoxGeometry(0.9, 0.08, 0.38), i % 2 ? wd : wd2, -0.6, 0.34, -1.95 - i * 0.4));
  JP(wk, 0.1, 0.3);
  // kiosk hut
  const hut = new THREE.Group(); hut.position.set(-1.1, 0.36, -0.5);
  hut.add(mesh(new THREE.BoxGeometry(1.5, 1.2, 1.1), mat(0xf8fafc), 0, 0.6, 0));
  hut.add(mesh(new THREE.BoxGeometry(1.0, 0.5, 0.06), mat(0x0f172a), 0, 0.75, 0.56));
  hut.add(mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), mat(0x0369a1), 0, 0.42, 0.75));
  const roof = mesh(new THREE.BoxGeometry(1.9, 0.1, 1.5), blu, 0, 1.3, 0.1); roof.rotation.x = -0.12; hut.add(roof);
  for (let k = 0; k < 6; k++) hut.add(mesh(new THREE.BoxGeometry(0.3, 0.14, 0.02), mat(k % 2 ? 0xffffff : 0x0ea5e9), -0.78 + k * 0.31, 1.16, 0.86, false));
  JP(hut, 0.25, 0.55, 'grow');
  // sign
  const stx = canvasTex(1024, 256, (x, w, h) => { x.fillStyle = '#0ea5e9'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffffff'; x.lineWidth = 14; x.strokeRect(9, 9, w - 18, h - 18);
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 92px Poppins'; x.fillText('SEWA JETSKI', w / 2, 100); x.font = '700 46px Poppins'; x.fillStyle = '#fde047'; x.fillText('Pelabuhan Pulau', w / 2, 190); });
  const sgn = new THREE.Group(); sgn.position.set(-1.1, 1.75, 0.0);
  sgn.add(mesh(new THREE.BoxGeometry(1.7, 0.42, 0.06), [blu, blu, blu, blu, new THREE.MeshStandardMaterial({ map: stx }), blu], 0, 0.2, 0.25));
  JP(sgn, 0.55, 0.65);
  // life rings + flag
  for (const [x, z] of [[0.4, -1.42], [1.4, -1.42]]) { const r = mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 14), mat(0xf97316), x, 0.7, z); JT.add(r); jtParts.push({ obj: r, k0: 0.62, k1: 0.7, mode: 'pop', s: r.scale.clone() }); }
  for (const [x, z] of [[0.4, -1.45], [1.4, -1.45]]) JP(mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), wd2, x, 0.55, z), 0.6, 0.66);
}
const JETS = [0xef4444, 0xfacc15, 0x22c55e].map((c, i) => { const j = makeJetski(c); scene.add(j); return j; });
const JSLOT = [V(JET.x + 0.3, 0, JET.z + 2.0), V(JET.x + 1.3, 0, JET.z + 2.0), V(JET.x + 2.6, 0, JET.z + 0.3)];

// ---------------------------------------------------------------------
// Kostum baru: nazir masjid & petugas jetski
// ---------------------------------------------------------------------
WORKERS.nazir = () => {
  const v = makeVillager({ shirt: 0xf8fafc, pants: 0x14532d, skin: 0x9c6238, hat: 'peci' });
  for (let i = 0; i < 3; i++) wadd(v.body, new THREE.SphereGeometry(0.022, 6, 5), WM(0xc9a227, { metalness: 0.5 }), 0, 1.02 - i * 0.09, 0.335);
  const sarT = wtex(256, 128, (x, w, h) => { x.fillStyle = '#14532d'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(250,204,21,0.55)'; for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 10, h); for (let j = 0; j < h; j += 32) x.fillRect(0, j, w, 10); });
  sarT.wrapS = THREE.RepeatWrapping; sarT.repeat.set(2, 1);
  wadd(v.body, new THREE.CylinderGeometry(0.3, 0.33, 0.42, 14), new THREE.MeshStandardMaterial({ map: sarT, flatShading: true, roughness: 0.9 }), 0, 0.42, 0);
  // sajadah roll + tasbih in hand
  const it = new THREE.Group(); v.arms[1].add(it); it.position.set(0, -0.5, 0.12);
  const roll = wadd(it, new THREE.CylinderGeometry(0.07, 0.07, 0.42, 10), WM(0xb91c1c), 0, 0, 0); roll.rotation.z = Math.PI / 2;
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; wadd(v.arms[0], new THREE.SphereGeometry(0.022, 5, 4), WM(0x7c2d12), Math.cos(a) * 0.07, -0.48 + Math.sin(a) * 0.07, 0.06); }
  return { v, pose: 'hold' };
};
WORKERS.jetski = () => {
  const v = makeVillager({ shirt: 0x0ea5e9, pants: 0x0f172a, skin: 0xc98a5a, hat: 'cap', hatColor: 0xdc2626 });
  vest(v, 0xf97316);
  for (const y of [0.66, 0.86]) wadd(v.body, new THREE.BoxGeometry(0.5, 0.04, 0.05), WM(0x111827), 0, y, 0.32);
  glasses(v); v.head.children.slice(-3).forEach(o => { o.material = WM(0x0f172a); });
  wadd(v.head, new THREE.BoxGeometry(0.34, 0.06, 0.04), WM(0x0f172a, { roughness: 0.2 }), 0, 0.05, 0.29);
  const wh = new THREE.Group(); v.body.add(wh); wh.position.set(0.12, 1.0, 0.31);
  wadd(wh, new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8), WM(0xfacc15), 0, 0, 0).rotation.z = Math.PI / 2;
  const tx = wtex(256, 96, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#0369a1'; x.font = '800 54px Poppins'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('JETSKI', w / 2, h / 2 + 2); });
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), new THREE.MeshStandardMaterial({ map: tx })); lb.position.set(-0.13, 0.92, 0.335); v.body.add(lb);
  return { v, pose: 'stand' };
};


buildMB(1); MB.visible = true; buildJT(1); JT.visible = true;
msjL.position.y = 0; msjL.visible = true; BRG.visible = true; foam6.visible = true;
function day6Tick(rt) {
  const fs = 1 + Math.sin(rt * 1.6) * 0.012, fy = 0.1 + Math.sin(rt * 1.6) * 0.03;
  foam6.scale.set(0.68 * fs, 0.68 * fs, 0.25); foam6.position.set(MSJ.x, fy, MSJ.z);
  JT.position.y = waveH(JET.x, JET.z, rt) * 0.5;
  JETS.forEach((j, i) => { const p = JSLOT[i]; j.visible = true; j.scale.setScalar(1); j.position.set(p.x, waveH(p.x, p.z, rt) + 0.02, p.z); j.rotation.set(Math.sin(rt * 1.7 + i) * 0.05, i === 2 ? Math.PI / 2 : 0, Math.sin(rt * 1.3 + i) * 0.05); });
}

// ================= WEB: PETA PENDUDUK (interaktif) =================
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
{
  const DATA = window.PULAU || { warga: [], total: 0, day: 0, updated: '' };
  const $ = id => document.getElementById(id);

  // ---- renderer full screen ----
  stars.style.display = 'none';
  renderer.toneMapping = THREE.NeutralToneMapping;
  const resize = () => {
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth > innerHeight ? 38 : 50; camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();
  // smoother characters
  const smooth = (root) => root.traverse(o => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const nm = ms.map(m => { if (m && m.flatShading) { const c = m.clone(); c.flatShading = false; c.needsUpdate = true; return c; } return m; });
    o.material = Array.isArray(o.material) ? nm : nm[0];
  });
  ocean.material.flatShading = false; ocean.material.roughness = 0.25; ocean.material.needsUpdate = true;

  // ---- Klinik & Sekolah island + footbridge to the main island ----
  const HAS_FAS = typeof FAS !== 'undefined';
  let fasBridge = null;
  if (HAS_FAS) {
    fasL.position.y = 0; fasL.visible = true; buildFB(1); FB.visible = true;
    const A = V(5.7, 0, -1.4), B = V(9.6, 0, -5.4), d = B.clone().sub(A), L = d.length(), yaw = Math.atan2(d.x, d.z);
    fasBridge = new THREE.Group(); scene.add(fasBridge);
    const wood = mat(0xb07a45), dark = mat(0x7a4f2a);
    for (let i = 0; i <= Math.ceil(L / 0.42); i++) { const k = i * 0.42 / L; if (k > 1) break; const pl = mesh(new THREE.BoxGeometry(1.25, 0.08, 0.46), wood, A.x + d.x * k, SAND + 0.14, A.z + d.z * k); pl.rotation.y = yaw; fasBridge.add(pl); }
    for (let i = 0; i <= 4; i++) for (const sd of [-1, 1]) { const k = i / 4; const px = A.x + d.x * k + Math.cos(yaw) * 0.62 * sd, pz = A.z + d.z * k - Math.sin(yaw) * 0.62 * sd;
      fasBridge.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), dark, px, SAND - 0.05, pz)); }
    for (const sd of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(0.05, 0.05, L), dark, A.x + d.x / 2 + Math.cos(yaw) * 0.62 * sd, SAND + 0.55, A.z + d.z / 2 - Math.sin(yaw) * 0.62 * sd); r.rotation.y = yaw; fasBridge.add(r); }
  }
  const HAS_D6 = typeof MSJ !== 'undefined';
  // ---- ground height by raycast ----
  const lands = [island, ext, north, sel, ...(typeof desa !== 'undefined' ? [desa] : []), ...(HAS_FAS ? [fasL, fasBridge] : []), ...(HAS_D6 ? [msjL, BRG] : [])];
  const ray = new THREE.Raycaster();
  // height map of all land (one-time raycast), used for walking + placement
  const HM = { x0: -38, z0: -50, s: 0.35, W: 58, D: 64 }; HM.nx = Math.ceil(HM.W / HM.s); HM.nz = Math.ceil(HM.D / HM.s);
  HM.y = new Float32Array(HM.nx * HM.nz);
  scene.updateMatrixWorld(true);
  for (let j = 0; j < HM.nz; j++) for (let i = 0; i < HM.nx; i++) {
    ray.set(V(HM.x0 + i * HM.s, 20, HM.z0 + j * HM.s), V(0, -1, 0));
    const h = ray.intersectObjects(lands, true)[0]; HM.y[j * HM.nx + i] = h ? h.point.y : -99;
  }
  const hAt = (x, z) => { const i = Math.round((x - HM.x0) / HM.s), j = Math.round((z - HM.z0) / HM.s); return i < 0 || j < 0 || i >= HM.nx || j >= HM.nz ? -99 : HM.y[j * HM.nx + i]; };
  const groundY = (x, z) => { const y = hAt(x, z); return y > SAND - 0.08 && y < GRASS + 0.25 ? y : SAND; };

  // ---- characters ----
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const SHIRTS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0x14b8a6, 0xec4899, 0xf97316, 0x64748b, 0x0ea5e9, 0x84cc16, 0xa855f7, 0xfacc15, 0x1d4ed8, 0xbe123c, 0x0f766e];
  const PANTS = [0x1f2937, 0x374151, 0x1e3a5f, 0x4b5563, 0x78350f];
  const HATS = ['hair', 'hair', 'cap', 'peci', 'hair', 'cap'];
  const lookOf = u => {
    const h = hash(u), r = rnd((h % 2147483646) + 1); r(); r();
    const pick = a => a[Math.floor(r() * a.length)];
    return { shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS), hat: pick(HATS), hatColor: pick(SHIRTS) };
  };

  const ZONES = {
    utama: { name: 'Pulau Utama', look: V(0, 0.8, 3), dist: 15 },
    pelabuhan: { name: 'Pelabuhan', look: V(7.5, 0.8, 1.2), dist: 11 },
    pasar: { name: 'Pasar & Kuliner', look: V(PASAR.x, 0.8, PASAR.z + 1.4), dist: 15 },
    pemancingan: { name: 'Tempat Pemancingan', look: V(SEL.x + 1.4, 0.8, SEL.z + 1.4), dist: 11 },
    kampung: { name: 'Kampung Penduduk', look: V(NORTH.x, 0.8, NORTH.z + 1.5), dist: 15 },
    ...(HAS_FAS ? { fasilitas: { name: 'Klinik & Sekolah', look: V(FAS.x, 0.8, FAS.z + 1.2), dist: 13 } } : {}),
    ...(HAS_D6 ? { masjid: { name: 'Masjid Pulau', look: V(MSJ.x, 0.8, MSJ.z + 1.2), dist: 13 } } : {}),
    ...(typeof DESA !== 'undefined' ? { desa: { name: 'Desa Tani', look: V(DESA.cx, 0.5, DESA.z0 - 9), dist: 22 } } : {}),
  };
  // fixed work spots
  const SPOTS = {
    pelabuhan: [['pier', 7.6, 0.8], ['pier', 9.8, 1.2], ['g', 5.6, -0.6], ['g', 5.0, 2.7], ['g', 4.2, 3.6], ['g', 3.6, -1.6]],
    pasar: [4, 5, 3, 6, 2, 7, 1, 8, 0, 9].map(i => ['g', LAPAK[i].vendor.x, LAPAK[i].vendor.z]).concat([-6, -4, -2, 0, 2, 4, 6].map(x => ['g', PASAR.x + x, PASAR.z + 4.6])),
    pemancingan: [['pm', 0.6, 0.9], ['pm', -0.6, 1.5], ['pm', 0.6, 2.1]],
    utama: [],
    kampung: [],
    masjid: HAS_D6 ? [[-1.6, 3.2], [1.6, 3.0], [0.2, 3.9], [-2.6, 1.2], [2.8, 0.9], [-1.0, 4.4]].map(([x, z]) => ['g', MSJ.x + x, MSJ.z + z]) : [],
    fasilitas: HAS_FAS ? [[-1.9, 1.3], [-1.0, 1.6], [2.0, 1.2], [1.0, 1.7], [-2.6, 2.1], [2.8, 2.4]].map(([x, z]) => ['g', FAS.x + x, FAS.z + z]) : [],
  };
  // kampung grid (skip houses, path & palms)
  {
    const pts = [];
    for (let z = -7.0; z <= 7.0; z += 1.15) for (let x = -7.0; x <= 7.2; x += 1.15) {
      if (x * x + (z + 0.2) * (z + 0.2) > NORTH_R * NORTH_R) continue;
      if (Math.abs(x) > 1.0 && Math.abs(x) < 6.1 && ((z > 0.3 && z < 3.0) || (z > -3.7 && z < -1.0))) continue; // houses
      if (Math.abs(x - 0.26) < 0.8 && z > 3.4) continue; // path
      if ((x + 6.0) ** 2 + (z + 2.9) ** 2 < 0.9 || (x - 6.4) ** 2 + (z + 1.3) ** 2 < 0.9 || (x - 0.8) ** 2 + (z + 6.0) ** 2 < 0.9) continue;
      pts.push([x, z]);
    }
    pts.sort((a, b) => (b[1] - a[1]) || (a[0] - b[0])); // front rows first
    SPOTS.kampung = pts.map(([x, z]) => ['g', NORTH.x + x, NORTH.z + z]);
    // overflow on main island
    for (let z = -4.6; z <= 3.2; z += 1.15) for (let x = -5.2; x <= 5.2; x += 1.15) {
      if (x * x + z * z > 5.6 * 5.6) continue;
      if ((x + 1.6) ** 2 + (z + 3.2) ** 2 < 7) continue;
      SPOTS.utama.push(['g', x, z]);
    }
  }
  const used = { pelabuhan: 0, pasar: 0, pemancingan: 0, kampung: 0, utama: 0, fasilitas: 0, masjid: 0 };
  const takeSpot = zone => {
    let z = zone;
    if (used[z] >= SPOTS[z].length) z = 'utama';
    const s = SPOTS[z][used[z]++ % SPOTS[z].length];
    if (s[0] === 'pier') return { pos: V(s[1], PIER.y + 0.04, s[2]), zone: z, pier: true };
    if (s[0] === 'pm') { const p = pml(s[1], 0, s[2]); p.y = PIER.y + 0.04; return { pos: p, zone: z, pier: true }; }
    return { pos: V(s[1], groundY(s[1], s[2]), s[2]), zone: z };
  };

  // hide everything from the episodes, then place residents
  const hideAll = () => {
    VIL.forEach(v => v.root.visible = false);
    APPOINT.forEach(a => { a.cas.root.visible = false; a.uni.root.visible = false; a.tag.visible = false; });
    APPOINT4.forEach(a => { a.cas.root.visible = false; a.uni.root.visible = false; a.tag.visible = false; });
  };
  hideAll();
  const ENT = DATA.warga.map((w, i) => {
    let m, ps;
    if (w.char && /^W:/.test(w.char) && typeof WORKERS !== 'undefined') {
      const nm = w.char.slice(2), alt = nm.endsWith('2') && !WORKERS[nm];
      const u = WORKERS[alt ? nm.slice(0, -1) : nm](); m = u.v; ps = u.pose;
      if (alt) { recolor(m.root, 0xf59e0b, 0xec4899); recolor(m.root, 0x0ea5e9, 0x8b5cf6); }
      (w.rc || []).forEach(([a, b]) => recolor(m.root, a, b));
      scene.add(m.root); smooth(m.root);
    } else if (w.char && /^U:\w+$/.test(w.char) && UNIFORMS[w.char.slice(2)]) {
      const u = UNIFORMS[w.char.slice(2)](); m = u.v; ps = u.pose;
      if (w.skin) recolor(m.root, w.skinFrom || 0xa86b3c, w.skin);
      (w.rc || []).forEach(([a, b]) => recolor(m.root, a, b));
      scene.add(m.root); smooth(m.root);
    } else if (w.char && /^V:\w+$/.test(w.char) && VENDORS[w.char.slice(2)]) {
      const u = VENDORS[w.char.slice(2)](); m = u.v; ps = u.pose;
      (w.rc || []).forEach(([a, b]) => recolor(m.root, a, b));
      scene.add(m.root); smooth(m.root);
    } else if (w.char === 'BT') { // Bang Tanjung sendiri sudah ada di pulau (ch); entitas ini hanya untuk daftar & login
      m = makeVillager(lookOf(w.u)); m.root.scale.setScalar(0.0001); scene.add(m.root);
    } else if (w.char && /^A[34]:\d+$/.test(w.char)) {
      const [k, n] = w.char.split(':'); const a = (k === 'A3' ? APPOINT : APPOINT4)[+n];
      m = a.uni; ps = a.ps; smooth(m.root);
    } else {
      m = makeVillager(lookOf(w.u)); scene.add(m.root); smooth(m.root);
    }
    let sp;
    if (w.zone === 'pasar') {
      const l = LAPAK.find(l => l.owner === w.u && !l.taken) || LAPAK.find(l => !l.owner && !l.taken);
      if (l) { l.taken = true; sp = { pos: l.vendor.clone(), zone: 'pasar' }; }
    }
    if (!sp) sp = takeSpot(w.zone || 'kampung');
    m.root.position.copy(sp.pos); m.root.visible = true;
    const zl = ZONES[w.zone] ? w.zone : sp.zone;
    const face = zl === 'pasar' ? 0 : faceTo(sp.pos, ZONES[zl].look.x + 2, ZONES[zl].look.z + 9);
    m.root.rotation.y = zl === 'pemancingan' ? Math.PI / 4 + Math.PI : face;
    const e = { ...w, onPier: !!sp.pier, i, m, ps, no: 'PN-' + String(i + 1).padStart(4, '0'), zoneKey: zl };
    m.root.traverse(o => o.userData.ent = e);
    return e;
  });

  // Bang Tanjung
  ch.root.position.set(-0.4, SAND, 5.6); ch.root.rotation.y = -0.15;
  ch.root.traverse(o => o.userData.bt = true);

  // ---- static world state (everything built) ----
  const setWorld = () => {
    crab.visible = false; tagLando.visible = false; tagTetii.visible = false; tagHouse.visible = false; tagPM.visible = false; tagRM.visible = false;
    torch.visible = false; torchL.intensity = 0;
    boat.scale.setScalar(1.6); boat.rotation.set(0, Math.PI / 2, 0);
    buildWarung(1); WG.visible = true; mmSign.scale.setScalar(1);
    bulbM.emissiveIntensity = 0.3; lamp.intensity = 0; lampIn.intensity = 0; mmFace.emissiveIntensity = 0;
    ext.position.y = 0; ext.visible = true; north.position.y = 0; north.visible = true;
    sel.position.y = 0; sel.visible = true; foam4.visible = true;
    buildHouses(HOUSES.length + 1); HOUSES.forEach(h => h.visible = true);
    buildPM(1); PM.visible = true; buildRM(1); RM.visible = true;
    cere.visible = false; CONF.forEach(c => c.m.visible = false); poof(V(), 0);
    sign.position.y = SAND; board.scale.setScalar(1);
    setSign('PENDUDUK: ' + DATA.total);
    setSky(0, 0, 0.7);
  };
  setWorld();
  [ $('ui') ].forEach(el => el && (el.style.display = 'none'));

  // ---- camera + controls ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 3; controls.maxDistance = 70; controls.maxPolarAngle = 1.38;
  controls.target.set(-0.2, 0.5, -2.5);
  camera.position.set(11, 24, 27);
  controls.update();
  let fly = null;
  const flyTo = (look, dist, dirHint) => {
    const dir = dirHint ? dirHint.clone().normalize() : camera.position.clone().sub(controls.target).normalize();
    const toPos = look.clone().addScaledVector(dir, dist);
    fly = { t0: performance.now(), d: 1300, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: toPos, toT: look.clone() };
  };
  const OVERVIEW = () => flyTo(V(-0.2, 0.5, -2.5), 36, V(0.33, 0.7, 0.8));

  // pick a camera direction with nothing (palms, roofs) between camera and character
  const occ = new THREE.Raycaster();
  const clearDir = (e, p, dist) => {
    const yaw0 = e.m.root.rotation.y;
    const blockers = scene.children.filter(o => o !== ocean && !o.isSprite && o.visible && o !== e.m.root && !(o.isLight));
    for (const el of [0.6, 0.95, 1.4]) for (const dy of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1, Math.PI]) {
      const d = V(Math.sin(yaw0 + dy), el, Math.cos(yaw0 + dy)).normalize();
      const cam = p.clone().addScaledVector(d, dist);
      let ok = true;
      // several sight lines: feet, body, head, and the ground just in front
      for (const tgt of [V(0, -0.3, 0), V(0, 0.4, 0), V(0, 1.4, 0), V(d.x * 1.2, -0.35, d.z * 1.2), V(-d.z * 0.9, 0.3, d.x * 0.9), V(d.z * 0.9, 0.3, -d.x * 0.9)]) {
        const from = p.clone().add(tgt), dir = cam.clone().sub(from); const len = dir.length(); dir.normalize();
        occ.set(from, dir); occ.far = len;
        if (occ.intersectObjects(blockers, true).some(h => !h.object.isSprite && !h.object.userData.ent && h.distance > 0.05)) { ok = false; break; }
      }
      if (ok) return d;
    }
    return V(Math.sin(yaw0), 0.55, Math.cos(yaw0));
  };

  // ---- selection tag ----
  let selTag = null, selected = null;
  const select = (e, doFly = true) => {
    if (selTag) { scene.remove(selTag); selTag.material.map.dispose(); selTag = null; }
    selected = e;
    if (!e) { card.classList.remove('on'); return; }
    selTag = tagSprite('@' + e.u, '#ffd23f', '#3a2300', e.u.length > 11 ? 1024 : 512);
    selTag.scale.set(e.u.length > 11 ? 2.6 : 1.3, 0.25, 1);
    if (doFly) {
      const p = e.m.root.position.clone(); p.y += 0.35;
      flyTo(p, 7.5, clearDir(e, p, 7.5));
    }
    showCard(e);
  };

  // ---- UI ----
  const card = $('card');
  const statusTxt = { pegawai: 'PEGAWAI RESMI', menunggu: 'MENUNGGU PELANTIKAN', warga: 'PENDUDUK', baru: 'PENDUDUK BARU' };
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  function showCard(e) {
    $('kNo').textContent = e.no;
    $('kUser').textContent = '@' + e.u;
    $('kStatus').textContent = statusTxt[e.status] || 'PENDUDUK';
    $('kStatus').className = 'st ' + e.status;
    $('kJob').textContent = e.job || 'Penduduk';
    const now = zoneAt(e.m.root.position);
    $('kZone').textContent = ZONES[now].name + (e.status === 'pegawai' && now !== e.zoneKey ? ' · kerja di ' + ZONES[e.zoneKey].name : '');
    $('kRumah').textContent = e.rumah || 'Menunggu giliran dibangun';
    $('kSince').textContent = e.status === 'baru' ? 'Disambut di ' + e.since : 'Sejak ' + e.since + (e.lantik ? ' · dilantik ' + e.lantik : '');
    $('kNote').textContent = e.note || '';
    $('kNote').style.display = e.note ? 'block' : 'none';
    $('kAv').textContent = e.u.replace(/[^a-z0-9]/gi, '')[0]?.toUpperCase() || '?';
    const torso = e.m.body.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry');
    const col = torso && torso.material.color ? torso.material.color : new THREE.Color(0xf97316);
    $('kAv').style.background = '#' + col.getHexString();
    $('kAv').style.color = (0.3 * col.r + 0.59 * col.g + 0.11 * col.b) > 0.7 ? '#14181f' : '#fff';
    card.classList.add('on');
  }
  $('kClose').onclick = () => { select(null); };
  $('tot').textContent = DATA.total;
  $('upd').textContent = 'Update ' + DATA.updated + ' · Day ' + DATA.day;

  // search
  const q = $('q'), sug = $('sug');
  const norm = s => s.toLowerCase().replace(/^@/, '').trim();
  const find = s => ENT.filter(e => e.u.toLowerCase().includes(norm(s)));
  const renderSug = () => {
    const s = norm(q.value); sug.innerHTML = '';
    if (!s) { sug.style.display = 'none'; return; }
    const r = find(s).slice(0, 6);
    if (!r.length) { sug.innerHTML = `<div class="none">Belum terdaftar. Komen <b>JADI WARGA</b> di reel mana saja @pulau.netizen, besoknya karaktermu muncul di sini.</div>`; sug.style.display = 'block'; return; }
    r.forEach(e => { const d = document.createElement('div'); d.className = 'it'; d.innerHTML = `<b>@${e.u}</b><span>${e.job || 'Penduduk'} · ${ZONES[e.zoneKey].name}</span>`; d.onclick = () => { q.value = '@' + e.u; sug.style.display = 'none'; q.blur(); select(e); }; sug.appendChild(d); });
    sug.style.display = 'block';
  };
  q.addEventListener('input', renderSug);
  q.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const r = find(q.value); if (r.length) { sug.style.display = 'none'; q.blur(); select(r.find(e => e.u.toLowerCase() === norm(q.value)) || r[0]); } } });

  // zone chips
  const chips = $('chips');
  const addChip = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; chips.appendChild(b); };
  addChip('🏝️ Semua', () => { select(null); OVERVIEW(); });
  Object.entries(ZONES).forEach(([k, z]) => addChip(z.name, () => { select(null); flyTo(z.look, z.dist, V(0.2, 0.55, 1)); }));

  // directory
  const dir = $('dir'), dirList = $('dirList');
  const groups = [['pegawai', 'Pegawai resmi'], ['menunggu', 'Menunggu pelantikan'], ['warga', 'Penduduk'], ['baru', 'Penduduk baru']];
  groups.forEach(([st, title]) => {
    const list = ENT.filter(e => e.status === st); if (!list.length) return;
    const h = document.createElement('h4'); h.textContent = `${title} (${list.length})`; dirList.appendChild(h);
    list.forEach(e => { const d = document.createElement('div'); d.className = 'it'; d.innerHTML = `<b>@${e.u}</b><span>${e.job || ZONES[e.zoneKey].name}</span>`; d.onclick = () => { dir.classList.remove('on'); select(e); }; dirList.appendChild(d); });
  });
  $('btnDir').onclick = () => dir.classList.toggle('on');
  $('dirClose').onclick = () => dir.classList.remove('on');
  $('btnHow').onclick = () => $('how').classList.toggle('on');
  $('howClose').onclick = () => $('how').classList.remove('on');

  // tap on characters
  const pick = new THREE.Raycaster(); let down = null;
  renderer.domElement.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener('pointerup', ev => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 6) return;
    const p = V((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1, 0);
    pick.setFromCamera(p, camera);
    const objs = ENT.map(e => e.m.root).concat([ch.root]);
    const h = pick.intersectObjects(objs, true)[0];
    if (!h) return;
    if (h.object.userData.bt) { toast('Bang Tanjung, Kepala Pulau 🏝️ "Komen paling rame, besok saya bangun!"'); return; }
    if (h.object.userData.ent) select(h.object.userData.ent, true);
  });
  let toastT = 0;
  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); };

  // deep link ?u=username
  const qs = new URLSearchParams(location.search).get('u');


  // ---- life simulation: walk, idle, chat ----
  const OBST = [...(HAS_D6 ? [[MSJ.x, MSJ.z - 0.3, 2.5], [MSJ.x + 1.95, MSJ.z - 1.6, 0.55]] : []), ...HOUSES.map(h => [h.position.x, h.position.z + 0.2, 1.55]), [WG.position.x, WG.position.z, 1.8], [RM.position.x, RM.position.z, 2.1], ...KAVLING.map(k => [k.position.x, k.position.z, 1.9]), [PASAR.x + 10.9, PASAR.z + 0.2, 0.3], [PASAR.x + 10.9, PASAR.z + 2.0, 0.3], ...LAPAK.map(l => [l.g.position.x, l.g.position.z + 0.1, 0.45]), [sign.position.x, sign.position.z, 0.6], [-1.6, -3.2, 2.2], ...(HAS_FAS ? [[FAS.x - 1.9, FAS.z - 0.6, 1.75], [FAS.x + 2.0, FAS.z - 0.9, 2.0]] : [])];
  const walkable = (x, z) => {
    for (const [ox, oz, r] of OBST) if ((x - ox) ** 2 + (z - oz) ** 2 < r * r) return false;
    if (typeof desaBlocked === 'function' && desaBlocked(x, z)) return false;
    const y = hAt(x, z);
    return y > SAND - 0.08 && y < GRASS + 0.25;
  };
  const pathOK = (a, b) => { const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3)); for (let k = 1; k <= n; k++) { const x = lerp(a.x, b.x, k / n), z = lerp(a.z, b.z, k / n); if (!walkable(x, z)) return false; } return true; };
  // walking network over the whole island (so residents can travel anywhere)
  const NODES = [];
  for (let z = HM.z0; z < HM.z0 + HM.D; z += 1.8) for (let x = HM.x0; x < HM.x0 + HM.W; x += 1.8) {
    const ok = [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].every(([a, b]) => walkable(x + a, z + b));
    if (ok) NODES.push({ p: V(x, 0, z), n: [] });
  }
  NODES.forEach((A, i) => NODES.forEach((B, j) => { if (j > i && A.p.distanceTo(B.p) < 2.7 && pathOK(A.p, B.p)) { A.n.push(j); B.n.push(i); } }));
  // desa is huge: pick its nodes less often so residents spread over the whole island
  let NODE_IN = null, NODE_OUT = null;
  const pickNode = () => {
    if (!NODE_IN) { NODE_IN = []; NODE_OUT = []; NODES.forEach((N, i) => (zoneAt(N.p) === 'desa' ? NODE_IN : NODE_OUT).push(i)); }
    const L = NODE_IN.length && (Math.random() < 0.15 || !NODE_OUT.length) ? NODE_IN : NODE_OUT;
    return L[Math.floor(Math.random() * L.length)];
  };
  const nearestNode = p => { let b = -1, bd = 1e9; NODES.forEach((N, i) => { const d = (N.p.x - p.x) ** 2 + (N.p.z - p.z) ** 2; if (d < bd && pathOK(p, N.p)) { bd = d; b = i; } }); return b; };
  const route = (from, to) => { // BFS over nodes
    const prev = new Int32Array(NODES.length).fill(-2); prev[from] = -1; const q = [from];
    while (q.length) { const c = q.shift(); if (c === to) break; for (const nb of NODES[c].n) if (prev[nb] === -2) { prev[nb] = c; q.push(nb); } }
    if (prev[to] === -2) return null; const out = []; for (let c = to; c !== -1; c = prev[c]) out.unshift(NODES[c].p.clone()); return out;
  };
  const zoneAt = p => {
    if (typeof DESA !== 'undefined' && p.x > DESA.x0 && p.x < DESA.x0 + DESA.W && p.z < DESA.z0 - 0.3 && p.z > DESA.z0 - DESA.D && !(p.x > -7.5 && p.z > -21)) return 'desa';
    if (((p.x - PASAR.x) / (PASAR_S.x * 1.1)) ** 2 + ((p.z - PASAR.z) / (PASAR_S.z * 1.1)) ** 2 < 1) return 'pasar';
    if ((p.x - NORTH.x) ** 2 + (p.z - NORTH.z) ** 2 < (NORTH_R + 1.6) ** 2) return 'kampung';
    if ((p.x - SEL.x) ** 2 + (p.z - SEL.z) ** 2 < 4.6 ** 2) return 'pemancingan';
    if (HAS_FAS && (p.x - FAS.x) ** 2 + (p.z - FAS.z) ** 2 < 6.2 ** 2) return 'fasilitas';
    if (HAS_D6 && (p.x - MSJ.x) ** 2 + (p.z - MSJ.z) ** 2 < 5.4 ** 2) return 'masjid';
    if (p.x > 4.8 && Math.abs(p.z - 1) < 2.6) return 'pelabuhan';
    return 'utama';
  };
  const BUB = ['💬', '😂', '👋', '🏝️', '🤝', '😄', '🍜', '🎣', '⚓', '🥥', '❤️', '🤣'];
  const bubbleTex = {};
  const bubble = (emo) => {
    if (!bubbleTex[emo]) bubbleTex[emo] = canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#fff'; x.beginPath(); x.roundRect(8, 8, 112, 92, 30); x.fill();
      x.beginPath(); x.moveTo(44, 96); x.lineTo(64, 122); x.lineTo(74, 96); x.fill();
      x.font = '58px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emo, 64, 56);
    });
    return bubbleTex[emo];
  };
  ENT.forEach((e, k) => {
    const home = e.m.root.position.clone();
    const onPier = e.onPier;
    const vendor = e.zoneKey === 'pasar' && e.status !== 'warga' && e.status !== 'baru';
    const roam = !onPier && !vendor && e.status !== 'pegawai';
    if (roam && NODES.length) { const N = NODES[pickNode()]; home.set(N.p.x + (Math.random() - 0.5) * 0.6, 0, N.p.z + (Math.random() - 0.5) * 0.6); home.y = groundY(home.x, home.z); e.m.root.position.copy(home); e.m.root.rotation.y = Math.random() * 6.28; }
    e.sim = {
      home, roam, path: [], radius: onPier || vendor ? 0 : (e.status === 'pegawai' ? 1.6 : 2.6),
      st: 'idle', until: 1 + Math.random() * 5, target: null, partner: null, phase: Math.random() * 9, yaw: e.m.root.rotation.y, baseYaw: e.m.root.rotation.y,
      bub: new THREE.Sprite(new THREE.SpriteMaterial({ map: bubble('💬'), depthTest: false, transparent: true })),
    };
    e.sim.bub.scale.set(0.55, 0.55, 1); e.sim.bub.visible = false; e.sim.bub.renderOrder = 11; scene.add(e.sim.bub);
  });
  const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const turn = (cur, to, k) => { let d = to - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); return cur + d * Math.min(1, k); };
  const randTarget = (e) => {
    const S = e.sim;
    for (let n = 0; n < 8; n++) {
      const a = Math.random() * Math.PI * 2, r = (0.4 + Math.random() * 0.6) * S.radius;
      const c = S.roam ? e.m.root.position : S.home;
      const p = V(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
      if (walkable(p.x, p.z) && pathOK(e.m.root.position, p)) return p;
    }
    return null;
  };
  const SPEED = 0.85;
  let simLast = 0;
  const simulate = (t) => {
    const dt = Math.min(0.1, t - simLast); simLast = t;
    for (const e of ENT) {
      const S = e.sim, root = e.m.root, pos = root.position;
      if (S.manual) { S.bub.visible = false; continue; }
      if (e === selected) { S.st = 'idle'; S.until = t + 2; S.partner = null; S.path = []; S.bub.visible = false; S.yaw = turn(S.yaw, angTo(pos, camera.position), dt * 4); }
      else if (S.st === 'idle' && t > S.until && S.radius > 0) {
        const r = Math.random();
        if (r < 0.35 && e.status !== 'pegawai') { // look for a chat partner nearby
          const p = ENT.find(o => o !== e && o !== selected && o.sim.st === 'idle' && o.sim.radius > 0 && o.m.root.position.distanceTo(pos) < 3.2);
          if (p) {
            const mid = pos.clone().lerp(p.m.root.position, 0.5), dir = p.m.root.position.clone().sub(pos).setY(0).normalize();
            const a = mid.clone().addScaledVector(dir, -0.42), b = mid.clone().addScaledVector(dir, 0.42);
            if (walkable(a.x, a.z) && walkable(b.x, b.z)) {
              S.st = 'walk'; S.target = a; S.partner = p; S.next = 'chat';
              p.sim.st = 'walk'; p.sim.target = b; p.sim.partner = e; p.sim.next = 'chat';
              continue;
            }
          }
        }
        if (S.roam && r >= 0.35 && r < 0.68 && NODES.length) { // trip to another part of the island
          const a = nearestNode(pos), b = pickNode();
          const path = a >= 0 ? route(a, b) : null;
          if (path && path.length > 1) { S.path = path; S.st = 'walk'; S.target = S.path.shift(); S.next = 'idle'; continue; }
        }
        if (r < 0.88) { const tg = randTarget(e); if (tg) { S.st = 'walk'; S.target = tg; S.next = 'idle'; S.path = []; } else S.until = t + 2; }
        else { S.st = 'cheer'; S.until = t + 1.6; }
      }
      if (S.st === 'walk') {
        const d = S.target.clone().sub(pos).setY(0), len = d.length();
        if (len < 0.05) {
          if (S.next === 'chat' && S.partner) {
            S.st = 'wait';
            const P = S.partner.sim;
            if (P.st === 'wait') { const end = t + 4 + Math.random() * 3; S.st = P.st = 'chat'; S.until = P.until = end; S.emo = P.emo = 0; }
          } else if (S.path && S.path.length) { S.target = S.path.shift(); }
          else { S.st = 'idle'; S.until = t + 1.5 + Math.random() * 4; }
        } else {
          const step = Math.min(len, SPEED * dt); pos.addScaledVector(d.normalize(), step);
          pos.y = groundY(pos.x, pos.z); if (pos.y > GRASS + 0.25) pos.y = SAND; // safety
          S.yaw = turn(S.yaw, Math.atan2(d.x, d.z), dt * 8);
          S.phase += step * 7.5;
        }
      }
      if (S.st === 'wait' && S.partner && S.partner.sim.st !== 'walk' && S.partner.sim.st !== 'wait' && S.partner.sim.st !== 'chat') { S.st = 'idle'; S.partner = null; S.until = t + 1; }
      if (S.st === 'chat') {
        S.yaw = turn(S.yaw, angTo(pos, S.partner.m.root.position), dt * 6);
        if (t > S.until) { S.st = 'idle'; S.until = t + 2 + Math.random() * 4; S.partner = null; S.bub.visible = false; }
      }
      if (S.st === 'cheer' && t > S.until) { S.st = 'idle'; S.until = t + 2 + Math.random() * 4; }
      if (S.st === 'idle' && S.radius > 0 && e !== selected) S.yaw = turn(S.yaw, S.yaw, 0);
      if (S.radius === 0 && e !== selected) S.yaw = turn(S.yaw, S.baseYaw, dt * 3);
      root.rotation.y = S.yaw;

      // pose
      const walking = S.st === 'walk';
      vPose(e.m, { t, walk: walking ? S.phase : 0, cheer: S.st === 'cheer' ? 1 : 0, ph: S.phase });
      if (!walking && e.ps === 'hold') applyHeldPose(e.m, e.ps);
      else if (e.ps === 'hold') e.m.arms[1].rotation.set(-0.95, 0, 0.25);
      e.m.body.rotation.y = walking || S.st === 'chat' ? 0 : Math.sin(t * 0.6 + S.phase) * 0.22;
      if (S.st === 'chat') {
        const me = (Math.floor((t + (e.i % 2) * 1.1) / 1.1) % 2) === 0; // take turns talking
        e.m.head.rotation.x = me ? Math.sin(t * 9) * 0.08 : 0;
        if (me) e.m.arms[e.i % 2].rotation.set(-0.5 - Math.abs(Math.sin(t * 4)) * 0.6, 0, (e.i % 2 ? 1 : -1) * 0.3);
        const step = Math.floor((t + e.i * 0.7) / 1.4);
        if (me && S.emo !== step) { S.emo = step; S.bub.material.map = bubble(BUB[(step + e.i) % BUB.length]); }
        S.bub.visible = me; S.bub.position.copy(pos).add(V(0, 2.05, 0));
      } else S.bub.visible = false;
      if (e === selected) { const w = Math.sin(t * 9) * 0.25; e.m.arms[0].rotation.set(0, 0, -2.5 + w); }
    }
    // keep a little distance between people
    for (let a = 0; a < ENT.length; a++) for (let b = a + 1; b < ENT.length; b++) {
      const A = ENT[a], B = ENT[b]; if (A.sim.radius === 0 || B.sim.radius === 0) continue;
      const pa = A.m.root.position, pb = B.m.root.position, dx = pb.x - pa.x, dz = pb.z - pa.z, d2 = dx * dx + dz * dz;
      if (d2 > 0.0001 && d2 < 0.36) { const d = Math.sqrt(d2), push = (0.6 - d) * 0.5 * Math.min(1, dt * 6);
        const nx = dx / d * push, nz = dz / d * push;
        if (walkable(pa.x - nx, pa.z - nz) && A !== selected) { pa.x -= nx; pa.z -= nz; }
        if (walkable(pb.x + nx, pb.z + nz) && B !== selected) { pb.x += nx; pb.z += nz; } }
    }
  };
  // Bang Tanjung patrols the main island
  const BT_PATH = [V(-0.4, 0, 5.6), V(1.8, 0, 4.6), V(3.4, 0, 2.4), V(1.2, 0, 1.0), V(-2.4, 0, 2.2), V(-3.2, 0, 4.4)];
  const BT = { i: 0, st: 'idle', until: 3, phase: 0, yaw: -0.15 };
  const simBT = (t, dt) => {
    const pos = ch.root.position;
    let walk = 0, wave = 0;
    if (BT.st === 'idle') { wave = Math.max(0, Math.sin((t - BT.until + 3) * 1.1)) > 0.6 ? 1 : 0; if (t > BT.until) { BT.i = (BT.i + 1) % BT_PATH.length; BT.st = 'walk'; } }
    if (BT.st === 'walk') {
      const tg = BT_PATH[BT.i], d = tg.clone().sub(pos).setY(0), len = d.length();
      if (len < 0.05) { BT.st = 'idle'; BT.until = t + 3 + Math.random() * 3; }
      else { const st = Math.min(len, 0.75 * dt); pos.addScaledVector(d.normalize(), st); BT.phase += st * 7; BT.yaw = turn(BT.yaw, Math.atan2(d.x, d.z), dt * 6); walk = BT.phase; }
      pos.y = groundY(pos.x, pos.z); if (pos.y > GRASS + 0.25) pos.y = SAND;
    } else BT.yaw = turn(BT.yaw, angTo(pos, camera.position), dt * 2);
    ch.root.rotation.y = BT.yaw;
    pose(ch, { t, walk, wave });
  };

  // ---- loop ----
  const t0 = performance.now();
  let started = false;
  const frame = (now) => {
    const t = (now - t0) / 1000;
    if (!started && window.READY) { started = true; setWorld(); hideAll(); ENT.forEach(e => e.m.root.visible = true); $('loading').classList.add('off');
      if (qs) { const r = find(qs); if (r.length) select(r.find(e => e.u.toLowerCase() === norm(qs)) || r[0]); } }
    updateOcean(t);
    const fs = 1 + Math.sin(t * 1.6) * 0.012;
    foam.scale.x = foam.scale.y = fs; foam.position.y = 0.1 + Math.sin(t * 1.6) * 0.03;
    layoutFoam(fs, foam.position.y);
    foam4.scale.set(0.55 * fs, 0.55 * fs, 0.25); foam4.position.set(SEL.x, foam.position.y, SEL.z);
    if (HAS_FAS) { foam5.visible = true; foam5.scale.set(0.74 * fs, 0.74 * fs, 0.25); foam5.position.set(FAS.x, foam.position.y, FAS.z); fbTick(t); }
    if (HAS_D6) { foam6.visible = true; day6Tick(t); }
    boat.position.set(BOAT_DOCK, waveH(BOAT_DOCK, 1, t) + 0.05, 1.0); boat.rotation.z = Math.sin(t * 1.7) * 0.04;

    const dtBT = Math.min(0.1, t - (window.__lt || t)); window.__lt = t;
    simulate(t); simBT(t, dtBT); if (typeof rbtTick === 'function') rbtTick(t);
    if (window.__gameTick) window.__gameTick(t, dtBT, now);
    if (window.__life) window.__life(t);

    if (fly) {
      const k = Math.min(1, (now - fly.t0) / fly.d), e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(fly.fromP, fly.toP, e); controls.target.lerpVectors(fly.fromT, fly.toT, e);
      if (k >= 1) fly = null;
    }
    if (!(window.__recCam && window.__recCam(t, fly))) controls.update();
    if (selTag && selected) { selTag.visible = true; selTag.position.copy(selected.m.root.position).add(V(0, 1.95, 0)); }

    const f = controls.target;
    sun.target.position.copy(f); sun.position.copy(f).addScaledVector(sunDir, 35);
    if (!window.__skipR) renderer.render(scene, camera);
    if (!window.__REC) requestAnimationFrame(frame);
  };
  if (!window.__REC) requestAnimationFrame(frame); else window.__recStep = (tt) => frame(t0 + tt * 1000);
  window.__web = { ENT, select, flyTo, controls, NODES, HM, hAt, groundY, walkable, zoneAt, lookOf, smooth, toast, find, norm, card, get selected() { return selected; }, ZONES };
}

// ================= GAME "KEBUNKU": kebun & ternak warga (Harvest Moon style) =================
{
  const W = window.__web; if (!W || typeof DESA === 'undefined') throw new Error('game needs web + desa');
  const $ = id => document.getElementById(id);
  const CFG = window.PULAU_GAME || {};

  // ---------------- data ----------------
  const CROPS = {
    lobak:    { n: 'Lobak',    e: '🥕', lv: 1, seed: 10,  hours: 2,  yield: 1, price: 25,  col: 0xf5f5f4 },
    tomat:    { n: 'Tomat',    e: '🍅', lv: 1, seed: 20,  hours: 6,  yield: 3, price: 18,  col: 0xef4444 },
    jagung:   { n: 'Jagung',   e: '🌽', lv: 2, seed: 35,  hours: 10, yield: 2, price: 45,  col: 0xfacc15 },
    cabai:    { n: 'Cabai',    e: '🌶️', lv: 2, seed: 30,  hours: 8,  yield: 4, price: 20,  col: 0xdc2626 },
    terong:   { n: 'Terong',   e: '🍆', lv: 3, seed: 45,  hours: 12, yield: 3, price: 35,  col: 0x7e22ce },
    semangka: { n: 'Semangka', e: '🍉', lv: 4, seed: 120, hours: 24, yield: 1, price: 320, col: 0x15803d },
  };
  const ANIMALS = {
    ayam:    { n: 'Ayam',    e: '🐔', lv: 1, price: 250,  prod: 'telur',  prodN: 'Telur',       pe: '🥚', pp: 40,  gold: 'telur_emas', goldN: 'Telur Emas', gp: 130 },
    bebek:   { n: 'Bebek',   e: '🦆', lv: 2, price: 400,  prod: 'telur_bebek', prodN: 'Telur Bebek', pe: '🥚', pp: 60, gold: 'telur_emas', goldN: 'Telur Emas', gp: 130 },
    kambing: { n: 'Kambing', e: '🐐', lv: 4, price: 1100, prod: 'susu_kambing', prodN: 'Susu Kambing', pe: '🥛', pp: 110, gold: 'susu_premium', goldN: 'Susu Premium', gp: 300 },
    sapi:    { n: 'Sapi',    e: '🐄', lv: 5, price: 1800, prod: 'susu',   prodN: 'Susu Sapi',   pe: '🥛', pp: 150, gold: 'susu_premium', goldN: 'Susu Premium', gp: 300 },
  };
  const NAMES = ['Ciko', 'Momo', 'Bento', 'Kiki', 'Gendut', 'Putih', 'Belang', 'Upin', 'Ipin', 'Mimi', 'Jalu', 'Bolang', 'Cemong', 'Dodo', 'Lala', 'Unyil'];
  const ITEMS = { // sellable goods
    telur: { n: 'Telur', e: '🥚', price: 40 }, telur_bebek: { n: 'Telur Bebek', e: '🥚', price: 60 }, telur_emas: { n: 'Telur Emas', e: '🌟', price: 130 },
    susu_kambing: { n: 'Susu Kambing', e: '🥛', price: 110 }, susu: { n: 'Susu Sapi', e: '🥛', price: 150 }, susu_premium: { n: 'Susu Premium', e: '✨', price: 300 },
  };
  Object.entries(CROPS).forEach(([k, c]) => ITEMS[k] = { n: c.n, e: c.e, price: c.price });
  const FISH = {
    teri:    { n: 'Ikan Teri',   e: '🐟', w: 40, lv: 1, price: 15,  kg: 0.05, d: 0.30 },
    nila:    { n: 'Ikan Nila',   e: '🐟', w: 30, lv: 1, price: 35,  kg: 0.6,  d: 0.26 },
    tongkol: { n: 'Tongkol',     e: '🐟', w: 12, lv: 2, price: 90,  kg: 1.5,  d: 0.20 },
    kakap:   { n: 'Kakap Merah', e: '🐠', w: 10, lv: 2, price: 120, kg: 2.2,  d: 0.17 },
    kerapu:  { n: 'Kerapu',      e: '🐡', w: 7,  lv: 3, price: 160, kg: 3.0,  d: 0.15 },
    gurita:  { n: 'Gurita',      e: '🐙', w: 4,  lv: 3, price: 200, kg: 2.5,  d: 0.14 },
    tuna:    { n: 'Tuna',        e: '🐟', w: 3,  lv: 4, price: 450, kg: 18,   d: 0.10 },
    sepatu:  { n: 'Sepatu Bot',  e: '👢', w: 8,  lv: 1, price: 2,   kg: 0.8,  d: 0.40, junk: true },
    peti:    { n: 'Peti Harta',  e: '💰', w: 1,  lv: 1, price: 0,   kg: 5,    d: 0.12, coins: 350 },
  };
  Object.entries(FISH).forEach(([k, f]) => { if (!f.coins) ITEMS['ikan_' + k] = { n: f.n, e: f.e, price: f.price }; });
  const ROOFS = [0xc2410c, 0x1d4ed8, 0x15803d, 0x7c3aed, 0xdb2777, 0x0f766e, 0xca8a04, 0x111827];
  const SHOP = [
    ...Object.entries(CROPS).map(([k, c]) => ({ id: 'seed_' + k, n: 'Benih ' + c.n, e: c.e, price: c.seed, lv: c.lv, d: `Panen ${c.hours < 24 ? c.hours + ' jam' : c.hours / 24 + ' hari'} · hasil ${c.yield}×` })),
    { id: 'pakan', n: 'Pakan Ternak ×5', e: '🌾', price: 40, lv: 1, d: 'Untuk memberi makan hewan' },
    { id: 'umpan', n: 'Umpan Cacing ×10', e: '🪱', price: 30, lv: 1, d: 'Untuk memancing di Tempat Pemancingan' },
    { id: 'esteh', n: 'Es Teh Jumbo', e: '🧋', price: 60, lv: 1, d: '+30 energi (dari lapak @nindriluvita7)' },
    ...Object.entries(ANIMALS).map(([k, a]) => ({ id: 'animal_' + k, n: a.n, e: a.e, price: a.price, lv: a.lv, d: `Hasil: ${a.prodN} tiap hari` })),
    { id: 'barn2', n: 'Kandang Sedang (4 hewan)', e: '🏚️', price: 900, lv: 2, d: 'Muat 4 hewan' },
    { id: 'barn3', n: 'Kandang Besar (6 hewan)', e: '🏠', price: 2800, lv: 4, d: 'Muat 6 hewan' },
    { id: 'field4', n: 'Perluas Ladang 4×4', e: '🟫', price: 1500, lv: 3, d: '16 petak tanah' },
    { id: 'roof', n: 'Cat Atap Rumah', e: '🎨', price: 250, lv: 1, d: 'Ganti warna atap' },
    { id: 'fence', n: 'Pagar Kayu', e: '🪵', price: 450, lv: 2, d: 'Pagar keliling kebun' },
    { id: 'garden', n: 'Taman Bunga', e: '🌷', price: 600, lv: 3, d: 'Bunga di depan rumah' },
    { id: 'pet_pick', n: 'Peliharaan Kesayangan', e: '🐾', price: 0, lv: 5, d: 'Kucing oren, hitam, putih, telon & lainnya' },
  ];
  const PETS = {
    kucing_oren:  { n: 'Kucing Oren',  e: '🐈', def: 'Oyen',   k: 'cat', base: 0xf08a24, mark: 0xb4520f, belly: 0xfde7c8, eye: 0x16a34a, rec: true, sw: 'repeating-linear-gradient(110deg,#f08a24 0 7px,#b4520f 7px 10px)', d: 'Si oyen legendaris. Lincah & bikin rame kebun.' },
    kucing_hitam: { n: 'Kucing Hitam', e: '🐈‍⬛', def: 'Item',   k: 'cat', base: 0x1f2328, mark: 0x1f2328, belly: 0x2b3036, eye: 0xfacc15, sw: '#1f2328', d: 'Kalem, misterius, matanya kuning.' },
    kucing_putih: { n: 'Kucing Putih', e: '🐈', def: 'Salju',  k: 'cat', base: 0xf8fafc, mark: 0xf8fafc, belly: 0xffffff, eye: 0x3b82f6, sw: '#f1f5f9', d: 'Bulu seputih salju, mata biru.' },
    kucing_telon: { n: 'Kucing Telon', e: '🐈', def: 'Belang', k: 'cat', base: 0xf8fafc, mark: 0xf08a24, mark2: 0x1f2328, belly: 0xffffff, eye: 0x16a34a, sw: 'radial-gradient(circle at 30% 35%,#f08a24 0 28%,transparent 29%),radial-gradient(circle at 70% 65%,#1f2328 0 24%,transparent 25%),#f8fafc', d: 'Belang tiga: putih, oren, hitam. Pembawa hoki!' },
    kucing_abu:   { n: 'Kucing Abu',   e: '🐈', def: 'Kelabu', k: 'cat', base: 0x9ca3af, mark: 0x4b5563, belly: 0xe5e7eb, eye: 0xf59e0b, sw: 'repeating-linear-gradient(110deg,#9ca3af 0 7px,#4b5563 7px 10px)', d: 'Abu-abu loreng, suka tidur siang.' },
    kucing_siam:  { n: 'Kucing Siam',  e: '🐈', def: 'Moka',   k: 'cat', base: 0xf3e7d3, mark: 0x5b3a29, belly: 0xfaf3e8, eye: 0x38bdf8, point: true, sw: 'radial-gradient(circle at 50% 50%,#f3e7d3 0 45%,#5b3a29 46%)', d: 'Krem dengan wajah, telinga & ekor coklat.' },
    anjing:       { n: 'Anjing',       e: '🐕', def: 'Bruno',  k: 'dog', base: 0x92400e, mark: 0x78350f, belly: 0xfcd9a8, eye: 0x111111, sw: '#92400e', d: 'Setia menjaga kebunmu.' },
    kelinci:      { n: 'Kelinci',      e: '🐇', def: 'Kapas',  k: 'rabbit', base: 0xf5f5f4, mark: 0xfda4af, belly: 0xffffff, eye: 0x111111, sw: '#f5f5f4', d: 'Imut, suka loncat-loncat.' },
  };
  const PET_ALIAS = { kucing: 'kucing_oren' };
  const petDef = t => PETS[PET_ALIAS[t] || t];
  const ENERGY = { fish: 3, till: 4, plant: 2, water: 2, harvest: 1, feed: 2, pet: 1, collect: 1, clear: 2 };
  const DAILY_POOL = [
    { id: 'water', t: 'Siram tanaman', n: 8 }, { id: 'harvest', t: 'Panen hasil kebun', n: 4 }, { id: 'feed', t: 'Beri makan ternak', n: 2 },
    { id: 'pet', t: 'Elus hewan', n: 2 }, { id: 'till', t: 'Cangkul tanah', n: 4 }, { id: 'sell', t: 'Jual hasil senilai 150 koin', n: 150 },
    { id: 'plant', t: 'Tanam benih', n: 4 }, { id: 'collect', t: 'Ambil telur / susu', n: 2 }, { id: 'fish', t: 'Pancing 3 ikan', n: 3 }, { id: 'help', t: 'Bantu 1 kebun tetangga', n: 1 },
  ];
  const WEEKLY_POOL = [
    { id: 'harvest_tomat', t: 'Panen 15 tomat', n: 15, r: 350 }, { id: 'harvest', t: 'Panen 40 hasil kebun', n: 40, r: 450 },
    { id: 'collect', t: 'Kumpulkan 12 telur / susu', n: 12, r: 450 }, { id: 'sell', t: 'Jual hasil senilai 1.500 koin', n: 1500, r: 400 },
    { id: 'water', t: 'Siram 60 kali', n: 60, r: 350 }, { id: 'pet', t: 'Elus hewan 20 kali', n: 20, r: 350 },
    { id: 'harvest_jagung', t: 'Panen 8 jagung', n: 8, r: 450, lv: 2 }, { id: 'harvest_semangka', t: 'Panen 3 semangka', n: 3, r: 600, lv: 4 },
    { id: 'days', t: 'Main 5 hari minggu ini', n: 5, r: 500 }, { id: 'feed', t: 'Beri makan ternak 20 kali', n: 20, r: 400 },
    { id: 'plant', t: 'Tanam 30 benih', n: 30, r: 350 }, { id: 'fish', t: 'Pancing 20 ikan', n: 20, r: 450 }, { id: 'help', t: 'Bantu kebun tetangga 7 kali', n: 7, r: 450 },
    { id: 'fish_kakap', t: 'Dapat 2 Kakap Merah', n: 2, r: 500, lv: 2 }, { id: 'fish_tuna', t: 'Dapat 1 Tuna', n: 1, r: 700, lv: 4 },
  ];
  const WEEK_BONUS = 800;

  // ---------------- time (WIB) ----------------
  const WIB = 7 * 3600e3;
  const dayKey = ts => new Date(ts + WIB).toISOString().slice(0, 10);
  const dayEnd = ts => { const d = new Date(ts + WIB); d.setUTCHours(24, 0, 0, 0); return d.getTime() - WIB; };
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const weekKey = ts => { const d = new Date(ts + WIB); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
    const y = d.getUTCFullYear(), j1 = new Date(Date.UTC(y, 0, 4)); const wk = 1 + Math.round(((d - j1) / 864e5 - 3 + ((j1.getUTCDay() + 6) % 7)) / 7); return `${y}-W${String(wk).padStart(2, '0')}`; };
  const seeded = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return rnd((h >>> 0) % 2147483646 + 1); };
  const pickN = (pool, n, r) => { const a = pool.slice(); const out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };

  // ---------------- backend ----------------
  const api = CFG.url && CFG.key ? {
    online: true,
    async rpc(fn, body) {
      const r = await fetch(`${CFG.url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      if (!r.ok) throw new Error('Server ' + r.status); return r.json();
    },
  } : { // local test mode (one device only)
    online: false,
    db() { try { return JSON.parse(localStorage.getItem('pn_mock_farms') || '{}'); } catch { return {}; } },
    put(d) { try { localStorage.setItem('pn_mock_farms', JSON.stringify(d)); } catch {} },
    async rpc(fn, b) {
      const d = this.db();
      if (fn === 'farm_list') return Object.entries(d).map(([u, r]) => ({ username: u, ...r })).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const r = d[b.p_user];
      if (fn === 'farm_login') { if (!r) { d[b.p_user] = { pin: b.p_pin, state: {}, coins: 0, level: 1, hearts: 0, harvests: 0, missions_done: 0, created_at: new Date().toISOString() }; this.put(d); return { ok: true, new: true, state: {} }; }
        return r.pin === b.p_pin ? { ok: true, state: r.state } : { ok: false, err: 'PIN salah' }; }
      if (fn === 'chat_send') { if (!r || r.pin !== b.p_pin) return { ok: false, err: 'PIN salah' }; const c = JSON.parse(localStorage.getItem('pn_mock_chat') || '[]'); c.push({ id: c.length + 1, username: b.p_user, msg: b.p_msg.slice(0, 140), created_at: new Date().toISOString() }); localStorage.setItem('pn_mock_chat', JSON.stringify(c)); r.last_seen = Date.now(); this.put(d); return { ok: true }; }
      if (fn === 'chat_list') { const c = JSON.parse(localStorage.getItem('pn_mock_chat') || '[]'); return { msgs: c.filter(m => m.id > (b.p_since || 0)).slice(-60), online: Object.entries(d).filter(([u, x]) => x.last_seen > Date.now() - 180000).map(([u]) => u) }; }
      if (fn === 'farm_ping') { if (r) { r.last_seen = Date.now(); this.put(d); } return { ok: !!r }; }
      if (fn === 'community_get' || fn === 'community_add') { const c = JSON.parse(localStorage.getItem('pn_mock_gr') || '{}'); const w = c[b.p_week] || { totals: {}, people: {} };
        if (fn === 'community_add') { if (!r || r.pin !== b.p_pin) return { ok: false, err: 'PIN salah' }; w.totals[b.p_item] = (w.totals[b.p_item] || 0) + b.p_qty; w.people[b.p_user] = (w.people[b.p_user] || 0) + b.p_qty; c[b.p_week] = w; localStorage.setItem('pn_mock_gr', JSON.stringify(c)); return { ok: true, ...w }; } return w; }
      if (fn === 'farm_help') { if (!r || r.pin !== b.p_pin) return { ok: false, err: 'PIN salah' }; const h = JSON.parse(localStorage.getItem('pn_mock_help') || '[]'); if (h.some(x => x.target === b.p_target && x.helper === b.p_user && x.kind === b.p_kind && x.day === b.p_day)) return { ok: false, err: 'Kamu sudah membantu kebun ini hari ini' }; h.push({ id: h.length + 1, target: b.p_target, helper: b.p_user, kind: b.p_kind, day: b.p_day }); localStorage.setItem('pn_mock_help', JSON.stringify(h)); return { ok: true }; }
      if (fn === 'help_list') { const h = JSON.parse(localStorage.getItem('pn_mock_help') || '[]'); return h.filter(x => x.target === b.p_user && x.id > (b.p_since || 0)); }
      if (fn === 'farm_save') { if (!r || r.pin !== b.p_pin) return { ok: false, err: 'PIN salah' }; Object.assign(r, { state: b.p_state, coins: b.p_coins, level: b.p_level, hearts: b.p_hearts, harvests: b.p_harvests, week_key: b.p_week, missions_done: b.p_missions, updated_at: new Date().toISOString() }); this.put(d); return { ok: true }; }
    },
  };

  // ---------------- state ----------------
  const newState = () => ({
    v: 1, coins: 300, xp: 0, level: 1, energy: 100, eDay: null, field: 3,
    tiles: Array.from({ length: 16 }, () => ({ s: 'grass' })),
    animals: [], barn: 2, inv: { seed_lobak: 6, seed_tomat: 3, pakan: 5, umpan: 10 },
    house: { roof: 0, fence: false, garden: false },
    streak: 0, lastDay: null, days: [],
    daily: null, weekly: null, badges: [], stats: { harvest: 0, collect: 0, sold: 0, fish: 0 }, best: null, seed: 'lobak',
  });
  const xpNeed = lv => 60 + lv * 45;
  const maxEnergy = s => 100 + (s.level - 1) * 5;
  const tilesIdx = s => { const out = []; for (let r = 0; r < s.field; r++) for (let c = 0; c < s.field; c++) out.push(r * 4 + c); return out; };

  function ensureMissions(s, now) {
    const dk = dayKey(now), wk = weekKey(now);
    if (!s.daily || s.daily.day !== dk) {
      const r = seeded('d' + dk);
      s.daily = { day: dk, list: pickN(DAILY_POOL, 3, r).map(m => ({ id: m.id, p: 0, done: false })), };
    }
    if (!s.weekly || s.weekly.week !== wk) {
      const r = seeded('w' + wk);
      const pool = WEEKLY_POOL.filter(m => !m.lv || m.lv <= Math.max(2, s.level));
      s.weekly = { week: wk, list: pickN(pool, 3, r).map(m => ({ id: m.id, p: 0, done: false })), bonus: false };
    }
  }
  // advance everything to "now": growth, withering, animals, new day
  function tickState(s, now, msgs) {
    const dk = dayKey(now);
    if (s.lastDay !== dk) { // new day
      if (s.lastDay) {
        const gap = daysBetween(s.lastDay, dk);
        s.streak = gap === 1 ? s.streak + 1 : 1;
        s.animals.forEach(a => { const miss = a.fed ? Math.max(0, daysBetween(a.fed, dk) - 1) : gap; if (miss > 0) a.h = Math.max(0, a.h - miss); });
      } else s.streak = 1;
      s.lastDay = dk;
      const cal = calReward(s); if (msgs) msgs.push(`📅 Hadiah login hari ke-${cal.day}: ${cal.txt}`);
      const wx = weatherOf(dk); if (msgs) msgs.push(`${wx.e} Cuaca hari ini: ${wx.n} (${wx.season}). ${wx.tip}`);
      const wk = weekKey(now); s.days = (s.days || []).filter(d => weekKey(Date.parse(d + 'T12:00:00+07:00')) === wk); if (!s.days.includes(dk)) s.days.push(dk);
    }
    if (s.eDay !== dk) { s.energy = maxEnergy(s); s.eDay = dk; }
    ensureMissions(s, now);
    const dm = s.weekly.list.find(m => m.id === 'days'); if (dm) setProg(s, dm, s.days.length, msgs, true);
    const rain = weatherOf(dk).rain, dayStart = dayEnd(now) - 864e5;
    for (const t of s.tiles) {
      if (t.s !== 'crop') continue;
      if (rain && !wateredToday(t, now)) t.wt = Math.max(dayStart, t.p || dayStart); // hujan = tersiram otomatis
      const u = t.u || now;
      if (t.wt) { const a = Math.max(u, t.wt), b = Math.min(now, dayEnd(t.wt)); if (b > a) t.g = (t.g || 0) + (b - a) / 3600e3; }
      t.u = now;
      const lastW = t.wt ? dayKey(t.wt) : dayKey(t.p || now);
      if (daysBetween(lastW, dk) >= (weatherOf(dk).dry ? 2 : 3) && !isReady(t)) { t.s = 'dead'; }
    }
  }
  const isReady = t => t.s === 'crop' && (t.g || 0) >= CROPS[t.c].hours;
  const wateredToday = (t, now) => t.wt && dayKey(t.wt) === dayKey(now);

  function setProg(s, m, val, msgs, absolute) {
    const def = (s.daily.list.includes(m) ? DAILY_POOL : WEEKLY_POOL).find(d => d.id === m.id);
    if (m.done) return;
    m.p = absolute ? val : m.p + val;
    if (m.p >= def.n) {
      m.p = def.n; m.done = true;
      const isW = s.weekly.list.includes(m); const rew = isW ? def.r : 50;
      s.coins += rew; addXP(s, isW ? 60 : 15, msgs);
      if (msgs) msgs.push(`🎯 Misi ${isW ? 'mingguan' : 'harian'} selesai: ${def.t} (+${rew} koin)`);
      if (isW && !s.weekly.bonus && s.weekly.list.every(x => x.done)) {
        s.weekly.bonus = true; s.coins += WEEK_BONUS; s.badges = [...(s.badges || []), s.weekly.week];
        if (msgs) msgs.push(`🏅 Semua misi mingguan selesai! +${WEEK_BONUS} koin & lencana WARGA TELADAN`);
      }
    }
  }
  function emit(s, ev, amt = 1, extra, msgs) {
    for (const m of [...s.daily.list, ...s.weekly.list]) {
      if (m.id === ev || (extra && m.id === ev + '_' + extra)) setProg(s, m, amt, msgs);
    }
  }
  function addXP(s, n, msgs) {
    s.xp += n;
    while (s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level++; if (msgs) msgs.push(`⭐ Naik ke Level ${s.level}! Barang baru terbuka di toko.`); if (s.level === 5 && !s.pet) { s._petOffer = 1; if (msgs) msgs.push('🐾 Level 5! Sekarang kamu bisa memilih peliharaan kesayangan. Kucing oren direkomendasikan 😺'); } }
  }
  const heartsTotal = s => s.animals.reduce((a, b) => a + b.h, 0);

  // ---------------- 3D farm models ----------------
  const FARMS = new Map(); // username -> view
  const M = c => mat(c);
  const box = (w, h, d, c, x, y, z, sh = true) => mesh(new THREE.BoxGeometry(w, h, d), M(c), x, y, z, sh);
  const L = { house: V(-1.35, 0, -1.45), field: V(0.9, 0, -0.35), barn: V(-1.35, 0, 1.15), sign: V(0.9, 0, 2.05) };
  const TS = 0.6;
  const tilePos = (i) => { const r = Math.floor(i / 4), c = i % 4; return V(L.field.x + (c - 1.5) * TS, 0, L.field.z + (r - 1.5) * TS); };
  function cropMesh(t, now) {
    const g = new THREE.Group(); const c = CROPS[t.c];
    if (t.s === 'dead') { for (let k = 0; k < 3; k++) { const s = mesh(new THREE.ConeGeometry(0.04, 0.22, 4), M(0x7c5a32), (k - 1) * 0.1, 0.11, 0, false); s.rotation.z = (k - 1) * 0.5; g.add(s); } return g; }
    const k = Math.min(1, (t.g || 0) / c.hours), ready = k >= 1;
    const leaf = M(0x3f9d3a);
    if (k < 0.2) { g.add(mesh(new THREE.SphereGeometry(0.05, 6, 4), leaf, 0, 0.04, 0, false)); return g; }
    const h = 0.15 + 0.35 * k;
    if (t.c === 'jagung') { g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, h * 1.6, 5), leaf, 0, h * 0.8, 0)); for (const s of [-1, 1]) { const l = mesh(new THREE.ConeGeometry(0.04, 0.3, 3), leaf, s * 0.07, h * 0.9, 0, false); l.rotation.z = s * 0.9; g.add(l); }
      if (ready) g.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.16, 6), M(c.col), 0.05, h * 1.1, 0.03)); return g; }
    if (t.c === 'semangka') { for (let q = 0; q < 4; q++) { const l = mesh(new THREE.SphereGeometry(0.07, 5, 4), leaf, Math.cos(q * 1.6) * 0.12, 0.05, Math.sin(q * 1.6) * 0.12, false); l.scale.y = 0.4; g.add(l); }
      if (k > 0.5) { const w = mesh(new THREE.SphereGeometry(ready ? 0.17 : 0.1, 10, 8), M(c.col), 0, ready ? 0.15 : 0.09, 0); w.scale.set(1.15, 0.9, 1); g.add(w); } return g; }
    if (t.c === 'lobak') { for (let q = 0; q < 3; q++) { const l = mesh(new THREE.ConeGeometry(0.035, h, 3), leaf, (q - 1) * 0.05, h / 2 + 0.05, 0, false); l.rotation.z = (q - 1) * 0.35; g.add(l); }
      if (ready) g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), M(c.col), 0, 0.05, 0)); return g; }
    // bushes: tomat, cabai, terong
    const b = mesh(new THREE.SphereGeometry(0.1 + 0.08 * k, 7, 5), leaf, 0, 0.08 + h * 0.5, 0); b.scale.y = 1.3; g.add(b);
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, h + 0.1, 4), M(0x8b5a2b), 0.1, (h + 0.1) / 2, 0, false));
    if (ready) for (let q = 0; q < (t.c === 'cabai' ? 5 : 3); q++) {
      const a = q * 2.1, fx = Math.cos(a) * 0.1, fz = Math.sin(a) * 0.1 + 0.04, fy = 0.12 + h * 0.4 + (q % 2) * 0.08;
      const f = t.c === 'cabai' ? mesh(new THREE.ConeGeometry(0.02, 0.09, 5), M(c.col), fx, fy, fz, false) : mesh(new THREE.SphereGeometry(t.c === 'terong' ? 0.045 : 0.05, 7, 5), M(c.col), fx, fy, fz, false);
      if (t.c === 'terong') f.scale.y = 1.7; if (t.c === 'cabai') f.rotation.x = Math.PI; g.add(f);
    }
    return g;
  }
  function animalMesh(type) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    if (type === 'ayam' || type === 'bebek') {
      const col = type === 'ayam' ? 0xfafafa : 0xfef3c7;
      const b = mesh(new THREE.SphereGeometry(0.13, 8, 6), M(col), 0, 0.17, 0); b.scale.set(1, 0.9, 1.2); body.add(b);
      const hd = mesh(new THREE.SphereGeometry(0.08, 8, 6), M(col), 0, 0.3, 0.1); body.add(hd);
      body.add(mesh(new THREE.ConeGeometry(0.03, 0.07, 4), M(0xf59e0b), 0, 0.29, 0.19, false)).rotation.x = Math.PI / 2;
      if (type === 'ayam') body.add(mesh(new THREE.BoxGeometry(0.02, 0.06, 0.07), M(0xdc2626), 0, 0.39, 0.1, false));
      else body.children[2].scale.set(1.8, 1, 0.8);
      for (const s of [-1, 1]) body.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 4), M(0xf59e0b), s * 0.05, 0.04, 0, false));
      for (const s of [-1, 1]) body.add(mesh(new THREE.SphereGeometry(0.015, 5, 4), M(0x111111), s * 0.045, 0.32, 0.16, false));
      g.userData.h = 0.4;
    } else {
      const sapi = type === 'sapi', col = sapi ? 0xffffff : 0xe7e5e4, sc = sapi ? 1 : 0.8;
      const b = mesh(new THREE.BoxGeometry(0.3 * sc, 0.26 * sc, 0.5 * sc), M(col), 0, 0.34 * sc, 0); body.add(b);
      if (sapi) for (const [x, y, z] of [[0.1, 0.4, 0.05], [-0.08, 0.36, -0.12], [0.06, 0.3, -0.18]]) body.add(box(0.12, 0.1, 0.12, 0x111111, x * 1.01, y, z, false));
      const hd = box(0.2 * sc, 0.2 * sc, 0.2 * sc, col, 0, 0.45 * sc, 0.3 * sc); body.add(hd);
      body.add(box(0.14 * sc, 0.09 * sc, 0.06 * sc, sapi ? 0xf9a8d4 : 0xd6d3d1, 0, 0.41 * sc, 0.41 * sc, false));
      for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.025, 0.1, 4), M(0xe7e5e4), s * 0.07 * sc, 0.6 * sc, 0.28 * sc, false); h.rotation.z = -s * 0.4; body.add(h); }
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) body.add(box(0.06 * sc, 0.22 * sc, 0.06 * sc, col, x * 0.1 * sc, 0.11 * sc, z * 0.17 * sc));
      if (!sapi) body.add(mesh(new THREE.ConeGeometry(0.03, 0.09, 4), M(0xd6d3d1), 0, 0.33 * sc, 0.42 * sc, false)).rotation.x = Math.PI; // beard
      for (const s of [-1, 1]) body.add(mesh(new THREE.SphereGeometry(0.018, 5, 4), M(0x111111), s * 0.06 * sc, 0.49 * sc, 0.4 * sc, false));
      g.userData.h = 0.75 * sc;
    }
    return g;
  }
  function signTex(u, title) {
    return canvasTex(512, 128, (x, w, h) => { x.fillStyle = '#fff8e6'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8b5a2b'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
      let fs = title ? 44 : 56; x.font = `800 ${fs}px Poppins`; while (x.measureText('@' + u).width > w - 30 && fs > 22) { fs -= 4; x.font = `800 ${fs}px Poppins`; }
      x.fillStyle = '#3a2300'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('@' + u, w / 2, title ? 46 : h / 2 + 2);
      if (title) { x.font = '700 30px Poppins'; x.fillStyle = '#b45309'; x.fillText(title, w / 2, 96); } });
  }
  function buildFarm(u, idx) {
    const root = new THREE.Group(); scene.add(root); root.position.copy(desaPlot(idx));
    DESA_TAKEN.add(idx);
    // ground patch + path
    root.add(box(DESA.PW - 0.5, 0.06, DESA.PD - 0.8, 0x7ccf5a, 0, 0.0, -0.1, false));
    // house
    const hs = new THREE.Group(); hs.position.copy(L.house); root.add(hs);
    hs.add(box(1.25, 0.85, 1.0, 0xe7cfa6, 0, 0.45, 0));
    const sh = new THREE.Shape(); sh.moveTo(-0.78, 0); sh.lineTo(0.78, 0); sh.lineTo(0, 0.6); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 1.15, bevelEnabled: false }); rg.translate(0, 0, -0.575);
    const roofM = M(ROOFS[0]); const roof = new THREE.Mesh(rg, roofM); roof.castShadow = true; roof.position.y = 0.88; hs.add(roof);
    hs.add(box(0.28, 0.5, 0.03, 0x5b3a1e, -0.25, 0.3, 0.51, false)); hs.add(box(0.26, 0.22, 0.03, 0xbfe3ff, 0.3, 0.55, 0.51, false));
    const garden = new THREE.Group(); hs.add(garden); garden.position.set(0, 0, 0.75);
    [0xf472b6, 0xfacc15, 0xef4444, 0xa855f7, 0xffffff].forEach((c, k) => { garden.add(mesh(new THREE.SphereGeometry(0.06, 6, 5), M(c), -0.5 + k * 0.25, 0.12, 0, false)); garden.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), M(0x3f9d3a), -0.5 + k * 0.25, 0.06, 0, false)); });
    // field tiles
    const tiles = [];
    for (let i = 0; i < 16; i++) {
      const tp = tilePos(i); const tm = box(TS - 0.05, 0.08, TS - 0.05, 0x8b5a2b, tp.x, 0.04, tp.z, false);
      tm.userData.farmTile = { u, i }; root.add(tm); tiles.push({ m: tm, crop: null, key: '' });
    }
    // barn: fence + shed
    const barn = new THREE.Group(); barn.position.copy(L.barn); root.add(barn);
    const wd = M(0x9a6a3a);
    for (const [x, z, w, d] of [[0, -0.62, 1.95, 0.04], [0, 0.62, 1.95, 0.04], [-0.97, 0, 0.04, 1.24], [0.97, 0, 0.04, 1.24]]) { barn.add(mesh(new THREE.BoxGeometry(w, 0.05, d), wd, x, 0.28, z, false)); barn.add(mesh(new THREE.BoxGeometry(w, 0.05, d), wd, x, 0.14, z, false)); }
    for (const [x, z] of [[-0.97, -0.62], [0.97, -0.62], [-0.97, 0.62], [0.97, 0.62]]) barn.add(mesh(new THREE.BoxGeometry(0.07, 0.38, 0.07), wd, x, 0.19, z));
    barn.add(box(0.7, 0.45, 0.4, 0xb45309, -0.6, 0.23, -0.4)); barn.add(box(0.8, 0.06, 0.5, 0x7f1d1d, -0.6, 0.48, -0.4));
    // fence decor
    const fence = new THREE.Group(); root.add(fence);
    for (const [x, z, w, d] of [[0, -DESA.PD / 2 + 0.45, DESA.PW - 0.5, 0.04], [-DESA.PW / 2 + 0.25, -0.1, 0.04, DESA.PD - 1.1], [DESA.PW / 2 - 0.25, -0.1, 0.04, DESA.PD - 1.1]]) fence.add(mesh(new THREE.BoxGeometry(w, 0.05, d), wd, x, 0.3, z, false));
    // sign
    const sg = new THREE.Group(); sg.position.copy(L.sign); root.add(sg);
    sg.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), wd, 0, 0.4, 0));
    const sm = new THREE.MeshStandardMaterial({ map: signTex(u) }); sg.add(mesh(new THREE.BoxGeometry(1.2, 0.3, 0.04), [wd, wd, wd, wd, sm, wd], 0, 0.75, 0));
    const badge = mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3, emissive: 0x7a5a00, emissiveIntensity: 0.3 }), 0.7, 0.75, 0.03, false); sg.add(badge);
    const v = { u, idx, root, tiles, roofM, garden, fence, barn, badge, animals: [], aKey: '', signM: sm, title: '', pet: null, petKey: '' };
    FARMS.set(u, v); return v;
  }
  function renderFarm(v, s, now) {
    v.roofM.color.setHex(ROOFS[s.house?.roof || 0]); v.garden.visible = !!s.house?.garden; v.fence.visible = !!s.house?.fence;
    v.badge.visible = (s.badges || []).length > 0;
    const ttl = s.title && TITLES[s.title] ? TITLES[s.title].n : '';
    if (ttl !== v.title) { v.signM.map.dispose(); v.signM.map = signTex(v.u, ttl); v.signM.needsUpdate = true; v.title = ttl; }
    const pk = s.pet ? s.pet + '|' + (s.petName || '') : ''; if (pk !== v.petKey) { if (v.pet) v.root.remove(v.pet.g); v.pet = null; if (s.pet && petDef(s.pet)) { const g = petMesh(s.pet, s.petName || petDef(s.pet).def); g.position.set(0.3, 0.05, 1.3); v.root.add(g); v.pet = { g, tgt: g.position.clone(), ph: Math.random() * 6, jump: 0 }; } v.petKey = pk; }
    const act = new Set(tilesIdx(s));
    v.tiles.forEach((T, i) => {
      const t = s.tiles[i] || { s: 'grass' };
      T.m.visible = act.has(i);
      const col = t.s === 'grass' ? 0x6bbf4e : (t.s === 'crop' && wateredToday(t, now)) ? 0x4a2f17 : 0x8b5a2b;
      T.m.material.color.setHex(col);
      const k = t.s === 'crop' ? `${t.c}:${Math.min(4, Math.floor(Math.min(1, (t.g || 0) / CROPS[t.c].hours) * 4.999))}` : t.s === 'dead' ? 'dead' : '';
      if (k !== T.key) {
        if (T.crop) { v.root.remove(T.crop); T.crop = null; }
        if (k && act.has(i)) { T.crop = cropMesh(t, now); T.crop.position.copy(tilePos(i)).add(V(0, 0.08, 0)); v.root.add(T.crop); }
        T.key = k;
      }
    });
    const ak = s.animals.map(a => a.t).join(',') + '|' + s.barn;
    if (ak !== v.aKey) {
      v.animals.forEach(a => v.barn.remove(a.g)); v.animals = [];
      s.animals.forEach((a, j) => { const g = animalMesh(a.t); g.userData.farmAnimal = { u: v.u, j }; g.traverse(o => o.userData.farmAnimal = { u: v.u, j }); v.barn.add(g);
        const x = -0.55 + (j % 3) * 0.55, z = 0.05 + Math.floor(j / 3) * 0.35; g.position.set(x + 0.2, 0, z); v.animals.push({ g, home: V(x + 0.2, 0, z), ph: j * 1.7, tgt: V(x + 0.2, 0, z) }); });
      v.aKey = ak;
    }
  }
  function animateFarms(t, dt) {
    for (const v of FARMS.values()) if (v.pet) { const P = v.pet, p = P.g.position;
      if (P.jump > 0) { P.jump = Math.max(0, P.jump - dt * 2.5); P.g.position.y = 0.05 + Math.sin(P.jump * Math.PI) * 0.18; } else P.g.position.y = 0.05;
      const own = ME && ME.v === v && ME.ent && ME.ent.m; let fol = false;
      if (own) { const ap = v.root.worldToLocal(ME.ent.m.root.position.clone()); if (Math.abs(ap.x) < 4.5 && Math.abs(ap.z) < 4.5) { fol = true; const off = V(0.45, 0, 0.35); if (p.distanceTo(ap.clone().add(off)) > 0.7) P.tgt.set(ap.x + off.x, 0.05, ap.z + off.z); } }
      if (p.distanceTo(P.tgt) < 0.05) { if (!fol && Math.random() < dt * 0.5) P.tgt.set((Math.random() - 0.5) * 3.6, 0.05, -1.6 + Math.random() * 3.4); }
      else { const d = P.tgt.clone().sub(p); d.y = 0; p.addScaledVector(d.normalize(), Math.min(d.length(), dt * (fol ? 1.3 : 0.6))); P.g.rotation.y = Math.atan2(d.x, d.z); P.g.children[0].position.y = Math.abs(Math.sin(t * 9 + P.ph)) * 0.03; }
      P.g.children[0].children.forEach(c => { if (c.userData.tail) c.rotation.z = Math.sin(t * 8 + P.ph) * 0.6; }); }
    for (const v of FARMS.values()) v.animals.forEach((A, j) => {
      const g = A.g, p = g.position;
      if (p.distanceTo(A.tgt) < 0.03) { if (Math.random() < dt * 0.4) A.tgt.set(clamp(A.home.x + (Math.random() - 0.5) * 0.5, -0.8, 0.85), 0, clamp(A.home.z + (Math.random() - 0.5) * 0.5, -0.45, 0.5)); }
      else { const d = A.tgt.clone().sub(p); const st = Math.min(d.length(), dt * 0.25); p.addScaledVector(d.normalize(), st); g.rotation.y = Math.atan2(d.x, d.z); }
      g.children[0].position.y = Math.abs(Math.sin(t * 6 + A.ph)) * 0.02;
      g.children[0].rotation.x = (Math.sin(t * 1.3 + A.ph) > 0.85) ? 0.35 : 0; // peck / graze
    });
  }

  // ---------------- other players ----------------
  let LIST = [];
  async function refreshList() {
    try { LIST = await api.rpc('farm_list'); } catch (e) { return; }
    LIST.forEach((r, i) => {
      if (i >= DESA.cols * DESA.rows) return;
      let v = FARMS.get(r.username); if (!v) v = buildFarm(r.username, i);
      const s = (ME && ME.u === r.username) ? ME.s : r.state;
      if (s && s.tiles) { renderFarm(v, s, Date.now()); applyCostume(r.username, s); }
    });
  }
  refreshList(); setInterval(refreshList, 60000);

  // ---------------- UI ----------------
  const css = document.createElement('style'); css.textContent = `
  #gHud{position:fixed;left:12px;right:12px;top:10px;display:none;gap:8px;align-items:center;z-index:5;font-family:Poppins,sans-serif}
  body.game #gHud{display:flex} body.game #top, body.game #bottom, body.game #upd{display:none}
  .gchip{background:rgba(255,255,255,.95);border-radius:12px;padding:6px 10px;box-shadow:0 3px 10px rgba(0,0,0,.15);font-weight:800;font-size:13px;display:flex;align-items:center;gap:5px;white-space:nowrap}
  #gEn{flex:1;min-width:80px} #gEnBar{flex:1;height:9px;border-radius:6px;background:#e5e7eb;overflow:hidden} #gEnBar i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#a3e635)}
  #gBar{position:fixed;left:0;right:0;bottom:12px;display:none;justify-content:center;gap:6px;padding:0 8px;z-index:5}
  body.gp #gBar, body.gp #gTip{display:none!important}
  .gpanel{z-index:9}
  #gExit{border:0;border-radius:12px;background:rgba(255,255,255,.95);width:36px;height:34px;font:800 15px Poppins;box-shadow:0 3px 10px rgba(0,0,0,.15)}
  #bottom{flex-wrap:wrap} #btnPlay{flex:1 1 auto;font-size:15px!important;padding:12px!important} #bottom .brk{flex-basis:100%;height:0}
  body.game #gBar{display:grid}
  /* semua panel: sisakan ruang di bawah untuk badge Netlify */
  .panel{padding-bottom:calc(66px + env(safe-area-inset-bottom))}
  .gpetgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 8px;padding-top:8px}
  .gpet{position:relative;border:2px solid #e5e7eb;border-radius:14px;background:#fff;padding:8px 2px 6px;text-align:center;font:700 11px Poppins,sans-serif;color:#14181f;cursor:pointer}
  .gpet .sw{width:40px;height:40px;border-radius:50%;margin:0 auto 4px;border:2px solid rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;font-size:20px}
  .gpet.on{border-color:#ea580c;background:#fff7ed;box-shadow:0 0 0 3px rgba(234,88,12,.18)}
  .gpet .rec{position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#ea580c;color:#fff;font-size:8.5px;padding:1px 6px;border-radius:8px;white-space:nowrap}
  /* naik di atas badge Netlify + 2 baris supaya semua tombol kelihatan */
  #gBar{bottom:calc(78px + env(safe-area-inset-bottom));grid-template-columns:repeat(4,1fr);gap:7px;left:12px;right:12px;padding:0;max-width:440px;margin:0 auto}
  #gBar button{min-width:0;padding:7px 2px} #gBar #gSeed{grid-column:span 2}
  #gFishBar{bottom:calc(78px + env(safe-area-inset-bottom))}
  #gTip{bottom:calc(196px + env(safe-area-inset-bottom))!important}
  #bottom{bottom:calc(78px + env(safe-area-inset-bottom))!important}
  #card{bottom:calc(78px + env(safe-area-inset-bottom))!important} #card:not(.on){transform:translate(-50%,calc(100% + 140px))}
  #upd{bottom:calc(190px + env(safe-area-inset-bottom))!important}
  #gBar button small{display:block;font-size:9.5px;font-weight:700;margin-top:1px} #gBar .dot{position:absolute;top:-4px;right:-4px}
  #gBar button{position:relative;border:0;border-radius:14px;background:#fff;padding:6px 7px;min-width:44px;font:700 15px Poppins,sans-serif;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.18);color:#14181f}
  #gBar button.pri{background:#16a34a;color:#fff;font-size:14px} #gBar .dot{display:inline-block;min-width:16px;height:16px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;line-height:16px;margin-left:4px}
  #btnPlay{background:#16a34a!important;color:#fff!important}
  .gpanel .pb{padding:6px 14px 18px;min-height:0;flex:1 1 auto;overflow-y:auto;background:#fff}
  .gitem{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #f0ede6}
  .gitem .ic{font-size:26px;width:36px;text-align:center} .gitem .tx{flex:1;min-width:0} .gitem b{display:block;font-size:14px} .gitem span{font-size:12px;color:#5b6472}
  .gitem button{border:0;border-radius:10px;padding:7px 11px;font:700 12.5px Poppins,sans-serif;background:#16a34a;color:#fff} .gitem button:disabled{background:#d1d5db;color:#6b7280}
  .gmis{padding:9px 2px;border-bottom:1px solid #f0ede6} .gmis b{font-size:13.5px} .gmis .bar{height:8px;border-radius:5px;background:#eef2f7;margin-top:5px;overflow:hidden} .gmis .bar i{display:block;height:100%;background:#f59e0b}
  .gmis.done b{color:#16a34a} .gmis.done .bar i{background:#16a34a}
  .gtabs{display:flex;gap:6px;margin:6px 0 4px} .gtabs button{border:0;border-radius:20px;padding:6px 12px;font:700 12.5px Poppins,sans-serif;background:#f3f4f6} .gtabs button.on{background:#14181f;color:#fff}
  #gLogin .how input{width:100%;height:46px;border:2px solid #e5e7eb;border-radius:12px;padding:0 12px;font:600 16px Poppins,sans-serif;margin:6px 0 10px;box-sizing:border-box}
  #gLogin .how button.go{width:100%;height:46px;border:0;border-radius:12px;background:#16a34a;color:#fff;font:800 15px Poppins,sans-serif}
  #gFishBar{position:fixed;left:0;right:0;bottom:12px;display:none;justify-content:center;gap:8px;z-index:5}
  body.fishing #gFishBar{display:flex} body.fishing #gBar{display:none!important}
  #gFishBar button{border:0;border-radius:14px;background:#fff;padding:11px 14px;font:800 14px Poppins,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.18)} #gFishBar button.pri{background:#0ea5e9;color:#fff;min-width:150px}
  #gFishBar button.bite{background:#ef4444;color:#fff;animation:gp .35s infinite alternate} @keyframes gp{to{transform:scale(1.08)}}
  #gReel{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);width:min(340px,calc(100% - 40px));background:rgba(255,255,255,.97);border-radius:18px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);display:none;z-index:7;text-align:center;font-family:Poppins,sans-serif}
  #gReel.on{display:block} #gReel .t{font-weight:800;font-size:14px;margin-bottom:10px}
  #gReel .trk{position:relative;height:26px;border-radius:13px;background:#e0f2fe;overflow:hidden} #gReel .zone{position:absolute;top:0;bottom:0;background:#22c55e;border-radius:6px}
  #gReel .mk{position:absolute;top:-2px;width:6px;height:30px;background:#111827;border-radius:3px}
  #gReel button{margin-top:12px;width:100%;height:50px;border:0;border-radius:14px;background:#ef4444;color:#fff;font:900 18px Poppins,sans-serif}
  #gChatIn{display:flex;gap:8px;padding:10px 12px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #f0ede6}
  #gChatIn input{flex:1;height:42px;border:2px solid #e5e7eb;border-radius:12px;padding:0 12px;font:600 14px Poppins,sans-serif;min-width:0}
  #gChatIn button{border:0;border-radius:12px;background:#16a34a;color:#fff;font:800 14px Poppins,sans-serif;padding:0 16px}
  .gmsg{margin:6px 0;max-width:85%} .gmsg b{font-size:12px} .gmsg i{font-style:normal;font-size:10.5px;color:#9ca3af;margin-left:6px}
  .gmsg p{margin:2px 0 0;background:#f3f4f6;border-radius:12px 12px 12px 4px;padding:7px 10px;font-size:14px;line-height:1.35;word-wrap:break-word}
  .gmsg.me{margin-left:auto;text-align:right} .gmsg.me p{background:#dcfce7;border-radius:12px 12px 4px 12px;text-align:left}
  .gmsg.sys p{background:#fff7e6;color:#7a4b00;font-weight:600}
  .gmsg.bt b{color:#92400e} .gmsg.bt b:after{content:'👑 Kepala Pulau';margin-left:6px;font-size:10px;font-weight:800;color:#fff;background:#d97706;padding:1px 7px;border-radius:8px;vertical-align:1px}
  .gmsg.bt p{background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #f59e0b;color:#3b2500}
  .gmsg.pin{max-width:100%} .gmsg.pin p{background:linear-gradient(135deg,#fef3c7,#fff7e6);border:1.5px dashed #f59e0b;color:#3b2500;font-weight:600}
  .gmsg.pin b{color:#92400e}
  #gP_chat{height:72vh}
  #gHelp{position:fixed;left:50%;top:58px;transform:translateX(-50%);display:none;gap:6px;align-items:center;background:rgba(255,255,255,.96);border-radius:14px;padding:6px 8px;box-shadow:0 4px 14px rgba(0,0,0,.2);z-index:5;font:800 12.5px Poppins,sans-serif;white-space:nowrap}
  #gHelp button{border:0;border-radius:10px;background:#0ea5e9;color:#fff;font:800 12px Poppins,sans-serif;padding:6px 9px} #gHelp #gHelpF{background:#16a34a} #gHelp #gHelpBack{background:#f3f4f6;color:#111}
  body.gp #gHelp{display:none!important}
  .gbtn{border:0;border-radius:8px;background:#16a34a;color:#fff;font:700 11.5px Poppins,sans-serif;padding:4px 9px} .gbtn:disabled{background:#d1d5db}
  .gbig{width:100%;height:46px;border:0;border-radius:12px;background:#16a34a;color:#fff;font:800 14px Poppins,sans-serif;margin-top:10px}
  #gTip{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);background:rgba(20,24,31,.88);color:#fff;font:600 12.5px Poppins,sans-serif;padding:7px 12px;border-radius:12px;display:none;z-index:5;max-width:calc(100% - 40px);text-align:center}
  body.game #gTip{display:block}
  #gFloat{position:fixed;inset:0;pointer-events:none;z-index:6;overflow:hidden} #gFloat div{position:absolute;font:800 15px Poppins,sans-serif;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.6);transition:transform 1.1s ease-out,opacity 1.1s;white-space:nowrap}
  `; document.head.appendChild(css);
  const ui = document.createElement('div'); ui.innerHTML = `
  <div id="gHud"><div class="gchip" id="gWx" style="cursor:pointer">☀️</div><div class="gchip" id="gCloB" style="cursor:pointer">👗</div><div class="gchip" id="gLv">Lv 1</div><div class="gchip">🪙 <span id="gCoin">0</span></div><div class="gchip" id="gEn">⚡<div id="gEnBar"><i></i></div><span id="gEnT">100</span></div><button id="gExit">✕</button></div>
  <div id="gTip">Ketuk tanah untuk mencangkul · ketuk lagi untuk menanam</div>
  <div id="gBar"><button id="gSeed" class="pri">🌱 Benih</button><button id="gShop">🏪<small>Toko</small></button><button id="gBag">🎒<small>Tas</small></button><button id="gMis">🎯<small>Misi</small><span class="dot" id="gMisDot" style="display:none">!</span></button><button id="gFishB">🎣<small>Mancing</small></button><button id="gChatB">💬<small>Chat</small><span class="dot" id="gChatDot" style="display:none"></span></button><button id="gRank">🏆<small>Juara</small></button></div>
  <div id="gFishBar"><button id="gCast" class="pri">🎣 Lempar Kail</button><button id="gFishBag">🎒</button><button id="gFishBack">🏡 Pulang</button></div>
  <div id="gReel"><div class="t" id="gReelT">Tarik saat penanda di zona hijau!</div><div class="trk"><div class="zone" id="gZone"></div><div class="mk" id="gMk"></div></div><button id="gPull">TARIK!</button></div>
  <div id="gFloat"></div>
  <div id="gHelp"><span id="gHelpT">Kebun</span><button id="gHelpW">💧 Siram</button><button id="gHelpF">🌾 Beri makan</button><button id="gHelpBack">🏡</button></div>
  <div class="panel gpanel" id="gLogin"><div class="ph"><h3>🌾 Main Kebunku</h3><button data-close>✕</button></div><div class="how">
    Punya kebun & ternak sendiri di <b>Desa Tani</b>! Masukkan username IG kamu (harus sudah jadi warga) dan buat PIN 4–6 angka. PIN dipakai setiap kali main, jangan sampai lupa.
    <input id="gU" placeholder="username IG kamu" autocomplete="off" autocapitalize="off"><input id="gP" placeholder="PIN 4–6 angka" inputmode="numeric" type="password" maxlength="6">
    <button class="go" id="gGo">Masuk / Klaim Kebun</button>
    <div id="gLook" style="display:none;margin-top:4px"></div><div id="gErr" style="color:#dc2626;font-weight:700;margin-top:8px;font-size:13px"></div>
    <div style="font-size:12px;color:#6b7280;margin-top:10px">${api.online ? '' : '⚠️ Mode uji: progres tersimpan di HP ini saja.'}</div></div></div>
  <div class="panel gpanel" id="gP_seed"><div class="ph"><h3>🌱 Pilih Benih</h3><button data-close>✕</button></div><div class="pb" id="gSeedList"></div></div>
  <div class="panel gpanel" id="gP_pet" style="max-height:78vh"><div class="ph"><h3>🐾 Pilih Peliharaan Kesayangan</h3><button data-close>✕</button></div><div class="pb"><div id="gPetGrid" class="gpetgrid"></div><div id="gPetInfo" style="font-size:13px;color:#4b5563;margin:10px 2px"></div><label style="font-size:12px;font-weight:700;color:#5b6472">NAMA PELIHARAAN</label><input id="gPetName" maxlength="14" style="width:100%;height:44px;border:2px solid #e5e7eb;border-radius:12px;padding:0 12px;font:700 16px Poppins,sans-serif;margin:6px 0 10px;box-sizing:border-box"><button class="gbig" id="gPetOk" style="background:#ea580c">🐾 Adopsi</button></div></div>
  <div class="panel gpanel" id="gP_shop"><div class="ph"><h3>🏪 Toko Pasar Pulau</h3><button data-close>✕</button></div><div class="pb" id="gShopList"></div></div>
  <div class="panel gpanel" id="gP_bag"><div class="ph"><h3>🎒 Tas & Jual</h3><button data-close>✕</button></div><div class="pb" id="gBagList"></div></div>
  <div class="panel gpanel" id="gP_mis"><div class="ph"><h3>🎯 Kegiatan Desa</h3><button data-close>✕</button></div><div class="pb"><div class="gtabs" id="gActTabs" style="flex-wrap:wrap"><button data-k="mis" class="on">🎯 Misi</button><button data-k="order">📋 Pesanan</button><button data-k="gr">🤝 Gotong Royong</button><button data-k="event">🎪 Event</button><button data-k="cal">📅 Kalender</button></div><div id="gMisList"></div></div></div>
  <div class="panel gpanel" id="gP_chat"><div class="ph"><h3>💬 Obrolan Desa <span id="gOnline" style="font-size:12px;color:#16a34a;font-weight:700;margin-left:6px"></span></h3><button data-close>✕</button></div><div class="pb" id="gChatList" style="flex:1;min-height:200px"></div><div id="gChatIn"><input id="gMsg" maxlength="140" placeholder="Tulis pesan… (sopan ya 🙏)" autocomplete="off"><button id="gSend">Kirim</button></div></div>
  <div class="panel gpanel" id="gP_closet" style="max-height:56vh"><div class="ph"><h3>👗 Lemari & Butik</h3><button data-close>✕</button></div><div class="pb"><div class="gtabs" id="gClosetTabs" style="flex-wrap:wrap"><button data-k="look">💇 Rambut</button><button data-k="hat" class="on">🎩 Topi</button><button data-k="top">👕 Baju</button><button data-k="bottom">👖 Celana</button><button data-k="acc">🕶️ Aksesoris</button><button data-k="shop">✨ Butik</button></div><div id="gClosetList"></div></div></div>
  <div class="panel gpanel" id="gP_rank"><div class="ph"><h3>🏆 Papan Peringkat</h3><button data-close>✕</button></div><div class="pb"><div class="gtabs" id="gRankTabs"><button data-k="coins" class="on">🪙 Terkaya</button><button data-k="hearts">❤️ Peternak</button><button data-k="missions_done">🎯 Misi</button><button data-k="harvests">🧺 Panen</button><button data-k="fish">🎣 Ikan</button></div><div id="gRankList"></div></div></div>`;
  document.body.appendChild(ui);
  const panels = ['gLogin', 'gP_seed', 'gP_shop', 'gP_bag', 'gP_mis', 'gP_rank', 'gP_chat', 'gP_closet', 'gP_pet'];
  const openP = id => { panels.forEach(p => $(p).classList.toggle('on', p === id)); document.body.classList.add('gp'); };
  const closeP = () => { panels.forEach(p => $(p).classList.remove('on')); document.body.classList.remove('gp'); };
  ui.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { const wasCloset = $('gP_closet').classList.contains('on'); closeP(); if (wasCloset && ME && FISHING.st === 'off') enterGame(); });
  // entry button
  const playBtn = document.createElement('button'); playBtn.id = 'btnPlay'; playBtn.textContent = '🌾 Main Kebunku';
  const GAME_ON = api.online || /[?&]test=1/.test(location.search);
  
  if (GAME_ON) { const brk = document.createElement('div'); brk.className = 'brk'; $('bottom').insertBefore(brk, $('bottom').firstChild); $('bottom').insertBefore(playBtn, brk); }
  playBtn.onclick = () => { if (ME) enterGame(); else { openP('gLogin'); try { const c = JSON.parse(localStorage.getItem('pn_login') || 'null'); if (c) { $('gU').value = c.u; $('gP').value = c.p; } } catch {} } };

  // ---------------- session ----------------
  let ME = null, saveT = 0, dirty = false;
  const fmt = n => n.toLocaleString('id-ID');
  async function login() {
    const u = W.norm($('gU').value), p = $('gP').value.trim();
    $('gErr').textContent = '';
    const ent = W.ENT.find(e => e.u.toLowerCase() === u);
    if (!ent) { $('gErr').textContent = 'Username belum terdaftar. Komen JADI WARGA di reel @pulau.netizen dulu ya.'; return; }
    if (!/^\d{4,6}$/.test(p)) { $('gErr').textContent = 'PIN harus 4–6 angka.'; return; }
    $('gGo').disabled = true; $('gGo').textContent = 'Memuat…';
    let r; try { r = await api.rpc('farm_login', { p_user: u, p_pin: p }); } catch (e) { r = { ok: false, err: 'Tidak bisa terhubung ke server. Coba lagi.' }; }
    $('gGo').disabled = false; $('gGo').textContent = 'Masuk / Klaim Kebun';
    if (!r.ok) { $('gErr').textContent = r.err || 'Gagal masuk'; return; }
    try { localStorage.setItem('pn_login', JSON.stringify({ u, p })); } catch {}
    const s = r.state && r.state.tiles ? r.state : newState();
    if (!s.look) { const ok = await chooseLook(u, s); if (!ok) return; }
    if (s.inv.umpan === undefined) s.inv.umpan = 10; s.stats.fish = s.stats.fish || 0;
    ME = { u, p, s, ent };
    const msgs = []; tickState(ME.s, Date.now(), msgs);
    if (r.new || !r.state || !r.state.tiles) { ME.s.animals.push({ t: 'ayam', n: NAMES[Math.floor(Math.random() * NAMES.length)], h: 2, fed: null, pet: null, col: null }); msgs.unshift('🎉 Selamat datang di Desa Tani! Kamu dapat 300 koin, benih, pakan, dan seekor ayam.'); }
    await refreshList();
    let v = FARMS.get(u); if (!v) { const idx = Math.max(LIST.length, ...[...FARMS.values()].map(f => f.idx + 1), 0); v = buildFarm(u, idx); }
    ME.v = v; renderFarm(v, ME.s, Date.now());
    migrateWardrobe(ME.s); applyCostume(u, ME.s); pollHelps(); grLoad();
    // kompensasi sekali pakai: bug beli Kandang Sedang dua kali (8 Nov 2026)
    const COMP = { febrian_aang: { id: 'kandang_nov8', c: 900, txt: '🎁 Kompensasi dari Bang Tanjung: +900 koin karena bug Kandang Sedang terbeli dua kali. Maaf ya, bugnya sudah dibenerin! 🙏' } };
    const cp = COMP[u]; ME.s.comp = ME.s.comp || []; if (cp && !ME.s.comp.includes(cp.id)) { ME.s.coins += cp.c; ME.s.comp.push(cp.id); msgs.unshift(cp.txt); }
    markDirty(); closeP(); enterGame(); api.rpc('farm_ping', { p_user: u, p_pin: p }).catch(() => {}); pollChat(); msgs.forEach((m, i) => setTimeout(() => W.toast(m), i * 2600)); if (ME.s.level >= 5 && !ME.s.pet) setTimeout(openPetPicker, 1500 + msgs.length * 2600);
  }
  function chooseLook(u, s) {
    return new Promise(res => {
      const box = $('gLook'); $('gGo').style.display = 'none'; ['gU', 'gP'].forEach(id => $(id).style.display = 'none');
      const st = { g: null, hair: null, hc: HAIR_C[0], hjc: 0xf9a8d4 };
      const HAIRS = { w: [['panjang', '💇‍♀️ Rambut Panjang'], ['kuncir', '🎀 Kuncir Kuda'], ['sanggul', '👩 Sanggul'], ['hijab', '🧕 Berhijab']], p: [['pendek', '👦 Rambut Pendek'], ['jabrik', '🦔 Jabrik'], ['peci', '🧢 Peci']] };
      const draw = () => {
        box.innerHTML = `<b style="font-size:15px">Hai @${esc(u)}! Pilih karaktermu 👇</b>
          <div style="display:flex;gap:10px;margin:10px 0">${[['w', '👩', 'Perempuan', '#fdf2f8', '#db2777'], ['p', '👨', 'Laki-laki', '#eff6ff', '#2563eb']].map(([k, e, t, bg, bc]) => `<button data-g="${k}" style="flex:1;border:3px solid ${st.g === k ? bc : '#e5e7eb'};background:${bg};border-radius:16px;padding:14px 6px;font:800 15px Poppins"><div style="font-size:40px">${e}</div>${t}</button>`).join('')}</div>
          ${st.g ? `<div style="font-size:13px;font-weight:700;margin:4px 0">Gaya rambut</div><div style="display:flex;flex-wrap:wrap;gap:6px">${HAIRS[st.g].map(([k, t]) => `<button data-h="${k}" class="gbtn" style="padding:8px 10px;font-size:12.5px;${st.hair === k ? 'background:#14181f' : ''}">${t}</button>`).join('')}</div>
          ${st.hair === 'hijab' ? `<div style="font-size:13px;font-weight:700;margin:10px 0 4px">Warna hijab</div><div style="display:flex;gap:8px">${[0xf9a8d4, 0x99f6e4, 0xc4b5fd, 0xfde68a, 0x1f2937, 0xffffff].map(c => `<button data-hj="${c}" style="width:34px;height:34px;border-radius:50%;border:3px solid ${st.hjc === c ? '#14181f' : '#e5e7eb'};background:#${c.toString(16).padStart(6, '0')}"></button>`).join('')}</div>`
            : st.hair && st.hair !== 'peci' ? `<div style="font-size:13px;font-weight:700;margin:10px 0 4px">Warna rambut</div><div style="display:flex;gap:8px">${HAIR_C.map(c => `<button data-hc="${c}" style="width:34px;height:34px;border-radius:50%;border:3px solid ${st.hc === c ? '#f59e0b' : '#e5e7eb'};background:#${c.toString(16).padStart(6, '0')}"></button>`).join('')}</div>` : ''}` : ''}
          <button class="go" id="gLookGo" style="margin-top:14px" ${st.g && st.hair ? '' : 'disabled'}>Mulai Main 🌾</button>
          <div style="font-size:11.5px;color:#6b7280;margin-top:6px">Kamu tetap bebas memakai baju apa pun dari Butik. Gaya rambut bisa diganti lagi di 👗 Lemari.</div>`;
        box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { st.g = b.dataset.g; st.hair = HAIRS[st.g][0][0]; draw(); });
        box.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { st.hair = b.dataset.h; draw(); });
        box.querySelectorAll('[data-hc]').forEach(b => b.onclick = () => { st.hc = +b.dataset.hc; draw(); });
        box.querySelectorAll('[data-hj]').forEach(b => b.onclick = () => { st.hjc = +b.dataset.hj; draw(); });
        const go = $('gLookGo'); if (go) go.onclick = () => { s.look = { ...st }; box.style.display = 'none'; $('gGo').style.display = ''; ['gU', 'gP'].forEach(id => $(id).style.display = ''); res(true); };
      };
      box.style.display = 'block'; draw();
    });
  }
  $('gGo').onclick = login; $('gP').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  function enterGame() {
    document.body.classList.add('game'); W.select(null);
    const p = ME.v.root.position; W.flyTo(V(p.x - 0.1, 0.2, p.z + 0.2), 10.5, V(0.04, 1.35, 1));
    const S = ME.ent.sim; S.manual = true; ME.ent.m.root.position.set(p.x + 0.9, p.y, p.z + 1.4); ME.walk = null; updateHUD();
  }
  $('gExit').onclick = () => { if (FISHING.st !== 'off') { stopFishing(); } document.body.classList.remove('game'); closeP(); if (ME) { ME.ent.sim.manual = false; ME.ent.sim.st = 'idle'; } save(true); };
  function markDirty() { dirty = true; clearTimeout(saveT); saveT = setTimeout(save, 2500); }
  async function save(force) {
    if (!ME || (!dirty && !force)) return; dirty = false;
    const s = ME.s, w = s.weekly;
    try { const r = await api.rpc('farm_save', { p_user: ME.u, p_pin: ME.p, p_state: s, p_coins: s.coins, p_level: s.level, p_hearts: heartsTotal(s), p_harvests: s.stats.harvest, p_week: w.week, p_missions: w.list.filter(m => m.done).length });
      if (!r.ok) W.toast('⚠️ Gagal menyimpan: ' + (r.err || '')); } catch (e) { dirty = true; }
  }
  addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  function updateHUD() {
    if (!ME) return; const s = ME.s;
    const wx = weatherOf(dayKey(Date.now())); $('gWx').textContent = wx.e; $('gLv').textContent = `Lv ${s.level}`; $('gCoin').textContent = fmt(s.coins);
    const me = maxEnergy(s); $('gEnBar').firstChild.style.width = `${100 * s.energy / me}%`; $('gEnT').textContent = s.energy;
    $('gSeed').textContent = `${CROPS[s.seed]?.e || '🌱'} ${(s.inv['seed_' + s.seed] || 0)}`;
    const anyDone = [...s.daily.list, ...s.weekly.list].some(m => !m.done);
    $('gMisDot').style.display = anyDone ? 'inline-block' : 'none';
  }
  const floatTxt = (txt, wp) => {
    const v = wp.clone().project(camera); const d = document.createElement('div'); d.textContent = txt;
    d.style.left = ((v.x + 1) / 2 * innerWidth - 30) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight - 20) + 'px'; $('gFloat').appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'translateY(-50px)'; d.style.opacity = '0'; }); setTimeout(() => d.remove(), 1200);
  };
  const tip = t => $('gTip').textContent = t;

  // ---------------- actions ----------------
  function useEnergy(n) { const s = ME.s; if (s.energy < n) { W.toast('😮‍💨 Energimu habis. Istirahat sampai besok, atau minum Es Teh Jumbo dari toko.'); return false; } s.energy -= n; return true; }
  function work(worldPos, dur = 0.7) { // walk my character next to the spot and swing
    const me = ME.ent.m.root.position; const tgt = worldPos.clone().add(V(0, 0, 0.45)); tgt.y = ME.v.root.position.y;
    ME.walk = { from: me.clone(), to: tgt, t0: performance.now(), d: Math.min(900, 250 + me.distanceTo(tgt) * 260), work: dur, look: worldPos.clone() };
  }
  function tapTile(i) {
    const s = ME.s, t = s.tiles[i], now = Date.now(), wp = ME.v.root.localToWorld(tilePos(i).add(V(0, 0.3, 0)));
    tickState(s, now); const msgs = [];
    if (t.s === 'grass') { if (!useEnergy(ENERGY.till)) return; t.s = 'soil'; emit(s, 'till', 1, null, msgs); addXP(s, 1, msgs); floatTxt('🪓 dicangkul', wp); tip('Tanah siap. Ketuk lagi untuk menanam benih.'); }
    else if (t.s === 'dead') { if (!useEnergy(ENERGY.clear)) return; Object.assign(t, { s: 'soil', c: null, g: 0, wt: null }); floatTxt('🧹 dibersihkan', wp); tip('Tanaman layu dibersihkan. Jangan lupa siram tiap hari ya.'); }
    else if (t.s === 'soil') {
      const k = s.seed; if (!(s.inv['seed_' + k] > 0)) { W.toast(`Benih ${CROPS[k].n} habis. Beli di 🏪 Toko atau pilih benih lain.`); openSeeds(); return; }
      if (!useEnergy(ENERGY.plant)) return; s.inv['seed_' + k]--; Object.assign(t, { s: 'crop', c: k, g: 0, wt: null, p: now, u: now }); emit(s, 'plant', 1, null, msgs); addXP(s, 2, msgs);
      floatTxt(`🌱 ${CROPS[k].n}`, wp); tip('Sudah ditanam! Ketuk lagi untuk menyiram 💧');
    } else if (t.s === 'crop') {
      if (isReady(t)) { if (!useEnergy(ENERGY.harvest)) return; const c = CROPS[t.c]; s.inv[t.c] = (s.inv[t.c] || 0) + c.yield; s.stats.harvest += c.yield;
        albumAdd(s, 'crop', t.c, msgs); eventScore(s, 'panen', c.yield, msgs);
        if (t.c === 'semangka') { const kg = +(4 + Math.random() * 6 + (s.level * 0.3)).toFixed(1); eventScore(s, 'semangka', kg, msgs, true); msgs.push(`🍉 Semangkamu ${kg} kg!`); }
        emit(s, 'harvest', c.yield, t.c, msgs); addXP(s, 4 + Math.round(c.hours / 2), msgs); floatTxt(`+${c.yield} ${c.e}`, wp); Object.assign(t, { s: 'soil', c: null, g: 0, wt: null }); tip('Panen! Jual hasilnya di 🎒 Tas.'); }
      else if (!wateredToday(t, now)) { if (!useEnergy(ENERGY.water)) return; t.wt = now; t.u = now; emit(s, 'water', 1, null, msgs); addXP(s, 1, msgs); floatTxt('💧 disiram', wp);
        const left = CROPS[t.c].hours - (t.g || 0); tip(`Tumbuh selama hari ini. Siap panen ±${left < 1 ? Math.ceil(left * 60) + ' menit' : Math.ceil(left) + ' jam'} lagi (kalau disiram tiap hari).`); }
      else { const pct = Math.floor(100 * (t.g || 0) / CROPS[t.c].hours); W.toast(`${CROPS[t.c].e} ${CROPS[t.c].n} sudah disiram hari ini · tumbuh ${pct}%`); return; }
    } else return;
    work(wp); after(msgs);
  }
  function tapAnimal(j) {
    const s = ME.s, a = s.animals[j], now = Date.now(), dk = dayKey(now), A = ANIMALS[a.t]; tickState(s, now); const msgs = [];
    const wp = ME.v.animals[j].g.getWorldPosition(V(0, 0, 0)).add(V(0, 0.4, 0));
    if (a.fed !== dk) { if (!(s.inv.pakan > 0)) { W.toast('🌾 Pakan habis! Beli di 🏪 Toko.'); return; } if (!useEnergy(ENERGY.feed)) return; s.inv.pakan--; a.fed = dk; emit(s, 'feed', 1, null, msgs); addXP(s, 2, msgs); floatTxt('🌾 makan!', wp); tip(`${a.n} kenyang. Ketuk lagi untuk mengambil ${A.prodN.toLowerCase()}.`); }
    else if (a.col !== dk) { if (!useEnergy(ENERGY.collect)) return; a.col = dk; const gold = a.h >= 7 && Math.random() < 0.15 + (a.h - 7) * 0.08; const item = gold ? A.gold : A.prod;
      s.inv[item] = (s.inv[item] || 0) + 1; s.stats.collect++; albumAdd(s, 'animal', a.t, msgs); if (gold) albumAdd(s, 'gold', item, msgs); emit(s, 'collect', 1, null, msgs); addXP(s, 3, msgs); floatTxt(`+1 ${gold ? '🌟 ' + A.goldN : A.pe + ' ' + A.prodN}`, wp); tip(`Elus ${a.n} biar makin sayang ❤️`); }
    else if (a.pet !== dk) { if (!useEnergy(ENERGY.pet)) return; a.pet = dk; a.h = Math.min(10, a.h + 1); emit(s, 'pet', 1, null, msgs); addXP(s, 2, msgs); floatTxt(`❤️ ${a.h}/10`, wp); tip(`${a.n} senang! Hewan dengan ❤️ 7+ kadang memberi ${A.goldN}.`); }
    else { W.toast(`${A.e} ${a.n} sudah dirawat hari ini ❤️ ${a.h}/10. Datang lagi besok!`); return; }
    work(wp, 0.5); after(msgs);
  }
  function after(msgs) { renderFarm(ME.v, ME.s, Date.now()); updateHUD(); markDirty(); msgs.forEach((m, i) => setTimeout(() => W.toast(m), 300 + i * 2600)); if (ME.s._petOffer) { delete ME.s._petOffer; setTimeout(openPetPicker, 1200 + msgs.length * 2600); } }

  // ---------------- panels ----------------
  function openSeeds() {
    const s = ME.s, el = $('gSeedList'); el.innerHTML = '';
    Object.entries(CROPS).forEach(([k, c]) => { const n = s.inv['seed_' + k] || 0; const d = document.createElement('div'); d.className = 'gitem';
      d.innerHTML = `<div class="ic">${c.e}</div><div class="tx"><b>${c.n} ${k === s.seed ? '✅' : ''}</b><span>Punya ${n} benih · panen ${c.hours < 24 ? c.hours + ' jam' : c.hours / 24 + ' hari'}${c.lv > s.level ? ' · buka di Lv ' + c.lv : ''}</span></div><button ${n ? '' : 'disabled'}>Pakai</button>`;
      d.querySelector('button').onclick = () => { s.seed = k; updateHUD(); closeP(); tip(`Benih ${c.n} dipilih. Ketuk tanah yang sudah dicangkul.`); }; el.appendChild(d); });
    const b = document.createElement('div'); b.style.marginTop = '10px'; b.innerHTML = '<button style="width:100%;height:42px;border:0;border-radius:12px;background:#f59e0b;color:#fff;font:800 14px Poppins">🏪 Beli benih di Toko</button>'; b.firstChild.onclick = openShop; el.appendChild(b);
    openP('gP_seed');
  }
  // barang sekali beli yang sudah dimiliki (kandang sedang dianggap punya kalau sudah punya kandang besar)
  const shopOwned = (s, id) => id === 'barn2' && s.barn >= 4 || id === 'barn3' && s.barn >= 6 || id === 'field4' && s.field >= 4 || id === 'fence' && s.house.fence || id === 'garden' && s.house.garden;
  const shopStock = (s, id) => {
    if (id.startsWith('seed_')) return `📦 Punya ${s.inv[id] || 0} benih`;
    if (id === 'pakan') return `📦 Punya ${s.inv.pakan || 0} pakan`;
    if (id === 'umpan') return `📦 Punya ${s.inv.umpan || 0} umpan`;
    if (id === 'esteh') return `⚡ Energi ${s.energy}/${maxEnergy(s)}`;
    if (id.startsWith('animal_')) { const t = id.slice(7); return `📦 Punya ${s.animals.filter(a => a.t === t).length} · kandang ${s.animals.length}/${s.barn}`; }
    return '';
  };
  function openShop() {
    const s = ME.s, el = $('gShopList'), st = el.scrollTop; el.innerHTML = `<div style="font-size:13px;color:#5b6472;margin:4px 0 6px">Koin kamu: <b>🪙 ${fmt(s.coins)}</b></div>`;
    SHOP.forEach(it => {
      let locked = it.lv > s.level, note = it.d; const owned = shopOwned(s, it.id);
      if (it.id.startsWith('animal_') && s.animals.length >= s.barn) note = `Kandang penuh (${s.barn}). Beli kandang lebih besar.`;
      if (it.id === 'pet_pick') note = s.pet ? `${petDef(s.pet)?.e || '🐾'} ${s.petName || petDef(s.pet)?.def} menemanimu · ganti 🪙 ${PET_CHANGE}` : '🎁 Gratis! ' + it.d;
      if (owned) note = it.id === 'barn2' && s.barn >= 6 ? 'Sudah punya Kandang Besar ✅' : 'Sudah punya ✅';
      const stock = shopStock(s, it.id);
      const d = document.createElement('div'); d.className = 'gitem';
      d.innerHTML = `<div class="ic">${it.e}</div><div class="tx"><b>${it.n}</b><span>${locked ? '🔒 Buka di Level ' + it.lv : note}</span>${stock ? `<span style="display:block;color:#16a34a;font-weight:700">${stock}</span>` : ''}</div><button>${it.id === 'pet_pick' ? (s.pet ? 'Ganti' : 'Pilih') : owned ? '✅ Dimiliki' : '🪙 ' + fmt(it.price)}</button>`;
      const btn = d.querySelector('button'); btn.disabled = it.id === 'pet_pick' ? locked : locked || owned || s.coins < it.price || note.startsWith('Kandang penuh');
      btn.onclick = () => buy(it); el.appendChild(d);
    });
    openP('gP_shop'); el.scrollTop = st;
  }
  function buy(it) {
    if (it.id === 'pet_pick') { openPetPicker(); return; }
    const s = ME.s; if (s.coins < it.price) return; const msgs = [];
    if (shopOwned(s, it.id)) { W.toast('✅ Kamu sudah punya ini, tidak perlu beli lagi.'); openShop(); return; }
    if (it.id.startsWith('animal_') && s.animals.length >= s.barn) { W.toast(`Kandang penuh (${s.barn}). Beli kandang lebih besar dulu.`); return; }
    if (it.id.startsWith('seed_')) s.inv[it.id] = (s.inv[it.id] || 0) + 1;
    else if (it.id === 'pakan') s.inv.pakan = (s.inv.pakan || 0) + 5;
    else if (it.id === 'umpan') s.inv.umpan = (s.inv.umpan || 0) + 10;
    else if (it.id === 'esteh') { s.energy = Math.min(maxEnergy(s) + 30, s.energy + 30); }
    else if (it.id.startsWith('animal_')) { const t = it.id.slice(7); s.animals.push({ t, n: NAMES[Math.floor(Math.random() * NAMES.length)], h: 1, fed: null, pet: null, col: null }); msgs.push(`${ANIMALS[t].e} Hewan baru datang ke kandangmu!`); }
    else if (it.id === 'barn2') s.barn = 4; else if (it.id === 'barn3') s.barn = 6;
    else if (it.id === 'field4') s.field = 4;
    else if (it.id === 'roof') s.house.roof = ((s.house.roof || 0) + 1) % ROOFS.length;
    else if (it.id === 'fence') s.house.fence = true; else if (it.id === 'garden') s.house.garden = true;

    s.coins -= it.price;
    if (it.id === 'barn2' || it.id === 'barn3') msgs.push(`${it.e} Kandangmu sekarang muat ${s.barn} hewan!`);
    else { const stk = shopStock(s, it.id); if (stk && !it.id.startsWith('animal_')) msgs.push(`✅ ${it.n} dibeli · ${stk.replace('📦 ', '')}`); }
    after(msgs); openShop();
  }
  function openBag() {
    const s = ME.s, el = $('gBagList'); el.innerHTML = '';
    const goods = Object.entries(s.inv).filter(([k, n]) => ITEMS[k] && n > 0);
    let total = 0; goods.forEach(([k, n]) => total += priceToday(k) * n);
    const top = document.createElement('div'); top.innerHTML = `<div style="display:flex;gap:8px;margin:4px 0 8px"><div class="gchip">🌾 Pakan: ${s.inv.pakan || 0}</div><div class="gchip">🪱 Umpan: ${s.inv.umpan || 0}</div><div class="gchip">🪙 ${fmt(s.coins)}</div></div>`;
    el.appendChild(top);
    if (!goods.length) el.insertAdjacentHTML('beforeend', '<p style="color:#6b7280;font-size:13.5px">Belum ada hasil panen. Tanam, siram, lalu panen!</p>');
    goods.forEach(([k, n]) => { const it = ITEMS[k]; const d = document.createElement('div'); d.className = 'gitem';
      const pt = priceToday(k), tag = pt > it.price ? ` <b style="display:inline;color:#16a34a;font-size:11px">▲ naik</b>` : pt < it.price ? ` <b style="display:inline;color:#dc2626;font-size:11px">▼ turun</b>` : '';
      d.innerHTML = `<div class="ic">${it.e}</div><div class="tx"><b>${it.n} ×${n}</b><span>🪙 ${pt} / buah${tag}</span></div><button>Jual 🪙 ${fmt(pt * n)}</button>`;
      d.querySelector('button').onclick = () => sell(k, n); el.appendChild(d); });
    if (goods.length > 1) { const b = document.createElement('div'); b.style.marginTop = '10px'; b.innerHTML = `<button style="width:100%;height:44px;border:0;border-radius:12px;background:#16a34a;color:#fff;font:800 14px Poppins">Jual semua · 🪙 ${fmt(total)}</button>`; b.firstChild.onclick = () => { goods.forEach(([k, n]) => sell(k, n, true)); after([]); openBag(); }; el.appendChild(b); }
    const seeds = Object.entries(s.inv).filter(([k, n]) => k.startsWith('seed_') && n > 0).map(([k, n]) => `${CROPS[k.slice(5)].e}×${n}`).join('  ');
    el.insertAdjacentHTML('beforeend', `<h4 style="margin:14px 0 4px;font-size:11px;letter-spacing:.8px;color:#5b6472">BENIH</h4><div style="font-size:15px">${seeds || '-'}</div>
      <h4 style="margin:14px 0 4px;font-size:11px;letter-spacing:.8px;color:#5b6472">TERNAK (${s.animals.length}/${s.barn})</h4>${s.animals.map(a => `<div style="font-size:13.5px;padding:3px 0">${ANIMALS[a.t].e} <b>${a.n}</b> · ❤️ ${a.h}/10</div>`).join('') || '-'}`);
    const al = s.album || {}; const cnt = c => ALBUM[c].filter(k => al[c]?.[k]).length;
    el.insertAdjacentHTML('beforeend', `<h4 style="margin:16px 0 4px;font-size:11px;letter-spacing:.8px;color:#5b6472">🐾 PELIHARAAN & GAYA</h4>
      <div style="font-size:13px;margin-top:2px">${s.pet ? `${petDef(s.pet).e} <b>${esc(s.petName || petDef(s.pet).def)}</b> (${petDef(s.pet).n}) · ❤️ ${s.petH || 0}/10` : (s.level >= 5 ? 'Belum punya peliharaan · pilih di 🏪 Toko' : '🔒 Peliharaan kesayangan terbuka di Level 5')}</div>
      <button class="gbig" id="gToCloset" style="background:#db2777">👗 Buka Lemari & Butik Fashion</button>
      <h4 style="margin:16px 0 4px;font-size:11px;letter-spacing:.8px;color:#5b6472">📖 ALBUM KOLEKSI</h4>
      ${[['fish', '🎣 Ikan', k => FISH[k].e + ' ' + FISH[k].n], ['crop', '🌱 Tanaman', k => CROPS[k].e + ' ' + CROPS[k].n], ['animal', '🐔 Ternak', k => ANIMALS[k].e + ' ' + ANIMALS[k].n], ['gold', '🌟 Barang Langka', k => ITEMS[k].e + ' ' + ITEMS[k].n]].map(([c, t, nm]) =>
        `<div style="margin:6px 0"><b style="font-size:13px">${t} ${cnt(c)}/${ALBUM[c].length}</b> <span style="font-size:11.5px;color:#b45309">→ gelar ${TITLES[c].n}</span><div style="font-size:12.5px;color:#374151;margin-top:2px">${ALBUM[c].map(k => al[c]?.[k] ? nm(k) : '❔ ???').join(' · ')}</div></div>`).join('')}
      ${(s.titles || []).length ? `<div style="margin-top:6px;font-size:12.5px">Pakai gelar: ${['', ...s.titles].map(t => `<button class="gbtn" data-ttl="${t}" style="${(s.title || '') === t ? 'background:#14181f' : ''}">${t ? TITLES[t].n : 'Tanpa gelar'}</button>`).join(' ')}</div>` : ''}`);
    $('gToCloset').onclick = openCloset;
    el.querySelectorAll('[data-ttl]').forEach(b => b.onclick = () => { s.title = b.dataset.ttl; after([]); openBag(); });
    openP('gP_bag');
  }
  function sell(k, n, quiet) { const s = ME.s, msgs = []; const v = priceToday(k) * n; s.inv[k] = 0; s.coins += v; s.stats.sold += v; emit(s, 'sell', v, null, msgs); addXP(s, Math.ceil(v / 50), msgs); if (!quiet) { after(msgs); openBag(); } else msgs.forEach(m => W.toast(m)); }
  function openMis() { openP('gP_mis'); grLoad().then(() => { if (actTab === 'gr') renderAct(); }); refreshList(); renderAct(); }
  function misHTML(el) {
    const s = ME.s;
    const row = (m, pool, rew) => { const d = pool.find(x => x.id === m.id); return `<div class="gmis ${m.done ? 'done' : ''}"><b>${m.done ? '✅' : '⬜'} ${d.t}</b> <span style="float:right;font-size:12px;color:#5b6472">${fmt(m.p)}/${fmt(d.n)} · 🪙 ${rew || d.r}</span><div class="bar"><i style="width:${100 * m.p / d.n}%"></i></div></div>`; };
    const end = new Date(Date.parse(s.weekly.week ? new Date().toISOString() : 0));
    el.innerHTML = `<h4 style="margin:6px 0 2px;font-size:11px;letter-spacing:.8px;color:#5b6472">MISI HARIAN · ganti tiap tengah malam</h4>${s.daily.list.map(m => row(m, DAILY_POOL, 50)).join('')}
      <h4 style="margin:16px 0 2px;font-size:11px;letter-spacing:.8px;color:#5b6472">MISI MINGGUAN · ganti tiap Senin</h4>${s.weekly.list.map(m => row(m, WEEKLY_POOL)).join('')}
      <div style="margin-top:12px;background:${s.weekly.bonus ? '#dcfce7' : '#fff7e6'};border-radius:12px;padding:10px 12px;font-size:13px;font-weight:600">${s.weekly.bonus ? '🏅 Kamu WARGA TELADAN minggu ini! Namamu bisa disebut Bang Tanjung di video.' : `🏅 Selesaikan 3 misi mingguan: +${WEEK_BONUS} koin & lencana WARGA TELADAN (namamu bisa muncul di video Bang Tanjung)`}</div>
      <div style="margin-top:8px;font-size:12.5px;color:#5b6472">🔥 Login beruntun: ${s.streak} hari · 🏅 Lencana: ${(s.badges || []).length}</div>`;
  }
  let rankKey = 'coins';
  async function openRank() {
    openP('gP_rank'); await refreshList(); const el = $('gRankList'); const wk = weekKey(Date.now());
    const val = r => rankKey === 'missions_done' ? (r.week_key === wk ? r.missions_done : 0) : rankKey === 'fish' ? (r.state?.stats?.fish || 0) : r[rankKey] || 0;
    const rows = LIST.map(r => ME && r.username === ME.u ? { ...r, coins: ME.s.coins, hearts: heartsTotal(ME.s), harvests: ME.s.stats.harvest, missions_done: ME.s.weekly.list.filter(m => m.done).length, week_key: ME.s.weekly.week, state: ME.s } : r)
      .sort((a, b) => val(b) - val(a)).slice(0, 30);
    const unit = { coins: '🪙', hearts: '❤️', missions_done: '🎯', harvests: '🧺', fish: '🎣' }[rankKey];
    el.innerHTML = rows.map((r, i) => `<div class="gitem" data-u="${r.username}" style="cursor:pointer"><div class="ic" style="font-size:18px;font-weight:800">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="tx"><b>@${r.username}</b><span>Lv ${r.level || 1}${r.state?.title && TITLES[r.state.title] ? ' · ' + TITLES[r.state.title].n : ''} · kunjungi kebun ›</span></div><b>${unit} ${fmt(val(r))}</b></div>`).join('') || '<p style="color:#6b7280">Belum ada pemain. Jadilah yang pertama!</p>';
    el.querySelectorAll('[data-u]').forEach(d => d.onclick = () => { const v = FARMS.get(d.dataset.u); if (v) { closeP(); const p = v.root.position; W.flyTo(V(p.x, 0.3, p.z), 9, V(0.1, 1.1, 1)); } });
  }
  $('gRankTabs').querySelectorAll('button').forEach(b => b.onclick = () => { rankKey = b.dataset.k; $('gRankTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); openRank(); });
  $('gSeed').onclick = openSeeds; $('gShop').onclick = openShop; $('gBag').onclick = openBag; $('gMis').onclick = openMis; $('gActTabs').querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.k === 'gr') grLoad().then(() => renderAct('gr')); renderAct(b.dataset.k); }); $('gRank').onclick = openRank;
  // leaderboard also reachable outside the game
  const rankBtn = document.createElement('button'); rankBtn.textContent = '🏆'; rankBtn.style.cssText = 'background:#fff;color:#14181f;flex:0 0 auto'; rankBtn.onclick = openRank; if (GAME_ON) playBtn.after(rankBtn);


  // ================= FITUR TAMBAHAN =================
  // ---- cuaca & musim (sama untuk semua pemain) ----
  const SEASON = dk => { const m = +dk.slice(5, 7); return m >= 11 || m <= 3 ? 'hujan' : 'kemarau'; };
  const WX_CACHE = {};
  function weatherOf(dk) {
    if (WX_CACHE[dk]) return WX_CACHE[dk];
    const r = seeded('cuaca' + dk), se = SEASON(dk), x = r();
    const rainP = se === 'hujan' ? 0.42 : 0.12;
    let w;
    if (x < rainP) w = { k: 'hujan', e: '🌧️', n: 'Hujan', rain: true, tip: 'Tanaman tersiram otomatis hari ini!' };
    else if (se === 'kemarau' && x > 0.72) w = { k: 'panas', e: '🔥', n: 'Panas Terik', dry: true, tip: 'Tanah cepat kering, jangan lupa siram (layu dalam 2 hari).' };
    else if (x < rainP + 0.25) w = { k: 'berawan', e: '⛅', n: 'Berawan', tip: 'Cuaca enak untuk berkebun.' };
    else w = { k: 'cerah', e: '☀️', n: 'Cerah', tip: 'Jangan lupa siram tanamanmu.' };
    w.season = se === 'hujan' ? 'Musim Hujan' : 'Musim Kemarau';
    return WX_CACHE[dk] = w;
  }
  // ---- harga pasar harian ----
  const PRICE_CACHE = {};
  function pricesToday(dk) {
    if (PRICE_CACHE[dk]) return PRICE_CACHE[dk];
    const r = seeded('harga' + dk), keys = Object.keys(ITEMS).filter(k => !k.startsWith('ikan_sepatu')), out = {};
    const up = pickN(keys, 2, r), down = pickN(keys.filter(k => !up.includes(k)), 1, r);
    up.forEach(k => out[k] = 1.5 + Math.round(r() * 5) / 10); down.forEach(k => out[k] = 0.7);
    return PRICE_CACHE[dk] = out;
  }
  const priceToday = k => Math.round((ITEMS[k]?.price || 0) * (pricesToday(dayKey(Date.now()))[k] || 1) * (panenRaya() ? 2 : 1));
  // ---- kalender login 7 hari ----
  const CAL = [
    { txt: '+80 koin', f: s => s.coins += 80 }, { txt: '+5 pakan 🌾', f: s => s.inv.pakan = (s.inv.pakan || 0) + 5 },
    { txt: '+3 benih jagung 🌽', f: s => s.inv.seed_jagung = (s.inv.seed_jagung || 0) + 3 }, { txt: '+150 koin', f: s => s.coins += 150 },
    { txt: '+10 umpan 🪱', f: s => s.inv.umpan = (s.inv.umpan || 0) + 10 }, { txt: '+300 koin', f: s => s.coins += 300 },
    { txt: '🐄 Sapi gratis! (atau +1.500 koin kalau kandang penuh)', f: s => { if (s.animals.length < s.barn) s.animals.push({ t: 'sapi', n: NAMES[Math.floor(Math.random() * NAMES.length)], h: 2, fed: null, pet: null, col: null }); else s.coins += 1500; } },
  ];
  function calReward(s) { const day = ((s.streak - 1) % 7) + 1; CAL[day - 1].f(s); s.calDay = day; return { day, txt: CAL[day - 1].txt }; }
  // ---- album & gelar ----
  const ALBUM = { fish: Object.keys(FISH).filter(k => !FISH[k].junk && !FISH[k].coins), crop: Object.keys(CROPS), animal: Object.keys(ANIMALS), gold: ['telur_emas', 'susu_premium'] };
  const TITLES = { fish: { n: '🎣 Raja Pancing', a: 'fish' }, crop: { n: '🌾 Petani Sejati', a: 'crop' }, animal: { n: '🐄 Juragan Ternak', a: 'animal' }, gold: { n: '👑 Sultan Desa', a: 'gold' } };
  function albumAdd(s, cat, k, msgs) {
    s.album = s.album || { fish: {}, crop: {}, animal: {}, gold: {} }; s.album[cat] = s.album[cat] || {};
    if (s.album[cat][k]) return; s.album[cat][k] = 1;
    const name = (cat === 'fish' ? FISH[k]?.n : cat === 'crop' ? CROPS[k]?.n : cat === 'animal' ? ANIMALS[k]?.n : ITEMS[k]?.n) || k;
    if (msgs) msgs.push(`📖 Koleksi baru: ${name}`);
    if (ALBUM[cat].every(x => s.album[cat][x])) { s.titles = [...new Set([...(s.titles || []), cat])]; if (!s.title) s.title = cat; s.coins += 500; if (msgs) msgs.push(`🏆 Album lengkap! Gelar ${TITLES[cat].n} + 500 koin`); }
  }
  // ---- event mingguan ----
  const EVENTS = { semangka: { n: '🍉 Lomba Semangka Terberat', d: 'Panen semangka seberat mungkin (Lv 4). Skor = semangka terberat (kg).', u: 'kg' },
    mancing: { n: '🎣 Turnamen Mancing', d: 'Pancing ikan sebanyak-banyaknya minggu ini. Malam hari lebih banyak ikan langka!', u: 'ikan' },
    panen: { n: '🌾 Festival Panen Raya', d: 'Kumpulkan hasil panen sebanyak-banyaknya minggu ini.', u: 'panen' } };
  const eventOf = wk => { const n = +wk.slice(6); return ['mancing', 'panen', 'semangka'][n % 3]; };
  function eventScore(s, type, val, msgs, isMax) {
    const wk = weekKey(Date.now()), ev = eventOf(wk); if (ev !== type) return;
    if (!s.event || s.event.week !== wk) s.event = { week: wk, type: ev, score: 0 };
    s.event.score = isMax ? Math.max(s.event.score, val) : +(s.event.score + val).toFixed(1);
  }
  // ---- gotong royong (target bersama) ----
  const GR_BUILD = ['Lumbung Desa', 'Gazebo Pantai', 'Menara Pandang', 'Taman Bermain', 'Pos Ronda', 'Air Mancur Alun-alun', 'Perpustakaan Desa', 'Panggung Hiburan'];
  function grGoal(wk) {
    const r = seeded('gr' + wk), pool = ['telur', 'tomat', 'lobak', 'jagung', 'cabai', 'ikan_nila', 'ikan_teri', 'susu'];
    const items = pickN(pool, 3, r); const base = { telur: 120, tomat: 200, lobak: 120, jagung: 90, cabai: 150, ikan_nila: 60, ikan_teri: 100, susu: 40 };
    return { items: items.map(k => ({ k, n: base[k] })), build: GR_BUILD[Math.floor(r() * GR_BUILD.length)] };
  }
  let GR = { week: null, totals: {}, people: {} };
  async function grLoad() { const wk = weekKey(Date.now()); try { const r = await api.rpc('community_get', { p_week: wk }); GR = { week: wk, totals: r.totals || {}, people: r.people || {} }; } catch (e) {} }
  async function grGive(k, n) {
    const s = ME.s; if (!(s.inv[k] >= n) || n < 1) return; const wk = weekKey(Date.now()), msgs = [];
    let r; try { r = await api.rpc('community_add', { p_user: ME.u, p_pin: ME.p, p_week: wk, p_item: k, p_qty: n }); } catch (e) { W.toast('Tidak bisa terhubung, coba lagi.'); return; }
    if (!r.ok) { W.toast(r.err || 'Gagal'); return; }
    s.inv[k] -= n; const rew = Math.ceil(priceToday(k) * n * 0.6); s.coins += rew; addXP(s, n * 2, msgs); s.grGiven = { week: wk, n: ((s.grGiven?.week === wk ? s.grGiven.n : 0) + n) };
    GR = { week: wk, totals: r.totals, people: r.people }; msgs.unshift(`🤝 Terima kasih! Kamu menyumbang ${n} ${ITEMS[k].n} (+${rew} koin)`); after(msgs); renderAct('gr');
  }
  const grDone = goal => goal.items.every(it => (GR.totals[it.k] || 0) >= it.n);
  // ---- papan pesanan warga ----
  const ORDER_FROM = ['zyx_naww', 'flyjouze', 'kasmir_994', 'ainiyz0', 'hoinos.edit1', 'ghitssna', 'nindriluvita7', 'ruryfauziah', 'Bang Tanjung'];
  const ORDER_WHY = { zyx_naww: 'untuk seblak', flyjouze: 'untuk mie ayam', kasmir_994: 'untuk lapak ikan', ainiyz0: 'untuk lapak sayur', 'hoinos.edit1': 'untuk ramuan parfum 😆', ghitssna: 'untuk hiasan bunga', nindriluvita7: 'untuk es teh jumbo', ruryfauziah: 'untuk RM Padang', 'Bang Tanjung': 'untuk acara desa' };
  function ordersToday(lv) {
    const dk = dayKey(Date.now()), r = seeded('order' + dk);
    const pool = [...Object.keys(CROPS).filter(k => CROPS[k].lv <= Math.max(2, lv)), 'telur', 'ikan_teri', 'ikan_nila', ...(lv >= 2 ? ['ikan_kakap', 'telur_bebek'] : []), ...(lv >= 5 ? ['susu'] : [])];
    return Array.from({ length: 4 }, (_, i) => { const k = pool[Math.floor(r() * pool.length)], q = 2 + Math.floor(r() * 5), who = ORDER_FROM[Math.floor(r() * ORDER_FROM.length)];
      return { id: `${dk}-${i}`, k, q, who, rew: Math.round((ITEMS[k]?.price || 20) * q * (1.6 + r() * 0.6)), xp: 6 + q * 2 }; });
  }
  function fillOrder(o) {
    const s = ME.s, msgs = []; s.orders = s.orders?.day === dayKey(Date.now()) ? s.orders : { day: dayKey(Date.now()), done: [] };
    if (s.orders.done.includes(o.id) || !(s.inv[o.k] >= o.q)) return;
    s.inv[o.k] -= o.q; s.orders.done.push(o.id); s.coins += o.rew; addXP(s, o.xp, msgs); emit(s, 'sell', o.rew, null, msgs);
    msgs.unshift(`📋 Pesanan ${o.who === 'Bang Tanjung' ? 'Bang Tanjung' : '@' + o.who} selesai! +${o.rew} koin`); after(msgs); renderAct('order');
  }
  // ---- bantu tetangga ----
  async function helpFarm(target, kind) {
    const s = ME.s, dk = dayKey(Date.now()), msgs = []; if (!useEnergy(3)) return;
    let r; try { r = await api.rpc('farm_help', { p_user: ME.u, p_pin: ME.p, p_target: target, p_kind: kind, p_day: dk }); } catch (e) { s.energy += 3; W.toast('Tidak bisa terhubung.'); return; }
    if (!r.ok) { s.energy += 3; W.toast(r.err || 'Gagal'); updateHUD(); return; }
    s.coins += 40; addXP(s, 6, msgs); s.helped = (s.helped || 0) + 1; emit(s, 'help', 1, null, msgs);
    msgs.unshift(kind === 'water' ? `💧 Kamu menyiram kebun @${target}! +40 koin` : `🌾 Kamu memberi makan ternak @${target}! +40 koin`); after(msgs);
    const v = FARMS.get(target); if (v) floatTxt(kind === 'water' ? '💧💧💧' : '🌾❤️', v.root.position.clone().add(V(0, 1.2, 0)));
  }
  async function pollHelps() {
    if (!ME) return; const s = ME.s; let list; try { list = await api.rpc('help_list', { p_user: ME.u, p_pin: ME.p, p_since: s.helpLast || 0 }); } catch (e) { return; }
    if (!Array.isArray(list) || !list.length) return; const dk = dayKey(Date.now()), now = Date.now(), msgs = [];
    for (const h of list) {
      s.helpLast = Math.max(s.helpLast || 0, h.id);
      if (h.day !== dk) continue;
      if (h.kind === 'water') s.tiles.forEach(t => { if (t.s === 'crop' && !wateredToday(t, now)) { tickState(s, now); t.wt = now; t.u = now; } });
      if (h.kind === 'feed') s.animals.forEach(a => { if (a.fed !== dk) a.fed = dk; });
      msgs.push(h.kind === 'water' ? `💧 @${h.helper} menyiram kebunmu!` : `🌾 @${h.helper} memberi makan ternakmu!`);
    }
    after(msgs);
  }
  setInterval(pollHelps, 60000);
  // nearest neighbour farm to the camera target (for the "Bantu" button)
  let nearFarm = null;
  function updateNear() {
    if (!ME || !document.body.classList.contains('game') || document.body.classList.contains('fishing')) { $('gHelp').style.display = 'none'; return; }
    const f = W.controls.target; let best = null, bd = 3.2;
    for (const v of FARMS.values()) { const d = Math.hypot(v.root.position.x - f.x, v.root.position.z - f.z); if (d < bd) { bd = d; best = v; } }
    if (best && best.u === ME.u) best = null;
    nearFarm = best; $('gHelp').style.display = best ? 'flex' : 'none'; if (best) $('gHelpT').textContent = `Kebun @${best.u}`;
  }
  // ---- peliharaan ----
  function petMesh(t, name) {
    const P = petDef(t) || PETS.kucing_oren, g = new THREE.Group(), b = new THREE.Group(); g.add(b);
    const S = P.k === 'dog' ? 1 : P.k === 'rabbit' ? 0.75 : 0.8, mb = M(P.base), mm = M(P.mark), my = M(P.belly), pt = P.point ? mm : mb;
    const bx = (w, h, d, m, x, y, z) => { const o = mesh(new THREE.BoxGeometry(w * S, h * S, d * S), m, x * S, y * S, z * S, false); b.add(o); return o; };
    if (P.k === 'rabbit') {
      bx(0.2, 0.18, 0.26, mb, 0, 0.13, 0); bx(0.15, 0.15, 0.15, mb, 0, 0.27, 0.13);
      for (const sx of [-1, 1]) { const e = bx(0.04, 0.2, 0.025, mb, sx * 0.04, 0.44, 0.12); e.rotation.z = sx * 0.12; bx(0.02, 0.14, 0.01, mm, sx * 0.04, 0.44, 0.135).rotation.z = sx * 0.12; }
      const tl = mesh(new THREE.SphereGeometry(0.05 * S, 6, 5), my, 0, 0.16 * S, -0.15 * S, false); b.add(tl);
      bx(0.03, 0.02, 0.02, mm, 0, 0.27, 0.21);
    } else {
      bx(0.17, 0.15, 0.34, mb, 0, 0.17, 0); bx(0.13, 0.04, 0.26, my, 0, 0.1, 0.01);
      if (P.k === 'cat' && P.mark !== P.base && !P.point) for (const z of [-0.1, 0, 0.1]) bx(0.175, 0.03, 0.035, mm, 0, 0.23, z);
      if (P.mark2) { bx(0.176, 0.08, 0.12, mm, 0, 0.2, -0.07); bx(0.176, 0.07, 0.09, M(P.mark2), 0, 0.21, 0.08); }
      bx(0.17, 0.16, 0.16, pt, 0, 0.3, 0.2); bx(0.09, 0.06, 0.04, P.point ? mm : my, 0, 0.26, 0.285);
      if (P.mark2) bx(0.09, 0.09, 0.02, M(P.mark2), 0.045, 0.34, 0.281);
      for (const sx of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.04 * S, 0.09 * S, 4), P.k === 'dog' ? mm : pt, sx * 0.055 * S, 0.41 * S, 0.18 * S, false); if (P.k === 'dog') { e.rotation.z = sx * 1.25; e.position.y -= 0.04 * S; } b.add(e); }
      if (P.k === 'cat') for (const sx of [-1, 1]) for (const dy of [-0.008, 0.012]) { const w = mesh(new THREE.BoxGeometry(0.07, 0.004, 0.004), M(0xf8fafc), sx * 0.075 * S, 0.265 * S + dy, 0.29 * S, false); w.rotation.z = sx * dy * 8; b.add(w); }
      bx(0.025, 0.018, 0.015, M(P.k === 'dog' ? 0x111111 : 0xf472b6), 0, 0.285, 0.305);
      const tail = mesh(new THREE.CylinderGeometry(0.017 * S, 0.012 * S, 0.22 * S, 5), P.point || P.mark2 ? mm : mb, 0, 0.27 * S, -0.22 * S, false); tail.rotation.x = P.k === 'dog' ? -1.0 : -0.5; tail.userData.tail = true; b.add(tail);
    }
    for (const sx of [-1, 1]) { const ey = mesh(new THREE.SphereGeometry(0.019 * S, 6, 5), M(P.eye), sx * 0.04 * S, (P.k === 'rabbit' ? 0.3 : 0.33) * S, (P.k === 'rabbit' ? 0.205 : 0.282) * S, false); b.add(ey); b.add(mesh(new THREE.SphereGeometry(0.008 * S, 4, 3), M(0x050505), sx * 0.04 * S, (P.k === 'rabbit' ? 0.3 : 0.33) * S, (P.k === 'rabbit' ? 0.222 : 0.298) * S, false)); }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(0.045, 0.1, 0.045, P.point ? mm : (z > 0 ? my : mb), x * 0.055, 0.05, z * 0.11);
    if (name) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = '700 30px Poppins,sans-serif'; const w = Math.min(244, x.measureText(name).width + 50);
      x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.roundRect((256 - w) / 2, 8, w, 48, 24); x.fill(); x.fillStyle = '#ea580c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🐾 ' + name, 128, 33);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); sp.scale.set(0.6, 0.15, 1); sp.position.y = 0.62 * S; sp.renderOrder = 5; g.add(sp); }
    b.traverse(o => { if (o.isMesh) o.userData.farmPet = true; });
    g.scale.setScalar(1.45); return g;
  }
  const PET_CHANGE = 300;
  let petSel = null;
  function openPetPicker() {
    const s = ME.s; if (s.level < 5) { W.toast('🔒 Peliharaan kesayangan terbuka di Level 5.'); return; }
    petSel = s.pet ? (PET_ALIAS[s.pet] || s.pet) : 'kucing_oren';
    const grid = $('gPetGrid'); grid.innerHTML = '';
    Object.entries(PETS).forEach(([k, P]) => { const d = document.createElement('div'); d.className = 'gpet' + (k === petSel ? ' on' : ''); d.dataset.k = k;
      d.innerHTML = `${P.rec ? '<span class="rec">⭐ REKOMENDASI</span>' : ''}<div class="sw" style="background:${P.sw}">${P.k === 'cat' ? '' : P.e}</div>${P.n.replace('Kucing ', '')}`;
      d.onclick = () => { const old = $('gPetName').value.trim(); if (!old || old === petDef(petSel).def) $('gPetName').value = P.def; petSel = k; grid.querySelectorAll('.gpet').forEach(x => x.classList.toggle('on', x.dataset.k === k)); info(); };
      grid.appendChild(d); });
    $('gPetName').value = s.pet ? (s.petName || petDef(s.pet).def) : PETS.kucing_oren.def;
    const info = () => { const P = PETS[petSel], same = s.pet && (PET_ALIAS[s.pet] || s.pet) === petSel; $('gPetInfo').innerHTML = `${P.e} <b>${P.n}</b>${P.rec ? ' · <b style="color:#ea580c">rekomendasi Bang Tanjung</b>' : ''}<br>${P.d}`;
      $('gPetOk').textContent = !s.pet ? '🐾 Adopsi (gratis)' : same ? '✏️ Simpan nama' : `🐾 Ganti peliharaan · 🪙 ${PET_CHANGE}`; };
    info();
    $('gPetOk').onclick = () => {
      const nm = ($('gPetName').value.trim() || PETS[petSel].def).replace(/[<>]/g, '').slice(0, 14), same = s.pet && (PET_ALIAS[s.pet] || s.pet) === petSel, msgs = [];
      if (s.pet && !same) { if (s.coins < PET_CHANGE) { W.toast(`Koin kurang. Ganti peliharaan butuh 🪙 ${PET_CHANGE}.`); return; } s.coins -= PET_CHANGE; s.petH = 0; }
      const first = !s.pet; s.pet = petSel; s.petName = nm;
      msgs.push(first ? `${PETS[petSel].e} ${nm} sekarang jadi peliharaan kesayanganmu! Ketuk ${nm} tiap hari untuk mengelus.` : same ? `✏️ Nama peliharaan jadi ${nm}.` : `${PETS[petSel].e} Selamat datang, ${nm}!`);
      closeP(); after(msgs);
    };
    openP('gP_pet');
  }
  function tapPet() {
    const s = ME.s, dk = dayKey(Date.now()), P = petDef(s.pet), nm = s.petName || P.def, wp = ME.v.pet.g.getWorldPosition(V(0, 0, 0)).add(V(0, 0.5, 0)), msgs = [];
    if (s.petDay === dk) { floatTxt('💕', wp); W.toast(`${P.e} ${nm} sudah dielus hari ini ❤️ ${s.petH || 0}/10. Datang lagi besok!`); return; }
    if (!useEnergy(ENERGY.pet)) return;
    s.petDay = dk; s.petH = Math.min(10, (s.petH || 0) + 1); emit(s, 'pet', 1, null, msgs); addXP(s, 3, msgs);
    const snd = P.k === 'cat' ? 'Meong~ 😺' : P.k === 'dog' ? 'Guk guk! 🐶' : '🥕 *loncat*';
    floatTxt(`❤️ ${s.petH}/10`, wp);
    if (s.petH >= 5 && Math.random() < 0.35 + s.petH * 0.04) { const c = 20 + Math.floor(Math.random() * 40) + s.petH * 5; s.coins += c; msgs.push(`${P.e} ${nm} membawakan hadiah: 🪙 ${c} koin!`); }
    tip(`${nm}: ${snd} Peliharaan ❤️ 5+ kadang membawa hadiah.`);
    ME.v.pet.jump = 1; work(wp, 0.4); after(msgs);
  }
  // ================= FASHION: lemari, butik, item langka event =================
  const RAR = { biasa: { n: 'Biasa', c: '#6b7280' }, langka: { n: 'Langka', c: '#2563eb' }, epik: { n: 'Epik', c: '#9333ea' }, legend: { n: 'Legendaris', c: '#d97706' } };
  const SLOTS = { hat: '🎩 Topi', top: '👕 Baju', bottom: '👖 Celana', acc: '🕶️ Aksesoris' };
  const OUTFITS = {
    // topi
    hat_caping: { slot: 'hat', n: 'Caping Petani', e: '👒', price: 200, rar: 'biasa', k: 'caping' },
    hat_kupluk: { slot: 'hat', n: 'Kupluk Rajut', e: '🧶', price: 250, rar: 'biasa', k: 'kupluk', c: 0xdc2626 },
    hat_pantai: { slot: 'hat', n: 'Topi Pantai', e: '👒', price: 300, rar: 'biasa', k: 'pantai', c: 0xfde68a },
    hat_koboi: { g: 'p', slot: 'hat', n: 'Topi Koboi', e: '🤠', price: 450, rar: 'langka', k: 'koboi' },
    hat_bunga: { g: 'w', slot: 'hat', n: 'Mahkota Bunga', e: '🌸', price: 400, rar: 'langka', k: 'bunga' },
    hat_chef: { slot: 'hat', n: 'Topi Koki', e: '👨‍🍳', price: 600, rar: 'langka', k: 'chef' },
    hat_mahkota: { slot: 'hat', n: 'Mahkota Emas', e: '👑', price: 6000, rar: 'legend', k: 'mahkota', lv: 6 },
    // baju
    top_merah: { slot: 'top', n: 'Kaos Merah', e: '👕', price: 120, rar: 'biasa', pat: 'polos', c: [0xdc2626] },
    top_kuning: { slot: 'top', n: 'Kaos Kuning', e: '👕', price: 120, rar: 'biasa', pat: 'polos', c: [0xfacc15] },
    top_hitam: { slot: 'top', n: 'Kaos Hitam', e: '👕', price: 150, rar: 'biasa', pat: 'polos', c: [0x111827] },
    top_pink: { slot: 'top', n: 'Kaos Pink', e: '👕', price: 150, rar: 'biasa', pat: 'polos', c: [0xf472b6] },
    top_belang: { slot: 'top', n: 'Kaos Belang ala Bang Tanjung', e: '🧡', price: 350, rar: 'langka', pat: 'belang', c: [0xf97316, 0xffffff] },
    top_polka: { slot: 'top', n: 'Baju Polkadot', e: '🔴', price: 380, rar: 'langka', pat: 'polka', c: [0x1d4ed8, 0xffffff] },
    top_hawaii: { slot: 'top', n: 'Kemeja Hawaii', e: '🌺', price: 500, rar: 'langka', pat: 'bunga', c: [0x0ea5e9, 0xf472b6, 0xfacc15] },
    top_batik: { g: 'p', slot: 'top', n: 'Kemeja Batik', e: '🟫', price: 800, rar: 'epik', pat: 'batik', c: [0x7c2d12, 0xfbbf24], lv: 3 },
    top_pelangi: { slot: 'top', n: 'Baju Pelangi', e: '🌈', price: 1500, rar: 'epik', pat: 'pelangi', lv: 4 },
    // celana
    bot_jeans: { slot: 'bottom', n: 'Celana Jeans', e: '👖', price: 150, rar: 'biasa', pat: 'polos', c: [0x1e3a8a] },
    bot_hitam: { slot: 'bottom', n: 'Celana Hitam', e: '👖', price: 150, rar: 'biasa', pat: 'polos', c: [0x111827] },
    bot_coklat: { slot: 'bottom', n: 'Celana Coklat', e: '👖', price: 150, rar: 'biasa', pat: 'polos', c: [0x78350f] },
    bot_sarung: { g: 'p', slot: 'bottom', n: 'Sarung Kotak-kotak', e: '🟩', price: 400, rar: 'langka', pat: 'kotak', c: [0x166534, 0x14532d] },
    bot_pelangi: { slot: 'bottom', n: 'Celana Pelangi', e: '🌈', price: 1200, rar: 'epik', pat: 'pelangi', lv: 4 },
    // aksesoris
    acc_kacamata: { slot: 'acc', n: 'Kacamata Hitam', e: '🕶️', price: 300, rar: 'biasa', k: 'kacamata' },
    acc_syal: { slot: 'acc', n: 'Syal Merah', e: '🧣', price: 350, rar: 'biasa', k: 'syal', c: 0xdc2626 },
    acc_ransel: { slot: 'acc', n: 'Tas Ransel', e: '🎒', price: 450, rar: 'langka', k: 'ransel', c: 0x2563eb },
    acc_kalung: { slot: 'acc', n: 'Kalung Emas', e: '📿', price: 1200, rar: 'epik', k: 'kalung' },
    acc_sayap: { slot: 'acc', n: 'Sayap Malaikat', e: '🪽', price: 9000, rar: 'legend', k: 'sayap', lv: 7 },
    // ===== koleksi wanita =====
    hat_hijab_pink: { g: 'w', slot: 'hat', n: 'Hijab Pastel Pink', e: '🧕', price: 250, rar: 'biasa', k: 'hijab', c: 0xf9a8d4 },
    hat_hijab_mint: { g: 'w', slot: 'hat', n: 'Hijab Pastel Mint', e: '🧕', price: 250, rar: 'biasa', k: 'hijab', c: 0x99f6e4 },
    hat_hijab_lilac: { g: 'w', slot: 'hat', n: 'Hijab Lilac', e: '🧕', price: 250, rar: 'biasa', k: 'hijab', c: 0xc4b5fd },
    hat_hijab_bunga: { g: 'w', slot: 'hat', n: 'Hijab Motif Bunga', e: '🌸', price: 700, rar: 'langka', k: 'hijab', pat: 'bunga', c: [0xfdf2f8, 0xf472b6, 0xa78bfa] },
    hat_hijab_mutiara: { g: 'w', slot: 'hat', n: 'Hijab Pesta Mutiara', e: '💎', price: 2200, rar: 'epik', k: 'hijab_mutiara', c: 0xfef3c7, lv: 4 },
    hat_pita: { g: 'w', slot: 'hat', n: 'Pita Rambut Besar', e: '🎀', price: 300, rar: 'biasa', k: 'pita', c: 0xec4899 },
    hat_bando: { g: 'w', slot: 'hat', n: 'Bando Mutiara', e: '🤍', price: 500, rar: 'langka', k: 'bando' },
    hat_jepit: { g: 'w', slot: 'hat', n: 'Jepit Bunga Sepatu', e: '🌺', price: 350, rar: 'biasa', k: 'jepit' },
    hat_lebar: { g: 'w', slot: 'hat', n: 'Topi Lebar Berpita', e: '👒', price: 650, rar: 'langka', k: 'lebar', c: 0xfef3c7 },
    hat_tiara: { g: 'w', slot: 'hat', n: 'Tiara Kristal', e: '👸', price: 6500, rar: 'legend', k: 'tiara', lv: 6 },
    top_renda: { g: 'w', slot: 'top', n: 'Blus Renda Putih', e: '🤍', price: 400, rar: 'langka', pat: 'renda', c: [0xffffff, 0xfce7f3] },
    top_crop: { g: 'w', slot: 'top', n: 'Atasan Lilac', e: '💜', price: 200, rar: 'biasa', pat: 'polos', c: [0xc4b5fd] },
    top_floral: { g: 'w', slot: 'top', n: 'Blus Floral', e: '🌷', price: 450, rar: 'langka', pat: 'bunga', c: [0xfef3c7, 0xf472b6, 0x34d399] },
    top_kebaya: { g: 'w', slot: 'top', n: 'Kebaya Modern', e: '🥻', price: 1400, rar: 'epik', pat: 'kebaya', c: [0xbe185d, 0xfacc15], lv: 3 },
    top_glitter: { g: 'w', slot: 'top', n: 'Gaun Pesta Berkilau', e: '✨', price: 2400, rar: 'epik', pat: 'glitter', c: [0x7c3aed, 0xfde68a], lv: 4, glow: true },
    top_putri: { g: 'w', slot: 'top', n: 'Korset Gaun Putri', e: '👗', price: 5500, rar: 'legend', pat: 'putri', c: [0x93c5fd, 0xffffff], lv: 6, glow: true },
    bot_rok_pink: { g: 'w', slot: 'bottom', n: 'Rok Mekar Pink', e: '🩷', price: 300, rar: 'biasa', skirt: 'mekar', pat: 'polos', c: [0xf9a8d4] },
    bot_rok_plisket: { g: 'w', slot: 'bottom', n: 'Rok Plisket Krem', e: '🤎', price: 450, rar: 'langka', skirt: 'plisket', pat: 'plisket', c: [0xe7d3b0, 0xd6bf8f] },
    bot_rok_batik: { g: 'w', slot: 'bottom', n: 'Rok Batik Panjang', e: '🟫', price: 800, rar: 'langka', skirt: 'panjang', pat: 'batik', c: [0x78350f, 0xfbbf24] },
    bot_tutu: { g: 'w', slot: 'bottom', n: 'Rok Tutu Balerina', e: '🩰', price: 900, rar: 'epik', skirt: 'tutu', pat: 'polos', c: [0xfbcfe8] },
    bot_gamis: { g: 'w', slot: 'bottom', n: 'Gamis Satin', e: '🥻', price: 1200, rar: 'epik', skirt: 'panjang', pat: 'polos', c: [0x0f766e], shine: true, lv: 3 },
    bot_gaun: { g: 'w', slot: 'bottom', n: 'Rok Gaun Putri', e: '👗', price: 5500, rar: 'legend', skirt: 'gaun', pat: 'putri', c: [0x93c5fd, 0xffffff], lv: 6, glow: true },
    acc_tas: { g: 'w', slot: 'acc', n: 'Tas Jinjing', e: '👜', price: 500, rar: 'langka', k: 'tas', c: 0xdb2777 },
    acc_anting: { g: 'w', slot: 'acc', n: 'Anting Mutiara', e: '💎', price: 600, rar: 'langka', k: 'anting' },
    acc_payung: { g: 'w', slot: 'acc', n: 'Payung Renda', e: '⛱️', price: 1100, rar: 'epik', k: 'payung', c: 0xfbcfe8 },
    acc_kipas: { g: 'w', slot: 'acc', n: 'Kipas Bunga', e: '🪭', price: 700, rar: 'langka', k: 'kipas', c: 0xf472b6 },
    acc_kupu: { g: 'w', slot: 'acc', n: 'Sayap Kupu-kupu Pelangi', e: '🦋', price: 9000, rar: 'legend', k: 'kupu', lv: 7 },
  };
  // item langka khusus event minggu ini (berubah tiap minggu; id memakai nomor minggu → koleksi unik)
  const EV_SETS = {
    mancing: [{ slot: 'hat', n: 'Topi Nelayan', e: '🎣', k: 'nelayan' }, { slot: 'top', n: 'Rompi Pemancing', e: '🦺', pat: 'rompi' }, { slot: 'acc', n: 'Kalung Mutiara', e: '🦪', k: 'mutiara' },
      { g: 'w', slot: 'hat', n: 'Hijab Ombak Samudra', e: '🌊', k: 'hijab', pat: 'ombak' }, { g: 'w', slot: 'bottom', n: 'Gaun Putri Duyung', e: '🧜‍♀️', skirt: 'duyung', pat: 'sisik', glow: true }],
    panen: [{ slot: 'hat', n: 'Caping Emas', e: '👒', k: 'caping_emas' }, { slot: 'top', n: 'Batik Panen Raya', e: '🌾', pat: 'batik' }, { slot: 'acc', n: 'Selendang Padi', e: '🧣', k: 'syal' },
      { g: 'w', slot: 'top', n: 'Kebaya Panen Raya', e: '🥻', pat: 'kebaya', glow: true }, { g: 'w', slot: 'hat', n: 'Mahkota Padi Emas', e: '🌾', k: 'tiara' }],
    semangka: [{ slot: 'hat', n: 'Topi Semangka', e: '🍉', k: 'semangka' }, { slot: 'top', n: 'Kaos Semangka', e: '🍉', pat: 'semangka' }, { slot: 'acc', n: 'Kacamata Semangka', e: '🕶️', k: 'kacamata', c: 0xdc2626 },
      { g: 'w', slot: 'bottom', n: 'Dress Semangka Mekar', e: '🍉', skirt: 'mekar', pat: 'semangka' }, { g: 'w', slot: 'hat', n: 'Pita Semangka', e: '🎀', k: 'pita', c: 0xef4444 }],
  };
  const HUES = [0xfacc15, 0x22d3ee, 0xf472b6, 0xa3e635, 0xc084fc, 0xfb923c, 0x34d399, 0xf87171];
  function eventItems(wk) {
    const ev = eventOf(wk), num = +wk.slice(6), hue = HUES[num % HUES.length], hue2 = HUES[(num + 3) % HUES.length];
    return EV_SETS[ev].map((it, i) => ({ ...it, id: `ev${num}_${i}`, n: `${it.n} #${num}`, price: [2500, 3000, 4000, 3500, 4500][i], rar: i >= 2 ? 'legend' : 'epik', c: it.pat ? [hue, hue2] : (it.c || hue), ev: true, wk }));
  }
  const outfitDef = id => OUTFITS[id] || (id && id.startsWith('ev') ? (() => { const num = +id.slice(2, id.indexOf('_')); const yr = new Date().getUTCFullYear(); const wk = `${yr}-W${String(num).padStart(2, '0')}`; return eventItems(wk).find(x => x.id === id); })() : null);
  function patTex(pat, c) {
    const hex = v => '#' + new THREE.Color(v).getHexString();
    return canvasTex(256, 256, (x, w, h) => {
      const C = (c || [0xffffff]).map(hex); x.fillStyle = C[0]; x.fillRect(0, 0, w, h);
      if (pat === 'belang') { x.fillStyle = C[1]; for (let y = 0; y < h; y += 42) x.fillRect(0, y, w, 21); }
      if (pat === 'polka') { x.fillStyle = C[1]; for (let y = 10; y < h; y += 40) for (let xx = (y / 40 % 2) * 20 + 10; xx < w; xx += 40) { x.beginPath(); x.arc(xx, y, 8, 0, 7); x.fill(); } }
      if (pat === 'bunga') { for (let i = 0; i < 26; i++) { const xx = (i * 97) % w, y = (i * 61) % h; x.fillStyle = C[1 + (i % 2)]; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(xx + Math.cos(k * 1.26) * 9, y + Math.sin(k * 1.26) * 9, 6, 0, 7); x.fill(); } x.fillStyle = '#fff'; x.beginPath(); x.arc(xx, y, 4, 0, 7); x.fill(); } }
      if (pat === 'batik') { x.strokeStyle = C[1]; x.lineWidth = 4; for (let y = 0; y < h; y += 48) for (let xx = 0; xx < w; xx += 48) { x.beginPath(); x.arc(xx + 24, y + 24, 16, 0, 7); x.stroke(); x.beginPath(); x.moveTo(xx, y + 24); x.lineTo(xx + 24, y); x.lineTo(xx + 48, y + 24); x.lineTo(xx + 24, y + 48); x.closePath(); x.stroke(); } }
      if (pat === 'pelangi') { ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'].forEach((cc, i) => { x.fillStyle = cc; x.fillRect(0, i * h / 6, w, h / 6 + 1); }); }
      if (pat === 'kotak') { x.fillStyle = C[1]; for (let y = 0; y < h; y += 32) for (let xx = (y / 32 % 2) * 32; xx < w; xx += 64) x.fillRect(xx, y, 32, 32); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } }
      if (pat === 'rompi') { x.fillStyle = C[1]; x.fillRect(0, 0, w * 0.22, h); x.fillRect(w * 0.78, 0, w * 0.22, h); x.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 60; y < h; y += 70) { x.fillRect(w * 0.3, y, 40, 30); x.fillRect(w * 0.58, y, 40, 30); } }
      if (pat === 'renda') { x.fillStyle = C[1]; for (let y = 0; y < h; y += 28) for (let xx = 0; xx < w; xx += 28) { x.beginPath(); x.arc(xx + 14, y + 14, 9, 0, 7); x.fill(); } x.strokeStyle = '#fff'; x.lineWidth = 2; for (let y = 0; y < h; y += 28) for (let xx = 0; xx < w; xx += 28) { x.beginPath(); x.arc(xx + 14, y + 14, 5, 0, 7); x.stroke(); } }
      if (pat === 'kebaya') { x.strokeStyle = C[1]; x.lineWidth = 3; for (let i = 0; i < 14; i++) { const xx = (i * 73) % w, y = (i * 47) % h; for (let k = 0; k < 6; k++) { x.beginPath(); x.ellipse(xx + Math.cos(k) * 10, y + Math.sin(k) * 10, 7, 3, k, 0, 7); x.stroke(); } } x.fillStyle = C[1]; x.fillRect(w * 0.46, 0, w * 0.08, h); }
      if (pat === 'glitter' || pat === 'putri' || pat === 'sisik') { if (pat === 'putri') { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, C[0]); g.addColorStop(1, '#ffffff'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
        if (pat === 'sisik') { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; for (let y = 0; y < h; y += 16) for (let xx = (y / 16 % 2) * 12; xx < w; xx += 24) { x.beginPath(); x.arc(xx, y, 12, 0, Math.PI); x.stroke(); } }
        for (let i = 0; i < 160; i++) { x.fillStyle = i % 3 ? 'rgba(255,255,255,.85)' : C[1]; const xx = (i * 89) % w, y = (i * 53 + i * i) % h, r = 1 + (i % 3); x.beginPath(); x.arc(xx, y, r, 0, 7); x.fill(); } }
      if (pat === 'plisket') { for (let xx = 0; xx < w; xx += 16) { x.fillStyle = (xx / 16) % 2 ? C[1] : C[0]; x.fillRect(xx, 0, 16, h); } }
      if (pat === 'ombak') { x.strokeStyle = C[1]; x.lineWidth = 6; for (let y = 10; y < h; y += 30) { x.beginPath(); for (let xx = 0; xx <= w; xx += 8) x.lineTo(xx, y + Math.sin(xx / 20) * 8); x.stroke(); } }
      if (pat === 'semangka') { x.fillStyle = '#ef4444'; x.fillRect(0, 0, w, h * 0.75); x.fillStyle = '#16a34a'; x.fillRect(0, h * 0.82, w, h * 0.18); x.fillStyle = '#fff'; x.fillRect(0, h * 0.75, w, h * 0.07); x.fillStyle = '#111'; for (let i = 0; i < 18; i++) { x.beginPath(); x.ellipse((i * 53) % w, 20 + (i * 37) % (h * 0.6), 4, 7, 0.3, 0, 7); x.fill(); } }
    });
  }
  function hatMesh(k, c, pat) {
    const g = new THREE.Group(); g.name = 'kostum';
    const gold = () => new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7, roughness: 0.25, emissive: 0x6b4f00, emissiveIntensity: 0.3 });
    if (k === 'caping' || k === 'caping_emas') g.add(mesh(new THREE.ConeGeometry(0.48, 0.24, 14), k === 'caping_emas' ? gold() : M(0xe3c27a), 0, 0.36, 0));
    if (k === 'koboi') { g.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 16), M(0x7c4a1e), 0, 0.27, 0)); g.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.24, 12), M(0x7c4a1e), 0, 0.4, 0)); g.add(mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.05, 12), M(0x111111), 0, 0.31, 0)); }
    if (k === 'bunga') [0xf472b6, 0xfacc15, 0xffffff, 0xa855f7, 0xef4444, 0xf472b6].forEach((cc, i) => { const a = i / 6 * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.06, 6, 5), M(cc), Math.cos(a) * 0.26, 0.24, Math.sin(a) * 0.26, false)); });
    if (k === 'mahkota') { const gm = gold(); g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12, 1, true), gm, 0, 0.32, 0, false)); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(mesh(new THREE.ConeGeometry(0.045, 0.12, 4), gm, Math.cos(a) * 0.23, 0.42, Math.sin(a) * 0.23, false)); } }
    if (k === 'kupluk') { const h = mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(c || 0xdc2626), 0, 0.08, 0); h.scale.y = 1.15; g.add(h); g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), M(0xffffff), 0, 0.45, 0)); }
    if (k === 'pantai') { g.add(mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.03, 18), M(c || 0xfde68a), 0, 0.26, 0)); g.add(mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(c || 0xfde68a), 0, 0.26, 0)); g.add(mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.05, 14), M(0xf472b6), 0, 0.3, 0)); }
    if (k === 'chef') { g.add(mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.18, 14), M(0xffffff), 0, 0.33, 0)); const t = mesh(new THREE.SphereGeometry(0.3, 12, 8), M(0xffffff), 0, 0.5, 0); t.scale.y = 0.6; g.add(t); }
    if (k === 'nelayan') { g.add(mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.04, 16), M(c || 0x22d3ee), 0, 0.27, 0)); g.add(mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.2, 14), M(c || 0x22d3ee), 0, 0.37, 0)); g.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), gold(), 0.27, 0.37, 0.05)); }
    if (k === 'hijab' || k === 'hijab_mutiara') { const hm = Array.isArray(c) ? new THREE.MeshStandardMaterial({ map: patTex('bunga', c), roughness: 0.8 }) : (typeof c === 'object' && c && c.isMaterial) ? c : M(c || 0xf9a8d4);
      const hm2 = pat ? new THREE.MeshStandardMaterial({ map: patTex(pat, Array.isArray(c) ? c : [c, 0xffffff]), roughness: 0.8 }) : hm;
      const hj = mesh(new THREE.SphereGeometry(0.335, 14, 10), hm2, 0, 0.02, -0.075); g.add(hj); const dr = mesh(new THREE.ConeGeometry(0.44, 0.5, 14), hm2, 0, -0.3, -0.04); g.add(dr);
      if (k === 'hijab_mutiara') for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; g.add(mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.2 }), Math.sin(a) * 0.33, 0.2 + Math.cos(a) * 0.05, Math.cos(a) * 0.2, false)); } }
    if (k === 'pita') { const pm = M(c || 0xec4899); for (const sx of [-1, 1]) { const b = mesh(new THREE.ConeGeometry(0.11, 0.2, 4), pm, sx * 0.1, 0.34, -0.02, false); b.rotation.z = sx * Math.PI / 2; g.add(b); } g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), pm, 0, 0.34, -0.02, false)); }
    if (k === 'bando') { const t = mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 20, Math.PI), M(0xfdf2f8), 0, 0.12, 0, false); t.rotation.y = Math.PI / 2; g.add(t); for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; g.add(mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.15 }), 0, 0.12 + Math.sin(a) * 0.29, Math.cos(a) * 0.29, false)); } }
    if (k === 'jepit') { [0xef4444, 0xf97316, 0xef4444, 0xf97316, 0xef4444].forEach((cc, i) => { const a = i / 5 * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), M(cc), 0.25 + Math.cos(a) * 0.05, 0.15 + Math.sin(a) * 0.05, 0.08, false)); }); g.add(mesh(new THREE.SphereGeometry(0.03, 6, 5), M(0xfacc15), 0.27, 0.15, 0.1, false)); }
    if (k === 'lebar') { g.add(mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.025, 20), M(c || 0xfef3c7), 0, 0.25, 0)); g.add(mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(c || 0xfef3c7), 0, 0.25, 0)); g.add(mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.06, 14), M(0xec4899), 0, 0.29, 0)); for (const sx of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), M(0xec4899), 0.08 * sx, 0.18, -0.3, false); b.rotation.z = sx * 0.3; g.add(b); } }
    if (k === 'tiara') { const sm = new THREE.MeshStandardMaterial({ color: Array.isArray(c) ? c[0] : (c || 0xe5e7eb), metalness: 0.85, roughness: 0.15, emissive: 0x334155, emissiveIntensity: 0.25 }); const gem = new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x2563eb, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.1 });
      const band = mesh(new THREE.TorusGeometry(0.27, 0.018, 6, 24, Math.PI), sm, 0, 0.18, 0.02, false); band.rotation.x = -0.3; g.add(band); for (let i = 0; i < 5; i++) { const a = 0.35 + i * 0.6; const sp = mesh(new THREE.ConeGeometry(0.035, i === 2 ? 0.2 : 0.12, 4), sm, Math.cos(a) * 0.27, 0.22 + (i === 2 ? 0.08 : 0.04), Math.sin(a) * 0.27 * 0.9, false); g.add(sp); }
      g.add(mesh(new THREE.OctahedronGeometry(0.055), gem, 0, 0.33, 0.27, false)); }
    if (k === 'semangka') { const r = mesh(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x16a34a), 0, 0.08, 0); g.add(r); g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 14), M(0xef4444), 0, 0.09, 0)); g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 4), M(0x7c4a1e), 0, 0.45, 0)); }
    return g;
  }
  function accMesh(k, c) {
    const g = new THREE.Group(); g.name = 'aksesoris'; const head = [], body = [];
    const gold = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.75, roughness: 0.25 });
    if (k === 'kacamata') { const m = M(c || 0x111111); for (const sx of [-1, 1]) head.push(mesh(new THREE.BoxGeometry(0.13, 0.08, 0.03), m, sx * 0.1, 0.05, 0.285, false)); head.push(mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), m, 0, 0.07, 0.29, false)); }
    if (k === 'syal') { const t = mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 16), M(c || 0xdc2626), 0, 1.05, 0.02, false); t.rotation.x = Math.PI / 2; body.push(t); body.push(mesh(new THREE.BoxGeometry(0.1, 0.3, 0.05), M(c || 0xdc2626), 0.1, 0.88, 0.25, false)); }
    if (k === 'ransel') { body.push(mesh(new THREE.BoxGeometry(0.36, 0.4, 0.18), M(c || 0x2563eb), 0, 0.82, -0.32)); body.push(mesh(new THREE.BoxGeometry(0.3, 0.14, 0.05), M(0x1e3a8a), 0, 0.7, -0.42, false)); }
    if (k === 'kalung' || k === 'mutiara') { const t = mesh(new THREE.TorusGeometry(0.2, 0.015, 5, 20), k === 'mutiara' ? M(0xf8fafc) : gold, 0, 1.0, 0.06, false); t.rotation.x = Math.PI / 2.4; body.push(t); body.push(mesh(new THREE.SphereGeometry(0.04, 8, 6), k === 'mutiara' ? M(c || 0xf472b6) : gold, 0, 0.9, 0.29, false)); }
    if (k === 'tas') { const hb = []; hb.push(mesh(new THREE.BoxGeometry(0.22, 0.17, 0.09), M(c || 0xdb2777), 0, -0.55, 0.05)); const hd = mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 12, Math.PI), M(0xfacc15), 0, -0.46, 0.05, false); hb.push(hd); return { head, body, hand: hb }; }
    if (k === 'payung') { const hb = []; hb.push(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), M(0x7c4a1e), 0, -0.05, 0.05, false)); const top = mesh(new THREE.ConeGeometry(0.55, 0.22, 12, 1, true), new THREE.MeshStandardMaterial({ color: c || 0xfbcfe8, side: THREE.DoubleSide }), 0, 0.42, 0.05); hb.push(top);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; hb.push(mesh(new THREE.SphereGeometry(0.03, 5, 4), M(0xffffff), Math.cos(a) * 0.55, 0.31, Math.sin(a) * 0.55 + 0.05, false)); } return { head, body, hand: hb }; }
    if (k === 'kipas') { const hb = []; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.absarc(0, 0, 0.22, 0.3, Math.PI - 0.3, false); sh.lineTo(0, 0); const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ map: patTex('bunga', [c || 0xf472b6, 0xffffff, 0xfacc15]), side: THREE.DoubleSide })); f.position.set(0, -0.5, 0.1); hb.push(f); return { head, body, hand: hb }; }
    if (k === 'anting') { const gm = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.15 }); for (const sx of [-1, 1]) { head.push(mesh(new THREE.SphereGeometry(0.035, 8, 6), gm, sx * 0.29, -0.08, 0.02, false)); head.push(mesh(new THREE.SphereGeometry(0.015, 6, 5), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8 }), sx * 0.29, -0.03, 0.02, false)); } }
    if (k === 'kupu') { const cols = [[0xf472b6, 0xa78bfa], [0x60a5fa, 0x34d399]];
      for (const sx of [-1, 1]) for (const [j, yy] of [[0, 1.05], [1, 0.8]]) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(sx * 0.2, 0.35 - j * 0.3, sx * 0.6, 0.3 - j * 0.35, sx * 0.5, -0.05 - j * 0.1); sh.lineTo(0, 0);
        const mat_ = new THREE.MeshStandardMaterial({ map: patTex('glitter', cols[j]), side: THREE.DoubleSide, transparent: true, opacity: 0.93, emissive: cols[j][0], emissiveIntensity: 0.25 });
        const w = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat_); w.position.set(sx * 0.04, yy, -0.29); w.userData.wing = sx; body.push(w); } }
    if (k === 'sayap') { const wm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff7cc, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
      for (const sx of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(sx * 0.55, 0.5, sx * 0.7, 0.05); sh.quadraticCurveTo(sx * 0.45, -0.25, 0, -0.1); const w = new THREE.Mesh(new THREE.ShapeGeometry(sh), wm); w.position.set(sx * 0.05, 0.95, -0.28); w.userData.wing = sx; body.push(w); } }
    return { head, body, hand: [] };
  }
  const HAIR_C = [0x1c1410, 0x4a2c17, 0x7c4a1e, 0x8b5a2b];
  function baseHair(look) {
    const g = new THREE.Group(); g.name = 'basehair'; const hc = M(look.hc || 0x1c1410);
    if (look.hair === 'pendek') g.add(mesh(new THREE.SphereGeometry(0.305, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2.4), hc, 0, 0.03, -0.02));
    if (look.hair === 'jabrik') { g.add(mesh(new THREE.SphereGeometry(0.305, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2.4), hc, 0, 0.03, -0.02)); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const sp = mesh(new THREE.ConeGeometry(0.06, 0.18, 4), hc, Math.cos(a) * 0.16, 0.28, Math.sin(a) * 0.16 - 0.03, false); sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(sp); } }
    if (look.hair === 'peci') g.add(mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.17, 12), M(0x161616), 0, 0.22, 0));
    if (look.hair === 'panjang' || look.hair === 'kuncir' || look.hair === 'sanggul') {
      g.add(mesh(new THREE.SphereGeometry(0.315, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), hc, 0, 0.02, -0.02));
      const fr = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), hc, 0, 0.17, 0.24); fr.rotation.x = -0.3; g.add(fr); // poni
      if (look.hair === 'panjang') { const back = mesh(new THREE.BoxGeometry(0.56, 0.62, 0.18), hc, 0, -0.18, -0.2); g.add(back); for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.1, 0.46, 0.14), hc, sx * 0.27, -0.12, 0.02)); }
      if (look.hair === 'kuncir') { g.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), M(0xec4899), 0, 0.15, -0.3, false)); const pt = mesh(new THREE.CylinderGeometry(0.09, 0.03, 0.45, 8), hc, 0, -0.08, -0.38); pt.rotation.x = 0.35; g.add(pt); }
      if (look.hair === 'sanggul') g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), hc, 0, 0.12, -0.33));
    }
    if (look.hair === 'hijab') { const hm = M(look.hjc || 0xf9a8d4); g.add(mesh(new THREE.SphereGeometry(0.335, 14, 10), hm, 0, 0.02, -0.075)); g.add(mesh(new THREE.ConeGeometry(0.44, 0.5, 14), hm, 0, -0.3, -0.04)); }
    if (look.g === 'w') { for (const sx of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.07, 0.015, 0.01), M(0x111111), sx * 0.1, 0.095, 0.27, false); l.rotation.z = sx * -0.25; g.add(l); } }
    return g;
  }
  function skirtMesh(type, mat_) {
    const g = new THREE.Group(); g.name = 'skirt';
    if (type === 'mekar') g.add(mesh(new THREE.CylinderGeometry(0.3, 0.46, 0.34, 18, 1, true), mat_, 0, 0.42, 0));
    if (type === 'plisket') g.add(mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.42, 24, 1, true), mat_, 0, 0.38, 0));
    if (type === 'tutu') { for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.3, 0.55 - i * 0.05, 0.08, 20, 1, true), mat_, 0, 0.48 - i * 0.05, 0)); }
    if (type === 'panjang') g.add(mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.62, 20, 1, true), mat_, 0, 0.3, 0));
    if (type === 'gaun' || type === 'duyung') { g.add(mesh(new THREE.CylinderGeometry(0.3, type === 'gaun' ? 0.68 : 0.36, 0.64, 24, 1, true), mat_, 0, 0.3, 0));
      if (type === 'duyung') { const f = mesh(new THREE.ConeGeometry(0.5, 0.3, 18, 1, true), mat_, 0, 0.0, 0); f.rotation.x = Math.PI; g.add(f); }
      else for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdbeafe, emissiveIntensity: 0.5 }), Math.cos(a) * 0.67, 0.0, Math.sin(a) * 0.67, false)); } }
    g.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; } });
    return g;
  }
  const isGenerated = e => !e.ps && !e.char;
  const torsoMesh = m => m.body.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry' && Math.abs((c.geometry.parameters.radius || 0) - 0.34) < 0.01);
  function applyCostume(u, s) {
    const e = W.ENT.find(x => x.u === u); if (!e) return;
    const wear = s && s.wear || (s && s.hat ? { hat: 'hat_' + s.hat } : {}); const look = s && s.look || null;
    const key = JSON.stringify([wear, look]); if (e.m.root.userData.wearKey === key) return; e.m.root.userData.wearKey = key;
    const m = e.m, torso = torsoMesh(m);
    if (!m.root.userData.orig) m.root.userData.orig = { torso: torso && torso.material, legs: m.legs.map(l => l.children[0].material) };
    const O = m.root.userData.orig;
    // clear previous
    [m.head, m.body, m.arms[1]].forEach(p => p.children.filter(c => c.name === 'kostum' || c.name === 'basehair' || c.name === 'skirt' || c.userData.fashion).forEach(c => p.remove(c)));
    if (torso) torso.material = O.torso; m.legs.forEach((l, i) => { l.children[0].material = O.legs[i]; l.visible = true; });
    // base look (gender & rambut) — untuk karakter warga biasa; pegawai tetap pakai topi seragamnya
    if (!m.root.userData.origHead) m.root.userData.origHead = m.head.children.slice(6);
    m.root.userData.origHead.forEach(c => c.visible = !(look && isGenerated(e)));
    if (look && isGenerated(e)) m.head.add(baseHair(look)); else if (look && look.g === 'w') { const bh = baseHair({ g: 'w', hair: 'none' }); m.head.add(bh); }
    const hd = outfitDef(wear.hat); if (hd) { if (hd.k === 'hijab' || hd.k === 'hijab_mutiara') { const bh = m.head.getObjectByName('basehair'); if (bh) bh.children.forEach((c, i) => { if (i < 2 || c.geometry?.type === 'BoxGeometry' && c.geometry.parameters.width > 0.3) c.visible = false; }); } m.head.add(hatMesh(hd.k, hd.c, hd.pat === 'ombak' || hd.pat === 'bunga' ? hd.pat : null)); }
    const td = outfitDef(wear.top); if (td && torso) torso.material = td.pat === 'polos' ? M(td.c[0]) : new THREE.MeshStandardMaterial({ map: patTex(td.pat, td.c), roughness: 0.8 });
    if (td && torso && (td.glow || td.shine)) { torso.material.emissive = new THREE.Color(td.c[0]); torso.material.emissiveIntensity = 0.18; torso.material.roughness = 0.35; torso.material.metalness = 0.15; }
    const bd = outfitDef(wear.bottom); if (bd) { const bm = bd.pat === 'polos' ? new THREE.MeshStandardMaterial({ color: bd.c[0], roughness: bd.shine ? 0.3 : 0.8, metalness: bd.shine ? 0.15 : 0 }) : new THREE.MeshStandardMaterial({ map: patTex(bd.pat, bd.c), roughness: 0.7 });
      if (bd.glow) { bm.emissive = new THREE.Color(bd.c[0]); bm.emissiveIntensity = 0.15; }
      if (bd.skirt) { const sk = skirtMesh(bd.skirt, bm); m.body.add(sk); if (bd.skirt === 'panjang' || bd.skirt === 'gaun' || bd.skirt === 'duyung') m.legs.forEach(l => l.visible = false); }
      else m.legs.forEach(l => l.children[0].material = bm); }
    const ad = outfitDef(wear.acc); if (ad) { const a = accMesh(ad.k, ad.c); a.head.forEach(o => { o.userData.fashion = true; m.head.add(o); }); a.body.forEach(o => { o.userData.fashion = true; m.body.add(o); }); (a.hand || []).forEach(o => { o.userData.fashion = true; m.arms[1].add(o); }); }
  }
  function migrateWardrobe(s) {
    s.closet = s.closet || []; s.wear = s.wear || {};
    (s.hats || []).forEach(h => { const id = 'hat_' + h; if (!s.closet.includes(id)) s.closet.push(id); }); if (s.hat && !s.wear.hat) s.wear.hat = 'hat_' + s.hat; delete s.hats; delete s.hat;
  }
  let closetTab = 'hat', genderFilter = null;
  const gOk = d => genderFilter === 'all' || !d.g || d.g === genderFilter;
  function openCloset(tab) {
    if (typeof tab === 'string') closetTab = tab; const s = ME.s; migrateWardrobe(s); const el = $('gClosetList'); if (!genderFilter) genderFilter = s.look?.g || 'all';
    $('gClosetTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === closetTab));
    const card = (id, d, owned, extra = '') => { const on = s.wear[d.slot] === id; const R = RAR[d.rar]; extra = extra || (d.g === 'w' ? '<span style="color:#db2777"> · 👩</span>' : d.g === 'p' ? '<span style="color:#2563eb"> · 👨</span>' : '');
      return `<div class="gitem"><div class="ic">${d.e}</div><div class="tx"><b>${d.n}</b><span style="color:${R.c};font-weight:700">${d.ev ? '✨ ' : ''}${R.n}</span>${extra}</div>${owned ? `<button data-w="${id}" style="${on ? 'background:#14181f' : ''}">${on ? 'Dipakai' : 'Pakai'}</button>` : `<button data-b="${id}" ${s.coins < d.price || (d.lv && d.lv > s.level) ? 'disabled' : ''}>${d.lv && d.lv > s.level ? '🔒 Lv ' + d.lv : '🪙 ' + fmt(d.price)}</button>`}</div>`; };
    if (closetTab === 'look') {
      const L = s.look || { g: 'p', hair: 'pendek', hc: HAIR_C[0] };
      const HAIRS = { w: [['panjang', '💇‍♀️ Panjang'], ['kuncir', '🎀 Kuncir'], ['sanggul', '👩 Sanggul'], ['hijab', '🧕 Hijab']], p: [['pendek', '👦 Pendek'], ['jabrik', '🦔 Jabrik'], ['peci', '🧢 Peci']] };
      el.innerHTML = `<div style="font-size:13px;font-weight:700;margin:6px 0">Karakter: ${L.g === 'w' ? '👩 Perempuan' : '👨 Laki-laki'}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${HAIRS[L.g].map(([k, t]) => `<button class="gbtn" data-lh="${k}" style="padding:8px 10px;${L.hair === k ? 'background:#14181f' : ''}">${t}</button>`).join('')}</div>
        <div style="font-size:13px;font-weight:700;margin:12px 0 4px">Warna rambut</div><div style="display:flex;gap:8px">${HAIR_C.map(c => `<button data-lc="${c}" style="width:34px;height:34px;border-radius:50%;border:3px solid ${L.hc === c ? '#f59e0b' : '#e5e7eb'};background:#${c.toString(16).padStart(6, '0')}"></button>`).join('')}</div>
        <div style="font-size:13px;font-weight:700;margin:12px 0 4px">Warna hijab</div><div style="display:flex;gap:8px">${[0xf9a8d4, 0x99f6e4, 0xc4b5fd, 0xfde68a, 0x1f2937, 0xffffff].map(c => `<button data-lj="${c}" style="width:34px;height:34px;border-radius:50%;border:3px solid ${L.hjc === c ? '#14181f' : '#e5e7eb'};background:#${c.toString(16).padStart(6, '0')}"></button>`).join('')}</div>`;
      const upd = f => { s.look = { ...L, ...f }; applyCostume(ME.u, s); after([]); openCloset(); };
      el.querySelectorAll('[data-lh]').forEach(b => b.onclick = () => upd({ hair: b.dataset.lh }));
      el.querySelectorAll('[data-lc]').forEach(b => b.onclick = () => upd({ hc: +b.dataset.lc }));
      el.querySelectorAll('[data-lj]').forEach(b => b.onclick = () => upd({ hjc: +b.dataset.lj }));
    } else if (closetTab === 'shop') {
      const wk = weekKey(Date.now()), evs = eventItems(wk), ev = EVENTS[eventOf(wk)];
      const left = Math.ceil((dayEnd(Date.now()) + (6 - ((new Date(Date.now() + WIB).getUTCDay() + 6) % 7)) * 864e5 - Date.now()) / 864e5);
      el.innerHTML = `<div style="background:linear-gradient(135deg,#fdf2f8,#fef3c7);border-radius:14px;padding:10px 12px;margin:4px 0 6px"><b>✨ Koleksi Terbatas ${ev.n}</b><div style="font-size:12px;color:#7a4b00">Hanya dijual minggu ini · sisa ${left} hari · setelah itu tidak akan dijual lagi!</div></div>` +
        `<div class="gtabs" style="margin:6px 0">${[['w', '👩 Wanita'], ['p', '👨 Pria'], ['all', '🌈 Semua']].map(([k, t]) => `<button data-gf="${k}" class="${genderFilter === k ? 'on' : ''}">${t}</button>`).join('')}</div>` +
        evs.filter(gOk).map(d => card(d.id, d, s.closet.includes(d.id))).join('') +
        Object.entries(SLOTS).map(([sl, t]) => `<h4 style="margin:12px 0 2px;font-size:11px;letter-spacing:.8px;color:#5b6472">${t.toUpperCase()}</h4>` + Object.entries(OUTFITS).filter(([id, d]) => d.slot === sl && gOk(d)).sort((a, b) => (a[1].g === s.look?.g ? -1 : 0) - (b[1].g === s.look?.g ? -1 : 0)).map(([id, d]) => card(id, d, s.closet.includes(id))).join('')).join('');
    } else {
      const own = s.closet.filter(id => outfitDef(id)?.slot === closetTab);
      el.innerHTML = `<div class="gitem"><div class="ic">🚫</div><div class="tx"><b>Tanpa ${SLOTS[closetTab].slice(3).toLowerCase()}</b><span>Pakai gaya bawaan</span></div><button data-w="" data-slot="${closetTab}" style="${!s.wear[closetTab] ? 'background:#14181f' : ''}">${!s.wear[closetTab] ? 'Dipakai' : 'Pakai'}</button></div>` +
        own.map(id => card(id, outfitDef(id), true)).join('') + (own.length ? '' : `<p style="color:#6b7280;font-size:13px">Belum punya. Belanja di tab ✨ Butik!</p>`);
    }
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const id = b.dataset.w, d = outfitDef(id); s.wear[d ? d.slot : b.dataset.slot] = id || undefined; if (!id) delete s.wear[b.dataset.slot]; applyCostume(ME.u, s); after([]); openCloset(); });
    el.querySelectorAll('[data-gf]').forEach(b => b.onclick = () => { genderFilter = b.dataset.gf; openCloset(); });
    el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const id = b.dataset.b, d = outfitDef(id); if (!d || s.coins < d.price) return; s.coins -= d.price; s.closet.push(id); s.wear[d.slot] = id; applyCostume(ME.u, s); after([`${d.e} ${d.n} dibeli & langsung dipakai!${d.ev ? ' Item langka edisi terbatas ✨' : ''}`]); openCloset(); });
    if (!$('gP_closet').classList.contains('on')) { openP('gP_closet'); ME.walk = null; const p = ME.v.root.localToWorld(V(-0.55, 0, 0.05)); p.y = ME.v.root.position.y; ME.ent.m.root.position.copy(p); ME.ent.m.root.rotation.y = 0; W.flyTo(V(p.x, p.y - 0.05, p.z), 4.7, V(-0.12, 0.16, 1)); }
  }
  const wingTick = t => { for (const e of W.ENT) { if (!e.m.root.userData.wearKey || !e.m.root.userData.wearKey.includes('sayap')) continue; e.m.body.children.forEach(c => { if (c.userData.wing) c.rotation.y = c.userData.wing * (0.25 + Math.sin(t * 3) * 0.25); }); } };
  // ---- hujan (visual) ----
  const RAIN = (() => { const n = 700, g = new THREE.BufferGeometry(), p = new Float32Array(n * 6); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.55 })); l.frustumCulled = false; l.visible = false; scene.add(l);
    const seeds = Array.from({ length: n }, () => [Math.random() * 30 - 15, Math.random() * 14, Math.random() * 30 - 15]); return { l, p, seeds, n }; })();
  let baseSun = null;
  function rainTick(t) {
    const on = weatherOf(dayKey(Date.now())).rain; RAIN.l.visible = on;
    if (baseSun === null) baseSun = sun.intensity; sun.intensity = on ? baseSun * 0.55 : baseSun;
    if (!on) return; const c = W.controls.target;
    for (let i = 0; i < RAIN.n; i++) { const s = RAIN.seeds[i]; const y = ((s[1] - t * 9) % 14 + 14) % 14; const x = c.x + s[0], z = c.z + s[2];
      RAIN.p.set([x, y, z, x - 0.03, y - 0.45, z], i * 6); }
    RAIN.l.geometry.attributes.position.needsUpdate = true;
  }
  // ---- panel Kegiatan (tabs) ----
  let actTab = 'mis';
  function renderAct(tab) {
    if (tab) actTab = tab; const s = ME.s, el = $('gMisList'); tickState(s, Date.now());
    $('gActTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === actTab));
    const H = t => `<h4 style="margin:10px 0 4px;font-size:11px;letter-spacing:.8px;color:#5b6472">${t}</h4>`;
    if (actTab === 'mis') { misHTML(el); return; }
    if (actTab === 'order') {
      const os = ordersToday(s.level), done = s.orders?.day === dayKey(Date.now()) ? s.orders.done : [];
      el.innerHTML = H('PAPAN PESANAN WARGA · ganti tiap hari') + os.map(o => { const it = ITEMS[o.k], have = s.inv[o.k] || 0, ok = done.includes(o.id);
        return `<div class="gitem"><div class="ic">${it.e}</div><div class="tx"><b>${o.who === 'Bang Tanjung' ? '🧑‍🌾 Bang Tanjung' : '@' + o.who}: ${o.q} ${it.n}</b><span>${ORDER_WHY[o.who] || ''} · kamu punya ${have} · +${o.xp} XP</span></div><button data-o="${o.id}" ${ok || have < o.q ? 'disabled' : ''}>${ok ? '✅ Selesai' : '🪙 ' + fmt(o.rew)}</button></div>`; }).join('') +
        `<p style="font-size:12px;color:#6b7280;margin-top:10px">Pesanan memberi koin lebih banyak daripada menjual biasa. Pesanan sama untuk semua pemain, ganti setiap tengah malam.</p>`;
      el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => fillOrder(os.find(o => o.id === b.dataset.o))); return;
    }
    if (actTab === 'gr') {
      const wk = weekKey(Date.now()), goal = grGoal(wk), mine = GR.people?.[ME.u] || 0, done = grDone(goal);
      el.innerHTML = H(`GOTONG ROYONG MINGGU INI`) + `<div style="background:#ecfdf5;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:600;margin-bottom:8px">🏗️ Kalau semua target tercapai, Bang Tanjung akan membangun <b>${goal.build}</b> di video! Semua penyumbang dapat lencana & +500 koin.</div>` +
        goal.items.map(it => { const I = ITEMS[it.k], tot = GR.totals?.[it.k] || 0, have = s.inv[it.k] || 0;
          return `<div class="gmis ${tot >= it.n ? 'done' : ''}"><b>${I.e} ${I.n}</b><span style="float:right;font-size:12px;color:#5b6472">${fmt(Math.min(tot, it.n))}/${fmt(it.n)}</span><div class="bar"><i style="width:${Math.min(100, 100 * tot / it.n)}%"></i></div>
            <div style="margin-top:6px;display:flex;gap:6px;align-items:center;font-size:12px;color:#5b6472">Punya ${have} <button class="gbtn" data-g="${it.k}" data-n="1" ${have < 1 ? 'disabled' : ''}>+1</button><button class="gbtn" data-g="${it.k}" data-n="5" ${have < 5 ? 'disabled' : ''}>+5</button><button class="gbtn" data-g="${it.k}" data-n="${have}" ${have < 1 ? 'disabled' : ''}>Semua</button></div></div>`; }).join('') +
        `<div style="margin-top:10px;font-size:12.5px;color:#5b6472">Sumbanganmu minggu ini: <b>${mine}</b> · Penyumbang: <b>${Object.keys(GR.people || {}).length}</b></div>` +
        (done ? (s.grClaim === wk ? `<div class="gmis done"><b>✅ Hadiah gotong royong sudah diambil</b></div>` : mine > 0 ? `<button class="gbig" id="gGrClaim">🎉 Target tercapai! Ambil hadiah +500 koin</button>` : '') : '') +
        `<h4 style="margin:12px 0 4px;font-size:11px;letter-spacing:.8px;color:#5b6472">PENYUMBANG TERBANYAK</h4>` + Object.entries(GR.people || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, n], i) => `<div style="font-size:13px;padding:2px 0">${['🥇', '🥈', '🥉'][i] || '·'} @${esc(u)} — ${n}</div>`).join('');
      el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => grGive(b.dataset.g, +b.dataset.n));
      const c = $('gGrClaim'); if (c) c.onclick = () => { s.grClaim = wk; s.coins += 500; s.badges = [...(s.badges || []), 'GR-' + wk]; after(['🤝 Hadiah gotong royong +500 koin & lencana!']); renderAct('gr'); };
      return;
    }
    if (actTab === 'event') {
      const wk = weekKey(Date.now()), ev = EVENTS[eventOf(wk)], my = s.event?.week === wk ? s.event.score : 0;
      const rows = LIST.map(r => ME && r.username === ME.u ? { u: r.username, sc: my } : { u: r.username, sc: r.state?.event?.week === wk ? r.state.event.score : 0 }).filter(r => r.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 10);
      el.innerHTML = H('EVENT MINGGU INI · ganti tiap Senin') + `<div style="background:#fff7e6;border-radius:12px;padding:12px;font-size:13.5px"><b style="font-size:15px">${ev.n}</b><br>${ev.d}<br><br>Skormu: <b>${my} ${ev.u}</b><br><span style="color:#7a4b00">🏆 Juara minggu ini akan diumumkan Bang Tanjung di video!</span></div>` +
        H('KLASEMEN') + (rows.map((r, i) => `<div class="gitem"><div class="ic" style="font-size:18px;font-weight:800">${['🥇', '🥈', '🥉'][i] || i + 1}</div><div class="tx"><b>@${esc(r.u)}</b></div><b>${r.sc} ${ev.u}</b></div>`).join('') || '<p style="color:#6b7280;font-size:13px">Belum ada peserta. Jadilah yang pertama!</p>');
      return;
    }
    if (actTab === 'cal') {
      const day = ((Math.max(1, s.streak) - 1) % 7) + 1;
      el.innerHTML = H('KALENDER LOGIN · datang tiap hari, jangan putus!') + `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${CAL.map((c, i) => `<div style="border-radius:12px;padding:8px 6px;text-align:center;font-size:11.5px;font-weight:700;background:${i + 1 < day ? '#dcfce7' : i + 1 === day ? '#fde68a' : '#f3f4f6'};${i === 6 ? 'grid-column:span 2' : ''}">Hari ${i + 1}<br><span style="font-size:${i === 6 ? 22 : 18}px">${['🪙', '🌾', '🌽', '🪙', '🪱', '💰', '🐄'][i]}</span><br>${c.txt.replace(/\(.+\)/, '')}${i + 1 < day ? '<br>✅' : i + 1 === day ? '<br>⭐ hari ini' : ''}</div>`).join('')}</div>
        <p style="font-size:12.5px;color:#5b6472;margin-top:10px">🔥 Login beruntun: ${s.streak} hari. Kalau bolos sehari, kalender mulai lagi dari Hari 1.</p>`;
      return;
    }
  }

  // ---------------- fishing ----------------
  const FISHING = { st: 'off', t0: 0, biteAt: 0, fish: null, rod: null, line: null, bob: null, mk: 0, dir: 1, zone: [0.4, 0.6] };
  {
    const rod = new THREE.Group(); const rm = mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.5, 5), M(0x5b3a1e), 0, -0.2, 0.7, false); rm.rotation.x = Math.PI / 2 - 0.5; rod.add(rm);
    rod.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), M(0x111827), 0, -0.42, 0.05, false));
    const tip = new THREE.Object3D(); tip.position.set(0, 0.15, 1.38); rod.add(tip); rod.userData.tip = tip; FISHING.rod = rod;
    const bob = new THREE.Group(); bob.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), M(0xef4444), 0, 0.03, 0, false)); bob.add(mesh(new THREE.SphereGeometry(0.071, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(0xffffff), 0, 0.03, 0, false));
    bob.visible = false; scene.add(bob); FISHING.bob = bob;
    const lg = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]); FISHING.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf8fafc })); FISHING.line.visible = false; FISHING.line.frustumCulled = false; scene.add(FISHING.line);
  }
  const FSPOT = () => { const p = pml(0.85, 0, 1.75); p.y = PIER.y + 0.04; return p; };
  const FBOB = () => pml(3.3, 0, 1.9);
  const FYAW = () => PM.rotation.y + Math.PI / 2;
  function startFishing() {
    if (!ME) return; closeP(); document.body.classList.add('fishing');
    const S = ME.ent.sim; S.manual = true; ME.walk = null;
    const p = FSPOT(); ME.ent.m.root.position.copy(p); ME.ent.m.root.rotation.y = FYAW();
    ME.ent.m.arms[1].add(FISHING.rod);
    const b = FBOB(); const back = pml(-0.75, 0, -1).sub(PM.position).setY(0).normalize(); W.flyTo(V((p.x * 0.5 + b.x * 0.5), 0.5, (p.z * 0.5 + b.z * 0.5)), 7.5, V(back.x, 1.05, back.z));
    FISHING.st = 'idle'; setCast('🎣 Lempar Kail'); tip(`Umpan: ${ME.s.inv.umpan || 0} 🪱 · Energi ${ME.s.energy}. Lempar kail lalu tunggu pelampung tenggelam!`);
  }
  function stopFishing() {
    document.body.classList.remove('fishing'); $('gReel').classList.remove('on');
    FISHING.st = 'off'; FISHING.bob.visible = false; FISHING.line.visible = false; if (FISHING.rod.parent) FISHING.rod.parent.remove(FISHING.rod);
    if (ME) enterGame();
  }
  const setCast = (txt, bite) => { $('gCast').textContent = txt; $('gCast').classList.toggle('bite', !!bite); };
  function pickFish(s) {
    const pool = Object.entries(FISH).filter(([k, f]) => f.lv <= s.level); const hr = new Date(Date.now() + WIB).getUTCHours(); const night = hr >= 18 || hr < 6;
    const tw = pool.reduce((a, [k, f]) => a + f.w * (night && (k === 'tuna' || k === 'gurita') ? 2 : 1), 0); let r = Math.random() * tw;
    for (const [k, f] of pool) { r -= f.w * (night && (k === 'tuna' || k === 'gurita') ? 2 : 1); if (r <= 0) return k; } return 'teri';
  }
  function onCast() {
    const s = ME.s, now = performance.now();
    if (FISHING.st === 'idle') {
      tickState(s, Date.now());
      if (!(s.inv.umpan > 0)) { W.toast('🪱 Umpan habis! Beli Umpan Cacing di 🏪 Toko.'); return; }
      if (!useEnergy(ENERGY.fish)) return; s.inv.umpan--; updateHUD();
      FISHING.st = 'cast'; FISHING.t0 = now; FISHING.biteAt = now + 900 + 1500 + Math.random() * 4500; setCast('⏳ Menunggu…'); tip('Sabar… tunggu pelampungnya tenggelam.');
    } else if (FISHING.st === 'bite') {
      const k = pickFish(s), f = FISH[k]; FISHING.fish = k; FISHING.st = 'reel';
      const w = clamp(f.d + (s.level - 1) * 0.008, 0.08, 0.45), c = 0.15 + Math.random() * (0.7 - w); FISHING.zone = [c, c + w]; FISHING.mk = 0; FISHING.dir = 1; FISHING.spd = 0.9 + (0.4 - f.d) * 3.2;
      $('gZone').style.left = `${c * 100}%`; $('gZone').style.width = `${w * 100}%`; $('gReelT').textContent = 'Ada yang nyangkut! Tarik saat penanda di zona hijau!'; $('gReel').classList.add('on'); setCast('🎣 …');
    } else if (FISHING.st === 'wait' || FISHING.st === 'cast') { W.toast('Belum ada yang makan umpan… tunggu pelampungnya tenggelam.'); }
  }
  function onPull() {
    if (FISHING.st !== 'reel') return; const s = ME.s, k = FISHING.fish, f = FISH[k], msgs = [];
    $('gReel').classList.remove('on'); const ok = FISHING.mk >= FISHING.zone[0] && FISHING.mk <= FISHING.zone[1];
    const wp = FBOB().add(V(0, 0.6, 0));
    if (ok) {
      if (f.coins) { s.coins += f.coins; floatTxt(`💰 +${f.coins} koin!`, wp); W.toast(`💰 WOW! Kamu menarik Peti Harta berisi ${f.coins} koin!`); }
      else {
        const kg = +(f.kg * (0.6 + Math.random() * 0.9)).toFixed(f.kg < 1 ? 2 : 1); s.inv['ikan_' + k] = (s.inv['ikan_' + k] || 0) + 1;
        if (!f.junk) { s.stats.fish = (s.stats.fish || 0) + 1; emit(s, 'fish', 1, k, msgs); albumAdd(s, 'fish', k, msgs); eventScore(s, 'mancing', 1, msgs); if (!s.best || kg > s.best.kg) { s.best = { k, kg }; msgs.push(`🏆 Rekor baru! ${f.n} ${kg} kg`); } }
        floatTxt(`+1 ${f.e} ${f.n}`, wp); W.toast(f.junk ? `👢 Yah… cuma ${f.n}. Coba lagi!` : `${f.e} Dapat ${f.n} (${kg} kg)!`);
      }
      addXP(s, f.junk ? 1 : 3 + Math.round(f.price / 40), msgs);
    } else W.toast(`💨 Yah, ${f.junk ? 'tangkapannya' : 'ikannya'} lepas! Coba lagi.`);
    FISHING.st = 'idle'; FISHING.bob.visible = false; FISHING.line.visible = false; setCast('🎣 Lempar Kail'); tip(`Umpan: ${s.inv.umpan || 0} 🪱 · Energi ${s.energy}`); after(msgs);
  }
  function fishTick(t, dt, now) {
    if (FISHING.st === 'off' || !ME) return;
    const m = ME.ent.m; vPose(m, { t }); m.arms[1].rotation.set(-0.9, 0, 0.15); m.root.rotation.y = FYAW();
    const b = FBOB(); const wy = (typeof waveH === 'function' ? waveH(b.x, b.z, t) : 0.1);
    if (FISHING.st === 'cast') { const k = Math.min(1, (now - FISHING.t0) / 700); const st = FSPOT().add(V(0, 1.6, 0)); FISHING.bob.visible = true; FISHING.bob.position.lerpVectors(st, V(b.x, wy + 0.05, b.z), k); FISHING.bob.position.y += Math.sin(k * Math.PI) * 1.2; if (k >= 1) FISHING.st = 'wait'; m.arms[1].rotation.set(-2.2 + k * 1.3, 0, 0.15); }
    if (FISHING.st === 'wait') { FISHING.bob.position.set(b.x, wy + 0.05 + Math.sin(t * 3) * 0.015, b.z); if (now > FISHING.biteAt) { FISHING.st = 'bite'; FISHING.biteEnd = now + 1300; setCast('❗ TARIK SEKARANG!', true); } }
    if (FISHING.st === 'bite') { FISHING.bob.position.set(b.x + Math.sin(t * 40) * 0.03, wy - 0.07, b.z); if (now > FISHING.biteEnd) { FISHING.st = 'idle'; FISHING.bob.visible = false; setCast('🎣 Lempar Kail'); W.toast('🐟 Ikannya kabur… tarik lebih cepat saat pelampung tenggelam!'); } }
    if (FISHING.st === 'reel') { FISHING.mk += FISHING.dir * FISHING.spd * dt; if (FISHING.mk > 1) { FISHING.mk = 1; FISHING.dir = -1; } if (FISHING.mk < 0) { FISHING.mk = 0; FISHING.dir = 1; } $('gMk').style.left = `calc(${FISHING.mk * 100}% - 3px)`;
      FISHING.bob.position.set(b.x + Math.sin(t * 25) * 0.05, wy - 0.05, b.z + Math.cos(t * 19) * 0.05); m.arms[1].rotation.set(-1.3 + Math.sin(t * 20) * 0.1, 0, 0.15); }
    FISHING.line.visible = FISHING.bob.visible;
    if (FISHING.line.visible) { const a = FISHING.rod.userData.tip.getWorldPosition(V(0, 0, 0)); const pts = FISHING.line.geometry.attributes.position; pts.setXYZ(0, a.x, a.y, a.z); const q = FISHING.bob.position; pts.setXYZ(1, q.x, q.y + 0.08, q.z); pts.needsUpdate = true; }
  }
  $('gHelpW').onclick = () => nearFarm && helpFarm(nearFarm.u, 'water'); $('gHelpF').onclick = () => nearFarm && helpFarm(nearFarm.u, 'feed'); $('gHelpBack').onclick = () => enterGame();
  $('gWx').onclick = () => { const dk = dayKey(Date.now()), w = weatherOf(dk), pr = pricesToday(dk); const up = Object.entries(pr).filter(([k, m]) => m > 1).map(([k]) => ITEMS[k].e + ' ' + ITEMS[k].n).join(', '); W.toast(`${w.e} ${w.n} · ${w.season}. ${w.tip} Harga naik hari ini: ${up}.`); };
  $('gCloB').onclick = () => openCloset(); $('gClosetTabs').querySelectorAll('button').forEach(b => b.onclick = () => openCloset(b.dataset.k));
  $('gFishB').onclick = startFishing; $('gFishBack').onclick = stopFishing; $('gCast').onclick = onCast; $('gPull').onclick = onPull; $('gFishBag').onclick = () => openBag();

  // ---------------- chat ----------------
  const CHAT = { last: 0, msgs: [], unread: 0, online: [], bubbles: new Map() };
  const BAD = ['anjing','anjir','anjg','babi','bangsat','bajingan','kontol','memek','ngentot','entot','jancok','jancuk','goblok','goblog','tolol','kampret','asu','pepek','perek','lonte','tai','bego','idiot','sialan','brengsek','keparat'];
  const clean = t => { let r = t.replace(/(https?:\/\/\S+|www\.\S+|\S+\.(com|net|id|co|xyz|ly|me|io|org)(\/\S*)?)/gi, '[link dihapus]'); BAD.forEach(w => r = r.replace(new RegExp('\\b' + w + '\\b', 'gi'), '*'.repeat(w.length))); return r; };
  const esc = t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hhmm = iso => { const d = new Date(Date.parse(iso) + WIB); return d.toISOString().slice(11, 16); };
  const DAILY_Q = ['Besok pulau kita bangun apa ya? 🏗️', 'Tanaman favoritmu di Kebunku apa? 🌽', 'Mau event apa minggu depan? 🎉', 'Kalau punya peliharaan, mau dikasih nama apa? 🐱',
    'Baju apa yang harus ada di butik? 👗', 'Ikan apa yang paling susah kamu dapat? 🎣', 'Profesi apa yang belum ada di pulau? 👷', 'Hewan ternak apa lagi yang perlu ditambah? 🐄',
    'Fitur apa yang bikin Kebunku makin seru? 💡', 'Tempat wisata apa yang cocok di Pulau Netizen? 🏖️'];
  function dailyQ() { const d = Math.floor((Date.now() + WIB) / 864e5); return DAILY_Q[d % DAILY_Q.length]; }
  function panenRaya(ts = Date.now()) { const wd = new Date(ts + WIB).getUTCDay(); return wd === 6 || wd === 0; }
  // ---- Bang Tanjung: balasan otomatis (dihitung sama di semua HP, tidak disimpan ke server) ----
  const BT_RULES = [
    [/\b(bug|error|eror|gak bisa|ga bisa|gk bisa|tidak bisa|ngga bisa|nggak bisa|macet|ngelag|lag|hilang|ilang)\b/i, [
      u => `Waduh, maaf ya @${u} 🙏 Bang Tanjung catat masalahnya. Coba tutup lalu buka lagi halamannya dulu ya.`,
      u => `Siap @${u}, laporannya Bang Tanjung terima 📝 Nanti dibenerin. Sementara coba muat ulang halamannya ya.`]],
    [/(jadi warga|jd warga|ijin warga|izin warga|ikut gabung|mau gabung|join)/i, [
      u => `Selamat datang @${u}! 🏝️ Kamu sudah resmi jadi warga Pulau Netizen. Semoga kebunnya subur ya 🌱`,
      u => `Wah, warga baru! Halo @${u} 👋 Selamat bergabung di Pulau Netizen, jangan lupa tanam benih pertamamu 🌱`]],
    [/(terima ?kasih|makasih|makasi|thanks|thank you|tengkyu|trims)/i, [
      u => `Sama-sama @${u}! 🙏 Bang Tanjung senang kamu main di sini.`,
      u => `Sama-sama ya @${u} 😄 Semangat berkebunnya!`]],
    [/(sehat|semangat|sukses|mantap|keren|bagus|seru)/i, [
      u => `Aamiin, makasih @${u}! 💪 Kamu juga sehat & semangat selalu ya.`,
      u => `Hehe makasih @${u} 😄 Bang Tanjung jadi tambah semangat bangun pulau!`]],
    [/(saran|usul|ide|tambah|tambahin|bikin|bikinin|buatin|buat|bangun|request|minta)/i, [
      u => `Ide bagus @${u}! 📝 Bang Tanjung catat ya. Usulan paling rame bisa dibangun di video Pulau Netizen berikutnya 🎬`,
      u => `Siap, dicatat @${u}! ✍️ Ajak warga lain dukung idemu biar cepat dibangun 😄`]],
    [/(info|update|kabar|ada apa|event|hadiah)/i, [
      u => `Info dari Bang Tanjung buat @${u}: ${panenRaya() ? 'akhir pekan ini ada EVENT PANEN RAYA, harga jual hasil panen 2x lipat! 🎉 ' : ''}Sampai Level 5 dapat hadiah peliharaan, kucing oren rekomendasi saya 🐱`,
      u => `Halo @${u}! Kabar terbaru: ${panenRaya() ? 'Panen Raya lagi jalan, jual hasil panen dapat 2x koin 🎉 ' : 'tiap Sabtu–Minggu ada Panen Raya, harga jual 2x 🎉 '}Cek juga misi mingguan, hadiahnya lumayan 🎯`]],
    [/\b(halo|hallo|hai|hay|hi|hello|pagi|siang|sore|malam|malem|assalam|permisi|p+)\b|tanjung/i, [
      u => `Halo @${u}! 👋 Bang Tanjung di sini. Selamat ${partOfDay()}, selamat berkebun ya 🌱`,
      u => `Hai @${u}! 😄 Selamat ${partOfDay()} dari Bang Tanjung. Sudah siram tanaman hari ini? 💧`]],
  ];
  function partOfDay(ts = Date.now()) { const h = new Date(ts + WIB).getUTCHours(); return h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'; }
  function btReply(m, last) {
    if (!m || m.username === 'bang.tanjung' || m.username === 'barunaadi') return null;
    const t = Date.parse(m.created_at) || 0; if (last[m.username] && t - last[m.username] < 30 * 60e3) return null; // maks 1 balasan / 30 menit / warga
    for (const [re, outs] of BT_RULES) if (re.test(m.msg || '')) { last[m.username] = t; return outs[(m.id || 0) % outs.length](esc(m.username)); }
    return null;
  }
  function renderChat() {
    const el = $('gChatList'), atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    const pr = panenRaya() ? `<br>🎉 <b style="display:inline;color:#b45309">EVENT PANEN RAYA</b> hari ini: harga jual semua hasil panen <b style="display:inline">2x lipat</b>! Jual di 🎒 Tas.` : '';
    el.innerHTML = `<div class="gmsg sys"><p>👋 Obrolan untuk semua pemain Kebunku. Jaga sopan santun ya. Pesan kasar & link otomatis disaring.</p></div>` +
      (Date.now() < Date.parse('2026-11-12T00:00:00+07:00') ? `<div class="gmsg bt"><b>@bang.tanjung</b><i>pengumuman</i><p>📢 Terima kasih laporannya @febrian_aang! 🙏 Bug Kandang Sedang yang bisa terbeli dua kali sudah dibenerin. Kandang yang sudah dimiliki sekarang tidak bisa dibeli lagi, dan di 🏪 Toko sekarang kelihatan stok benih, pakan & umpan yang kamu punya. Koin 900 sudah Bang Tanjung kembalikan, masuk otomatis saat login berikutnya 🪙</p></div>` : '') +
      `<div class="gmsg pin"><b>📌 @bang.tanjung</b><p>Halo${ME ? ' @' + esc(ME.u) : ''}! Pertanyaan Bang Tanjung hari ini:<br><b style="display:inline">${esc(dailyQ())}</b><br>Jawab di chat ya, jawaban terbanyak bisa masuk video Pulau Netizen 🎬${pr}</p></div>` +
      (() => { const last = {}; return CHAT.msgs.map(m => { const r = btReply(m, last);
        return `<div class="gmsg ${ME && m.username === ME.u ? 'me' : ''} ${m.username === 'bang.tanjung' ? 'bt' : ''}"><b>@${esc(m.username)}</b><i>${hhmm(m.created_at)}</i><p>${esc(m.msg)}</p></div>` +
          (r ? `<div class="gmsg bt"><b>@bang.tanjung</b><i>balasan otomatis</i><p>${r}</p></div>` : ''); }).join(''); })();
    if (atBottom || CHAT.forceScroll) { el.scrollTop = el.scrollHeight; CHAT.forceScroll = false; }
    $('gOnline').textContent = `🟢 ${CHAT.online.length} online`;
  }
  function chatBubble(u, text) {
    const e = W.ENT.find(x => x.u === u); if (!e) return;
    const old = CHAT.bubbles.get(u); if (old) { scene.remove(old.s); old.s.material.map.dispose(); }
    const short = text.length > 42 ? text.slice(0, 40) + '…' : text;
    const tex = canvasTex(1024, 160, (x, w, h) => { x.font = '600 52px Poppins'; const tw = Math.min(w - 20, x.measureText(short).width + 60);
      x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect((w - tw) / 2, 10, tw, 110, 40); x.fill(); x.beginPath(); x.moveTo(w / 2 - 18, 118); x.lineTo(w / 2, 150); x.lineTo(w / 2 + 18, 118); x.fill();
      x.fillStyle = '#14181f'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(short, w / 2, 66); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(2.6, 0.41, 1); sp.renderOrder = 12; scene.add(sp);
    CHAT.bubbles.set(u, { s: sp, e, until: performance.now() + 7000 });
  }
  let chatBusy = false;
  async function pollChat() {
    if (chatBusy || !ME) return; chatBusy = true;
    try {
      const r = await api.rpc('chat_list', { p_since: CHAT.last });
      if (r && r.msgs) {
        const fresh = r.msgs.filter(m => m.id > CHAT.last);
        if (fresh.length) {
          const first = CHAT.last === 0; CHAT.last = fresh[fresh.length - 1].id; CHAT.msgs = [...CHAT.msgs, ...fresh].slice(-80);
          if (!first) fresh.forEach(m => { chatBubble(m.username, m.msg); if (m.username !== ME.u && !$('gP_chat').classList.contains('on')) CHAT.unread++; });
        }
        CHAT.online = r.online || [];
        $('gChatDot').style.display = CHAT.unread ? 'inline-block' : 'none'; $('gChatDot').textContent = CHAT.unread > 9 ? '9+' : CHAT.unread || '';
        if ($('gP_chat').classList.contains('on')) renderChat();
      }
    } catch (e) {}
    chatBusy = false;
  }
  setInterval(() => { if (ME) pollChat(); }, 4000);
  setInterval(() => { if (ME) api.rpc('farm_ping', { p_user: ME.u, p_pin: ME.p }).catch(() => {}); }, 60000);
  async function sendChat() {
    const v = $('gMsg').value.trim(); if (!v || !ME) return;
    $('gSend').disabled = true;
    try { const r = await api.rpc('chat_send', { p_user: ME.u, p_pin: ME.p, p_msg: clean(v).slice(0, 140) }); if (!r.ok) W.toast(r.err || 'Gagal mengirim'); else { $('gMsg').value = ''; CHAT.forceScroll = true; await pollChat(); } }
    catch (e) { W.toast('Tidak bisa terhubung, coba lagi.'); }
    $('gSend').disabled = false;
  }
  $('gChatB').onclick = () => { openP('gP_chat'); CHAT.unread = 0; $('gChatDot').style.display = 'none'; CHAT.forceScroll = true; renderChat(); pollChat(); setTimeout(() => $('gMsg').focus(), 300); };
  $('gSend').onclick = sendChat; $('gMsg').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  const bubbleTick = now => { for (const [u, b] of CHAT.bubbles) { if (now > b.until) { scene.remove(b.s); b.s.material.map.dispose(); CHAT.bubbles.delete(u); continue; } b.s.position.copy(b.e.m.root.position).add(V(0, 2.5, 0)); } };

  // ---------------- input ----------------
  const ray = new THREE.Raycaster(); let pd = null;
  addEventListener('pointerdown', e => { pd = [e.clientX, e.clientY]; }, true);
  addEventListener('pointerup', e => {
    if (document.body.classList.contains('fishing') && e.target === renderer.domElement) { e.stopPropagation(); return; }
    if (!document.body.classList.contains('game') || !ME || e.target !== renderer.domElement) return;
    if (!pd || Math.hypot(e.clientX - pd[0], e.clientY - pd[1]) > 8) return;
    ray.setFromCamera(V((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1, 0), camera);
    const objs = [...ME.v.tiles.map(T => T.m).filter(m => m.visible), ...ME.v.tiles.map(T => T.crop).filter(Boolean), ...ME.v.animals.map(a => a.g), ...(ME.v.pet ? [ME.v.pet.g] : [])];
    const h = ray.intersectObjects(objs, true)[0]; if (!h) return;
    e.stopPropagation();
    let o = h.object; while (o && !o.userData.farmTile && !o.userData.farmAnimal && o !== ME.v.root) o = o.parent;
    if (h.object.userData.farmPet) tapPet();
    else if (o && o.userData.farmTile) tapTile(o.userData.farmTile.i);
    else if (h.object.userData.farmAnimal) tapAnimal(h.object.userData.farmAnimal.j);
    else { const T = ME.v.tiles.findIndex(T => T.crop && (T.crop === h.object || T.crop.getObjectById(h.object.id))); if (T >= 0) tapTile(T); }
  }, true);

  // ---------------- per-frame ----------------
  let lastSlow = 0;
  window.__gameTick = (t, dt, now) => {
    animateFarms(t, dt || 0.016);
    fishTick(t, dt || 0.016, now); bubbleTick(now); rainTick(t); wingTick(t); if (!window.__nearT || now - window.__nearT > 400) { window.__nearT = now; updateNear(); }
    if (ME && ME.ent.sim.manual && FISHING.st === 'off') {
      const m = ME.ent.m, w = ME.walk;
      if (w) { const k = Math.min(1, (now - w.t0) / w.d); m.root.position.lerpVectors(w.from, w.to, k); m.root.rotation.y = Math.atan2(w.to.x - w.from.x, w.to.z - w.from.z) || m.root.rotation.y;
        if (k < 1) vPose(m, { t, walk: k * 12 }); else { m.root.rotation.y = Math.atan2(w.look.x - m.root.position.x, w.look.z - m.root.position.z); vPose(m, { t: t * 1.6, hammer: 1 }); if ((now - w.t0) > w.d + w.work * 1000) ME.walk = null; } }
      else vPose(m, { t });
    }
    if (ME && now - lastSlow > 30000) { lastSlow = now; tickState(ME.s, Date.now()); renderFarm(ME.v, ME.s, Date.now()); updateHUD(); }
  };
  window.__game = { btReply, panenRaya, dailyQ, openPetPicker, tapPet, PETS, petMesh, openCloset, eventItems, OUTFITS, weatherOf, pricesToday, ordersToday, grGoal, grGive, helpFarm, fillOrder, renderAct, eventOf, applyCostume, sendChat, pollChat, CHAT, startFishing, onCast, onPull, FISHING, get me() { return ME; }, CROPS, ANIMALS, refreshList, FARMS, api, tapTile, tapAnimal, openShop, openMis, openBag, openRank, buy: id => buy(SHOP.find(x => x.id === id)), tickState };
}
