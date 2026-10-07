import * as THREE from 'three';
import { surfaceMaterial, glowMaterial } from '../lib/shader.js';
import { makeLabel, makeBoardTexture, FONTS } from '../lib/text.js';

// 2026 · AI murder mystery / hacker immersive game + dance floor.
// Portal: a neon hexagon with falling code and a red pulse scan, a wireframe "AI core" overhead,
// and a light-up dance floor in front.

const R = 1.6;
const CY = 2.0;
const MAGENTA = 0xff2fa8;
const CYAN = 0x2ff3ff;

export const CODE_RAIN = /* glsl */ `
  vec2 p = vUv;
  float cols = 30.0;
  float cx = floor(p.x * cols);
  float speed = 0.25 + hash(cx) * 0.6;
  float y = fract(p.y + uTime * speed * 0.35 + hash(cx + 7.0) * 10.0);
  float cell = floor(p.y * cols * 1.3);
  float glyph = step(0.45, hash(vec2(cx, cell + floor(uTime * 5.0 * speed))));
  vec2 f = fract(vec2(p.x * cols, p.y * cols * 1.3));
  float box = step(0.18, f.x) * step(f.x, 0.82) * step(0.12, f.y) * step(f.y, 0.88);
  float trail = pow(y, 5.0);
  col = vec3(0.01, 0.0, 0.03) + vec3(0.1, 1.0, 0.75) * glyph * box * trail * 1.3;
  float band = step(0.965, hash(vec2(floor(p.y * 22.0), floor(uTime * 7.0))));
  col += vec3(1.2, 0.1, 0.55) * band * 0.7;
  col *= 0.85 + 0.15 * sin(p.y * 500.0);
`;

/** Per-tile color for dance floors: diagonal hue sweep plus a ripple from the middle. */
export function danceColor(i, j, cols, rows, t, out) {
  const dx = i - (cols - 1) / 2;
  const dz = j - (rows - 1) / 2;
  const d = Math.hypot(dx, dz);
  const ripple = 0.5 + 0.5 * Math.sin(d * 1.5 - t * 4);
  const hue = (((i + j) * 0.06 + t * 0.12) % 1 + 1) % 1;
  const beat = Math.floor(t * 2.5);
  const flash = ((i * 7 + j * 13 + beat * 5) % 11) === 0 ? 0.35 : 0;
  return out.setHSL(0.78 + hue * 0.45, 1, Math.min(0.75, 0.06 + 0.45 * ripple * ripple + flash));
}

function buildDanceFloor(cols, rows, size) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(size * 0.92, 0.05, size * 0.92),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    cols * rows,
  );
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  let k = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      m.makeTranslation((i - (cols - 1) / 2) * size, 0.025, (j - (rows - 1) / 2) * size);
      mesh.setMatrixAt(k, m);
      mesh.setColorAt(k, c.set(0x000000));
      k++;
    }
  }
  mesh.userData.update = (t) => {
    let n = 0;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) mesh.setColorAt(n++, danceColor(i, j, cols, rows, t, c));
    mesh.instanceColor.needsUpdate = true;
  };
  return mesh;
}

function buildCore(scale = 1) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55 * scale, 1),
    glowMaterial(CYAN, 1.8, { wireframe: true }),
  );
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 20, 14), glowMaterial(0xff2040, 2.5));
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.85 * scale, 0.012 * scale, 6, 80), glowMaterial(MAGENTA, 2));
  orbit.rotation.x = 1.2;
  g.add(shell, heart, orbit);
  g.userData.update = (t) => {
    shell.rotation.set(t * 0.4, t * 0.6, 0);
    orbit.rotation.z = t * 0.9;
    heart.scale.setScalar(1 + Math.pow(Math.max(0, Math.sin(t * 3.2)), 8) * 0.5);
  };
  return g;
}

export function buildPortal() {
  const group = new THREE.Group();
  const focus = new THREE.Group();
  focus.position.y = CY;
  group.add(focus);

  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(R, 6),
    surfaceMaterial(CODE_RAIN + /* glsl */ `
      vec2 c = vUv - 0.5;
      float r = length(c) * 2.0;
      col += vec3(1.3, 0.1, 0.2) * smoothstep(0.035, 0.0, abs(r - fract(uTime * 0.45))) * 0.9;
    `),
  );
  surface.rotation.z = Math.PI / 6;
  focus.add(surface);

  const hex = new THREE.Mesh(new THREE.TorusGeometry(R + 0.04, 0.07, 8, 6), glowMaterial(MAGENTA, 2.4));
  hex.rotation.z = Math.PI / 6;
  focus.add(hex);
  const hex2 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.36, 0.022, 6, 6), glowMaterial(CYAN, 2));
  focus.add(hex2);

  const core = buildCore(0.8);
  core.position.set(0, CY + R + 1.0, 0);
  group.add(core);

  const floor = buildDanceFloor(6, 5, 0.62);
  floor.position.set(0, 0, 2.0);
  group.add(floor);

  const label = makeLabel('2026', { sub: 'AI MURDER MYSTERY · HACKER GAME · DANCE FLOOR', color: '#c0187a', subColor: '#11808a' });
  label.position.set(0, CY + R + 2.2, 0);
  group.add(label);

  function update(t) {
    hex2.rotation.z = t * 0.25;
    hex.position.x = Math.random() < 0.02 ? (Math.random() - 0.5) * 0.06 : 0;
    core.userData.update(t);
    floor.userData.update(t);
  }

  return { group, focus, hitTargets: [surface], centerY: CY, update };
}

// ---------------------------------------------------------------------------
// The room: a dark club with a code wall, sweeping beams, a big AI core, and a full dance floor.

export function buildRoom({ env }) {
  const scene = new THREE.Scene();
  const dark = new THREE.Color('#040209');
  scene.background = dark;
  scene.fog = new THREE.FogExp2(dark, 0.055);
  scene.environment = env;
  scene.add(new THREE.AmbientLight(0x2a1640, 1.0));

  const floor = buildDanceFloor(12, 12, 0.9);
  scene.add(floor);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), surfaceMaterial(CODE_RAIN));
  wall.position.set(0, 3, -6.5);
  scene.add(wall);

  const core = buildCore(1.8);
  core.position.set(0, 3.6, -3.5);
  scene.add(core);

  // Light beams from the ceiling.
  const beams = [];
  const beamGeo = new THREE.ConeGeometry(1.2, 7, 32, 1, true);
  beamGeo.translate(0, -3.5, 0);
  [[-4, MAGENTA], [-1.5, CYAN], [1.5, MAGENTA], [4, CYAN]].forEach(([x, color], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 7, -1);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    pivot.add(beam);
    scene.add(pivot);
    beams.push({ pivot, phase: i * 1.3 });
  });

  // Case board.
  const caseTex = makeBoardTexture([
    { text: 'CASE FILE · 2026', size: 64, font: FONTS.display, weight: 700, color: '#ff4a8d' },
    { text: '> status: OPEN', size: 44, font: FONTS.mono, weight: 700, color: '#2ff3ff' },
    { text: '> this room is still being built_', size: 36, font: FONTS.mono, weight: 400, color: '#9ef9c9', gap: 0 },
  ], { bg: '#08040f', border: '#ff2fa8' });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshBasicMaterial({ map: caseTex }));
  board.position.set(-6, 2.2, -2);
  board.rotation.y = 0.9;
  scene.add(board);

  function update(t) {
    floor.userData.update(t);
    core.userData.update(t);
    beams.forEach(({ pivot, phase }) => {
      pivot.rotation.z = Math.sin(t * 0.7 + phase) * 0.45;
      pivot.rotation.x = Math.cos(t * 0.5 + phase) * 0.3;
    });
  }

  return { scene, update, view: { center: new THREE.Vector3(0, 1.4, -1), radius: 6.5, height: 2.3 }, bloom: 0.95 };
}
