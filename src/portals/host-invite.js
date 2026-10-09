import * as THREE from 'three';
import { surfaceMaterial, glowMaterial } from '../lib/shader.js';
import { makeLabel } from '../lib/text.js';
import { mulberry32 } from '../world.js';

// The end of the hallway · an invitation to have Heidi host your event.
// Portal: a tall ivory-and-champagne arch, like the top of an invitation card, with a slow pearly
// swirl inside, a gold wax seal at the keystone, a runner leading up to it, and confetti drifting down.

const W = 2.5;
const H = 3.4;
const SPRING = 0.2 + H - W / 2; // where the arch starts curving
const CY = 0.2 + H / 2;

function archShape(w, h, base = 0) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, base);
  s.lineTo(-r, base + h - r);
  s.absarc(0, base + h - r, r, Math.PI, 0, true);
  s.lineTo(r, base);
  s.closePath();
  return s;
}

export function buildPortal() {
  const group = new THREE.Group();
  const focus = new THREE.Group();
  focus.position.y = CY;
  group.add(focus);

  // The swirl inside the arch, in the arch's own outline.
  const geo = new THREE.ShapeGeometry(archShape(W, H, 0.2), 48);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, (pos.getY(i) - 0.2) / H);
  geo.translate(0, -CY, 0);
  const surface = new THREE.Mesh(
    geo,
    surfaceMaterial(/* glsl */ `
      vec2 p = vUv - vec2(0.5, 0.55);
      p.x *= ${(W / H).toFixed(3)};
      float r = length(p);
      float a = atan(p.y, p.x);
      float swirl = sin(a * 3.0 + r * 14.0 - uTime * 0.6) * 0.5 + 0.5;
      float sheen = sin(a * 5.0 - r * 9.0 + uTime * 0.4) * 0.5 + 0.5;
      vec3 ivory = vec3(0.97, 0.93, 0.86);
      vec3 blush = vec3(0.95, 0.78, 0.74);
      vec3 champagne = vec3(0.93, 0.80, 0.58);
      col = mix(ivory, blush, swirl * 0.55);
      col = mix(col, champagne, sheen * 0.35);
      col += vec3(0.08) * smoothstep(0.5, 0.0, r);
      col += (hash(gl_FragCoord.xy) - 0.5) / 160.0;
    `),
  );
  surface.position.z = 0.01;
  focus.add(surface);

  // Frame: an ivory band around the arch with a thin gold inner bead.
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf3ede2, roughness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b26a, metalness: 0.85, roughness: 0.3, emissive: 0x2a1c06 });
  const frameShape = archShape(W + 0.5, H + 0.25, 0);
  frameShape.holes.push(archShape(W, H, 0.2));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, curveSegments: 48 }), ivory);
  frame.position.z = -0.12;
  group.add(frame);
  const beadCurve = new THREE.CurvePath();
  beadCurve.add(new THREE.LineCurve3(new THREE.Vector3(-W / 2, 0.2, 0.13), new THREE.Vector3(-W / 2, SPRING, 0.13)));
  const arc = new THREE.EllipseCurve(0, SPRING, W / 2, W / 2, Math.PI, 0, true);
  beadCurve.add(new THREE.CatmullRomCurve3(arc.getPoints(40).map((v) => new THREE.Vector3(v.x, v.y, 0.13))));
  beadCurve.add(new THREE.LineCurve3(new THREE.Vector3(W / 2, SPRING, 0.13), new THREE.Vector3(W / 2, 0.2, 0.13)));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(beadCurve, 160, 0.035, 8, false), gold));

  // Wax seal at the keystone.
  const seal = new THREE.Group();
  seal.position.set(0, 0.2 + H + 0.02, 0.16);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.07, 40), new THREE.MeshStandardMaterial({ color: 0x9c2f3a, roughness: 0.45 }));
  wax.rotation.x = Math.PI / 2;
  seal.add(wax);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 40), gold);
  ring.position.z = 0.04;
  seal.add(ring);
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.07);
  heart.bezierCurveTo(-0.11, 0.0, -0.06, 0.1, 0, 0.04);
  heart.bezierCurveTo(0.06, 0.1, 0.11, 0.0, 0, -0.07);
  const heartMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.02, bevelEnabled: false }), gold);
  heartMesh.position.z = 0.035;
  seal.add(heartMesh);
  group.add(seal);

  // Two candles on stands, one each side.
  for (const s of [-1, 1]) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.1, 20), gold);
    stand.position.set(s * (W / 2 + 0.75), 0.55, 0.5);
    group.add(stand);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 20), ivory);
    candle.position.set(s * (W / 2 + 0.75), 1.3, 0.5);
    group.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), glowMaterial(0xffc46b, 2.6));
    flame.scale.y = 1.7;
    flame.position.set(s * (W / 2 + 0.75), 1.56, 0.5);
    group.add(flame);
  }

  // Runner leading up to the arch.
  const runner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 5),
    surfaceMaterial(/* glsl */ `
      float edge = smoothstep(0.42, 0.45, abs(vUv.x - 0.5));
      col = mix(vec3(0.95, 0.91, 0.85), vec3(0.85, 0.70, 0.45), edge);
      col *= 0.92 + 0.08 * smoothstep(0.0, 0.3, vUv.y);
    `),
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.012, 2.6);
  group.add(runner);

  // Confetti drifting down in front of the arch.
  const rand = mulberry32(48);
  const COUNT = 70;
  const colors = [0xe8b4b0, 0xd8b26a, 0xf7f1e6, 0xb9c6e4];
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), COUNT);
  const bits = [];
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    bits.push({ x: (rand() - 0.5) * (W + 1.8), y: rand() * (H + 1.2), z: 0.4 + rand() * 1.4, spin: 1 + rand() * 3, phase: rand() * 6.28, fall: 0.15 + rand() * 0.2 });
    confetti.setColorAt(i, c.set(colors[i % colors.length]));
  }
  group.add(confetti);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();

  const label = makeLabel('HOST', {
    sub: 'YOUR EVENT, BY HEIDI', color: '#f7f1e6', subColor: '#e3c588',
    plate: { fill: 'rgba(34, 31, 46, 0.92)', stroke: '#d8b26a' },
  });
  label.position.set(0, 0.2 + H + 1.0, 0);
  group.add(label);

  function update(t, dt) {
    for (let i = 0; i < COUNT; i++) {
      const b = bits[i];
      b.y -= b.fall * dt;
      if (b.y < 0.05) b.y = H + 1.2;
      v.set(b.x + Math.sin(t * 0.7 + b.phase) * 0.15, b.y, b.z);
      e.set(t * b.spin + b.phase, t * b.spin * 0.7, b.phase);
      confetti.setMatrixAt(i, m.compose(v, q.setFromEuler(e), one));
    }
    confetti.instanceMatrix.needsUpdate = true;
    seal.rotation.z = Math.sin(t * 0.8) * 0.05;
  }

  return { group, focus, hitTargets: [surface, frame], centerY: CY, update };
}
