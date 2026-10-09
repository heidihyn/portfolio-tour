import * as THREE from 'three';
import { surfaceMaterial, glowMaterial } from '../lib/shader.js';
import { makeLabel, makeBoardTexture, FONTS } from '../lib/text.js';

// 2024 · Minigolf + trivia + food trucks.
// Portal: a golf-ball ring around a mown-fairway vortex with the cup glowing at the center,
// a pin flag, orbiting golf balls, floating trivia question marks, and a little food truck.

const CORAL = 0xff5a4e;
const SUN = 0xffcf3f;
const R = 1.5;
const CY = 1.95;

export function buildPortal() {
  const group = new THREE.Group();
  const focus = new THREE.Group();
  focus.position.y = CY;
  group.add(focus);

  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(R, 72),
    surfaceMaterial(/* glsl */ `
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0;
      float a = atan(p.y, p.x);
      float stripes = step(0.0, sin((p.x * 0.6 + p.y) * 24.0));
      vec3 grass = mix(vec3(0.02, 0.20, 0.05), vec3(0.06, 0.36, 0.09), stripes);
      float swirl = 0.5 + 0.5 * sin(a * 5.0 - r * 10.0 + uTime * 1.8);
      col = mix(grass, vec3(0.45, 0.85, 0.12), swirl * 0.4 * (1.0 - r));
      float cup = smoothstep(0.3, 0.12, r);
      col = mix(col, vec3(1.6, 1.1, 0.35), cup * (0.8 + 0.2 * sin(uTime * 3.0)));
      col += vec3(0.8, 1.0, 0.4) * smoothstep(0.82, 1.0, r) * 0.7;
    `),
  );
  focus.add(surface);

  const ball = new THREE.MeshStandardMaterial({ color: 0xe8e8de, roughness: 0.4, emissive: 0x111108 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.07, 0.12, 20, 120), ball);
  focus.add(ring);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(R + 0.28, 0.025, 8, 120), glowMaterial(0x7be06a, 2.2));
  focus.add(halo);

  const balls = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), ball);
    focus.add(b);
    balls.push(b);
  }

  // Putting green under the portal.
  const green = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 64),
    surfaceMaterial(/* glsl */ `
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0;
      float stripes = step(0.0, sin(p.x * 30.0));
      col = mix(vec3(0.02, 0.16, 0.04), vec3(0.04, 0.24, 0.06), stripes);
      col += vec3(0.5, 1.0, 0.3) * smoothstep(0.96, 1.0, r) * 0.8;
      alpha = smoothstep(1.0, 0.97, r);
    `, { transparent: true }),
  );
  green.rotation.x = -Math.PI / 2;
  green.position.y = 0.01;
  group.add(green);

  // Pin flag.
  const flag = buildFlag();
  flag.position.set(R + 0.75, 0, 0.35);
  group.add(flag);

  // Trivia question marks.
  const marks = [];
  for (let i = 0; i < 3; i++) {
    const m = makeLabel('?', { color: '#e8a400', height: 0.75 - i * 0.12 });
    group.add(m);
    marks.push(m);
  }

  const truck = buildFoodTruck();
  truck.position.set(-(R + 1.4), 0, 0.9);
  truck.rotation.y = 0.5;
  truck.scale.setScalar(0.8);
  group.add(truck);

  const label = makeLabel('2024', { sub: 'BIRTHDAY · MINIGOLF · TRIVIA · FOOD TRUCKS', color: '#23733a', subColor: '#4d6b52' });
  label.position.set(0, CY + R + 0.75, 0);
  group.add(label);

  function update(t) {
    balls.forEach((b, i) => {
      const a = t * 0.5 + (i / balls.length) * Math.PI * 2;
      b.position.set(Math.cos(a) * (R + 0.42), Math.sin(a) * (R + 0.42), 0.12);
    });
    marks.forEach((m, i) => {
      const a = t * 0.35 + i * 2.1;
      m.position.set(Math.cos(a) * 2.3, CY + 0.6 + Math.sin(t * 0.9 + i) * 0.35 + i * 0.3, Math.sin(a) * 0.6);
    });
    flag.userData.cloth.rotation.y = Math.sin(t * 2.2) * 0.25;
  }

  return { group, focus, hitTargets: [surface], centerY: CY, update };
}

function buildFlag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }),
  );
  pole.position.y = 1.3;
  g.add(pole);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(0.75, -0.22); shape.lineTo(0, -0.44); shape.closePath();
  const cloth = new THREE.Mesh(new THREE.ShapeGeometry(shape), glowMaterial(CORAL, 1.3, { side: THREE.DoubleSide }));
  cloth.position.y = 2.58;
  g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}

/** A small food truck. Origin at ground level, facing +z (serving window on the +z side). */
export function buildFoodTruck() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: SUN, roughness: 0.45, metalness: 0.1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.6 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  box(1.7, 1.0, 0.9, paint, 0, 0.85, 0);           // body
  box(0.55, 0.7, 0.88, paint, 1.1, 0.7, 0);        // cab
  box(0.06, 0.32, 0.7, trim, 1.38, 0.86, 0);       // windshield
  box(1.0, 0.42, 0.04, glowMaterial(0xffb347, 1.6), -0.15, 0.95, 0.46); // serving window
  const awning = box(1.15, 0.05, 0.32, new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.5 }), -0.15, 1.22, 0.58);
  awning.rotation.x = 0.35;
  box(1.75, 0.06, 0.95, trim, 0, 0.33, 0);         // skirt
  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 18);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [x, z] of [[-0.55, 0.42], [0.95, 0.42], [-0.55, -0.42], [0.95, -0.42]]) {
    const w = new THREE.Mesh(wheelGeo, trim);
    w.position.set(x, 0.17, z);
    g.add(w);
  }
  const signTex = makeBoardTexture([{ text: 'EATS', size: 120, font: FONTS.display, weight: 700, color: '#1e1b2e', gap: 0 }], { w: 512, h: 160, bg: '#fff6dc' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(-0.15, 1.55, 0.2);
  g.add(sign);
  return g;
}
