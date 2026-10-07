import * as THREE from 'three';
import { contactShadow } from './world.js';

// Heidi: slim and petite, long pin-straight black hair with a side-swept fringe,
// navy V-neck sweater, navy column skirt, black flats. Faces +z by default.
// Arms can wave (right) and point (either side, in local space).

const SCALE = 0.9;

export function createGuide() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(SCALE);
  group.add(body);

  const mat = (color, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.4 });
  const skin = mat(0xf0d6c2, 0.55);
  const sweater = mat(0x25335f, 0.85);
  const skirt = mat(0x1a2343, 0.7);
  const hair = mat(0x0b0b0e, 0.32);
  const flats = mat(0x111114, 0.4);
  const eyes = mat(0x16161a, 0.3);

  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 16);
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = body) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const pivot = (x, y) => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    body.add(p);
    return p;
  };

  // Legs (bare calves below the skirt) and flats.
  const [legL, legR] = [0.068, -0.068].map((x) => {
    const p = pivot(x, 0.82);
    mesh(capsule(0.043, 0.7), skin, 0, -0.4, 0, p);
    const shoe = mesh(capsule(0.042, 0.14), flats, 0, -0.78, 0.04, p);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1.05, 1, 0.55);
    return p;
  });

  // Column skirt, waist to mid-calf.
  const skirtMesh = mesh(new THREE.CylinderGeometry(0.128, 0.15, 0.62, 28), skirt, 0, 0.67);
  skirtMesh.scale.z = 0.8;

  // Sweater torso with a V neckline.
  const torso = mesh(capsule(0.145, 0.32), sweater, 0, 1.18);
  torso.scale.set(1, 1, 0.7);
  const vShape = new THREE.Shape();
  vShape.moveTo(-0.065, 0); vShape.lineTo(0.065, 0); vShape.lineTo(0, -0.13); vShape.closePath();
  const vNeck = mesh(new THREE.ShapeGeometry(vShape), skin, 0, 1.445, 0.1);
  vNeck.rotation.x = -0.32;
  mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.1, 14), skin, 0, 1.5);

  // Arms in long sleeves, with hands.
  const [armL, armR] = [0.163, -0.163].map((x) => {
    const p = pivot(x, 1.42);
    mesh(capsule(0.037, 0.44), sweater, 0, -0.26, 0, p);
    mesh(new THREE.SphereGeometry(0.034, 14, 10), skin, 0, -0.52, 0, p);
    return p;
  });

  // Head, eyes, hair.
  const head = new THREE.Group();
  head.position.y = 1.63;
  body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.105, 32, 20), skin, 0, 0, 0, head);
  skull.scale.set(0.9, 1.1, 0.95);
  for (const x of [-0.034, 0.034]) {
    const e = mesh(new THREE.SphereGeometry(0.011, 10, 8), eyes, x, 0.012, 0.09, head);
    e.scale.set(1.3, 0.8, 0.6);
  }
  const cap = mesh(new THREE.SphereGeometry(0.112, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, 0, 0.012, -0.004, head);
  cap.scale.set(0.93, 1.1, 0.98);
  cap.rotation.x = -0.18;
  // Long straight curtain down the back and sides, to mid-back.
  const curtainMat = hair.clone();
  curtainMat.side = THREE.DoubleSide;
  const curtain = mesh(
    new THREE.CylinderGeometry(0.102, 0.125, 0.58, 32, 1, true, Math.PI / 2 - 0.35, Math.PI + 0.7),
    curtainMat, 0, -0.27, -0.005, head,
  );
  curtain.scale.z = 0.92;
  // Side-swept fringe.
  const fringe = mesh(new THREE.SphereGeometry(0.06, 20, 12), hair, 0.028, 0.06, 0.07, head);
  fringe.scale.set(1.45, 0.55, 0.5);
  fringe.rotation.z = 0.38;

  group.add(contactShadow(0.42, 0.32));

  let phase = 0;
  const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);

  /** state: { walking, speed, waving, point: -1 | 0 | 1 (local side) } */
  function update(dt, t, state) {
    if (state.walking) phase += dt * (5 + state.speed * 1.4);
    const swing = state.walking ? Math.sin(phase) : 0;
    legL.rotation.x = damp(legL.rotation.x, swing * 0.32, 12, dt);
    legR.rotation.x = damp(legR.rotation.x, -swing * 0.32, 12, dt);
    armL.rotation.x = damp(armL.rotation.x, state.point > 0 ? 0 : -swing * 0.4, 12, dt);
    armR.rotation.x = damp(armR.rotation.x, state.point < 0 || state.waving ? 0 : swing * 0.4, 12, dt);

    let zL = 0.07, zR = -0.07;
    if (state.waving) zR = -2.55 + Math.sin(t * 7) * 0.28;
    if (state.point > 0) zL = 1.3 + Math.sin(t * 2) * 0.05;
    if (state.point < 0) zR = -1.3 - Math.sin(t * 2) * 0.05;
    armL.rotation.z = damp(armL.rotation.z, zL, 7, dt);
    armR.rotation.z = damp(armR.rotation.z, zR, 7, dt);

    body.position.y = state.walking ? Math.abs(Math.cos(phase)) * 0.025 : Math.sin(t * 1.6) * 0.005;
    head.rotation.z = state.waving ? Math.sin(t * 1.8) * 0.07 : damp(head.rotation.z, 0, 4, dt);
  }

  const tmp = new THREE.Vector3();
  function headWorld() {
    return group.localToWorld(tmp.set(0, 1.85 * SCALE, 0));
  }

  return { group, update, headWorld };
}
