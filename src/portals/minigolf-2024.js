import * as THREE from 'three';
import { surfaceMaterial, glowMaterial } from '../lib/shader.js';
import { makeLabel, makeBoardTexture, FONTS } from '../lib/text.js';
import { mulberry32 } from '../world.js';

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

// ---------------------------------------------------------------------------
// The room: a sunny minigolf hole with a windmill, a food truck, and a trivia board.

export function buildRoom({ env }) {
  const scene = new THREE.Scene();
  const sky = new THREE.Color('#9fd6ff');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 16, 48);
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xe6f5ff, 0x3f6b2e, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
  sun.position.set(6, 10, 5);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    surfaceMaterial(/* glsl */ `
      vec2 w = vWorld.xz;
      float s = step(0.0, sin(w.x * 0.9 + w.y * 0.25));
      col = mix(vec3(0.05, 0.22, 0.04), vec3(0.08, 0.30, 0.06), s);
    `),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // The putting lane: felt, wooden rails, a cup and pin at the far end.
  const felt = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x2fb84a, roughness: 0.9 }));
  felt.position.set(0, 0.03, -1);
  scene.add(felt);
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6233, roughness: 0.7 });
  for (const [w, d, x, z] of [[0.18, 10.2, -1.29, -1], [0.18, 10.2, 1.29, -1], [2.76, 0.18, 0, -6.1], [2.76, 0.18, 0, 4.1]]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), wood);
    rail.position.set(x, 0.11, z);
    scene.add(rail);
  }
  const cup = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
  cup.rotation.x = -Math.PI / 2;
  cup.position.set(0, 0.065, -5);
  scene.add(cup);
  const flag = buildFlag();
  flag.position.set(0, 0, -5);
  scene.add(flag);
  const golfBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  golfBall.position.set(0.3, 0.15, 2.8);
  scene.add(golfBall);

  // Windmill obstacle.
  const mill = new THREE.Group();
  mill.position.set(0, 0, -1.2);
  scene.add(mill);
  const millBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 2.0, 6), new THREE.MeshStandardMaterial({ color: 0xfff4e6, roughness: 0.6 }));
  millBody.position.y = 1.0;
  mill.add(millBody);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 6), new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.5 }));
  roof.position.y = 2.4;
  mill.add(roof);
  const blades = new THREE.Group();
  blades.position.set(0, 1.75, 0.75);
  mill.add(blades);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.03), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
    b.position.y = 0.8;
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(b);
    blades.add(arm);
  }

  const truck = buildFoodTruck();
  truck.position.set(5.2, 0, -2.5);
  truck.rotation.y = -0.7;
  scene.add(truck);
  const truck2 = buildFoodTruck();
  truck2.position.set(6.4, 0, 1.2);
  truck2.rotation.y = -1.3;
  truck2.children[0].material = new THREE.MeshStandardMaterial({ color: 0x4ec5ff, roughness: 0.45 });
  scene.add(truck2);

  // Trivia board.
  const boardTex = makeBoardTexture([
    { text: 'TRIVIA', size: 110, font: FONTS.display, weight: 700, color: '#ffd84a' },
    { text: 'Round 1 · Question 1', size: 46, color: '#ffffff' },
    { text: 'This room is still being built.', size: 40, color: '#b9e7ff', gap: 8 },
    { text: 'Check back soon.', size: 40, color: '#b9e7ff', gap: 0 },
  ], { bg: '#163a6b', border: '#ffd84a' });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  board.position.set(-5, 2.2, -2.5);
  board.rotation.y = 0.6;
  scene.add(board);
  for (const dx of [-1.4, 1.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), wood);
    post.position.set(-5 + Math.cos(0.6) * dx, 1.1, -2.5 - Math.sin(0.6) * dx - 0.05);
    scene.add(post);
  }

  // A ring of low-poly trees.
  const rand = mulberry32(24);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.8, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: 0x6b4a2b });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.2;
    const r = 13 + rand() * 6;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), bark);
    trunk.position.y = 0.6;
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + rand() * 0.6, 0), leaf);
    top.position.y = 2.0;
    tree.add(trunk, top);
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(tree);
  }

  function update(t) {
    blades.rotation.z = -t * 0.8;
    flag.userData.cloth.rotation.y = Math.sin(t * 2.2) * 0.25;
  }

  return { scene, update, view: { center: new THREE.Vector3(0, 0.9, -1), radius: 9, height: 3.4 }, bloom: 0.12 };
}
