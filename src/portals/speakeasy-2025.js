import * as THREE from 'three';
import { surfaceMaterial, glowMaterial } from '../lib/shader.js';
import { makeLabel } from '../lib/text.js';
import { mulberry32 } from '../world.js';

// 2025 · 1920s mafia + speakeasy.
// Portal: an art deco door in brass with a stepped crown and sunburst, an oxblood fan-pattern
// surface, a glowing peephole slot, a red rug, and champagne bubbles rising past the door.

const W = 2.2;
const H = 3.1;
const CY = 0.2 + H / 2;

export function brassMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xd9a64e, metalness: 0.9, roughness: 0.28, emissive: 0x2a1a05 });
}

/** A half sunburst fan, centered at its base. */
export function buildSunburst(mat, radius = 0.95, rays = 13) {
  const g = new THREE.Group();
  for (let i = 0; i < rays; i++) {
    const a = -Math.PI / 2 + (i / (rays - 1)) * Math.PI;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.045, radius, 0.04), mat);
    ray.position.set(Math.sin(a) * radius * 0.5, Math.cos(a) * radius * 0.5, 0);
    ray.rotation.z = -a;
    g.add(ray);
  }
  const hub = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.32, 32, 0, Math.PI), mat);
  hub.position.z = 0.03;
  g.add(hub);
  return g;
}

export function buildPortal() {
  const group = new THREE.Group();
  const focus = new THREE.Group();
  focus.position.y = CY;
  group.add(focus);

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    surfaceMaterial(/* glsl */ `
      vec2 p = vUv;
      vec2 c = (p - vec2(0.5, 0.02)) * vec2(1.0, 0.72);
      float a = atan(c.x, c.y);
      float r = length(c);
      vec3 base = mix(vec3(0.05, 0.004, 0.01), vec3(0.22, 0.015, 0.035), p.y);
      float rays = smoothstep(0.93, 1.0, abs(sin(a * 13.0)));
      float arcs = smoothstep(0.95, 1.0, abs(sin(r * 20.0 - uTime * 0.9)));
      vec3 gold = vec3(1.0, 0.62, 0.22);
      col = base + gold * (rays * 0.28 + arcs * 0.22) * (1.0 - p.y * 0.5);
      float smoke = sin(p.x * 8.0 + uTime * 0.5 + sin(p.y * 5.0 + uTime * 0.3) * 2.0) * sin(p.y * 6.0 - uTime * 0.4);
      col += vec3(0.30, 0.10, 0.06) * smoothstep(0.3, 1.0, smoke) * 0.5;
      float inset = step(abs(p.x - 0.5), 0.455) * step(abs(p.y - 0.5), 0.47);
      float inset2 = step(abs(p.x - 0.5), 0.44) * step(abs(p.y - 0.5), 0.46);
      col = mix(gold * 0.9, col, mix(1.0, inset2, inset));
    `),
  );
  focus.add(surface);

  const brass = brassMaterial();
  const add = (geo, x, y, z = 0, parent = group) => {
    const m = new THREE.Mesh(geo, brass);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // Pillars with fluting.
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.26, H + 0.4, 0.34), s * (W / 2 + 0.13), (H + 0.4) / 2);
    for (let k = -1; k <= 1; k++) add(new THREE.BoxGeometry(0.03, H, 0.04), s * (W / 2 + 0.13) + k * 0.07, 0.2 + H / 2, 0.18);
  }
  // Stepped crown.
  const top = 0.2 + H;
  add(new THREE.BoxGeometry(W + 0.9, 0.18, 0.4), 0, top + 0.2);
  add(new THREE.BoxGeometry(W + 0.4, 0.18, 0.36), 0, top + 0.38);
  add(new THREE.BoxGeometry(W - 0.4, 0.18, 0.32), 0, top + 0.56);
  const burst = buildSunburst(brass);
  burst.position.set(0, top + 0.65, 0);
  group.add(burst);

  // Peephole slot and two sconces.
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.02), glowMaterial(0xffb45a, 2.5));
  slot.position.set(0, 0.55, 0.01);
  focus.add(slot);
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), glowMaterial(0xffc27a, 2.4));
    lamp.position.set(s * (W / 2 + 0.13), 2.75, 0.3);
    group.add(lamp);
  }

  // Rug.
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 3.2),
    surfaceMaterial(/* glsl */ `
      vec2 p = abs(vUv - 0.5);
      float edge = step(0.44, max(p.x, p.y)) * step(max(p.x, p.y), 0.47);
      col = mix(vec3(0.18, 0.01, 0.02), vec3(0.9, 0.55, 0.18), edge);
    `),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 1.7);
  group.add(rug);

  // Champagne bubbles.
  const COUNT = 90;
  const rand = mulberry32(25);
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rand() - 0.5) * 4;
    pos[i * 3 + 1] = rand() * 5;
    pos[i * 3 + 2] = 0.3 + rand() * 1.4;
  }
  const bubbleGeo = new THREE.BufferGeometry();
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const bubbles = new THREE.Points(bubbleGeo, new THREE.PointsMaterial({
    color: new THREE.Color(0xffd27a).multiplyScalar(1.8), size: 0.05, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  group.add(bubbles);

  const label = makeLabel('2025', { sub: '1920S MAFIA · SPEAKEASY', color: '#8a5418', subColor: '#8c6a45' });
  label.position.set(0, top + 1.75, 0);
  group.add(label);

  function update(t, dt) {
    const a = bubbleGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      a[i * 3 + 1] += dt * (0.3 + (i % 5) * 0.08);
      a[i * 3] += Math.sin(t * 2 + i) * dt * 0.05;
      if (a[i * 3 + 1] > 5) a[i * 3 + 1] = 0;
    }
    bubbleGeo.attributes.position.needsUpdate = true;
  }

  return { group, focus, hitTargets: [surface], centerY: CY, update };
}
