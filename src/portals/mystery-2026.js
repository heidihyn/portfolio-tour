import * as THREE from 'three';
import { surfaceMaterial, glowMaterial } from '../lib/shader.js';
import { buildTeleprompter } from './teleprompter-2026.js';

// 2026 · AI murder mystery / hacker immersive game + dance floor.
// Portal: a neon hexagon with falling code and a red pulse scan, a wireframe "AI core" overhead
// projecting a holographic teleprompter, and a light-up dance floor in front.

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

  const core = buildCore(0.45);
  core.position.set(0, CY + R + 0.65, 0);
  // The year and caption ride along the top of the teleprompter glass, in place of a floating label.
  const prompter = buildTeleprompter({ title: '2026', sub: 'AI MURDER MYSTERY · HACKER GAME · DANCE FLOOR' });
  const PROMPTER_Y = core.position.y + prompter.gap + prompter.height / 2;
  prompter.group.position.set(0, PROMPTER_Y, 0);
  group.add(prompter.group);
  group.add(core);

  const floor = buildDanceFloor(6, 5, 0.62);
  floor.position.set(0, 0, 2.0);
  group.add(floor);

  function update(t) {
    hex2.rotation.z = t * 0.25;
    hex.position.x = Math.random() < 0.02 ? (Math.random() - 0.5) * 0.06 : 0;
    core.userData.update(t);
    prompter.update(t);
    floor.userData.update(t);
  }

  return { group, focus, hitTargets: [surface], centerY: CY, update };
}
