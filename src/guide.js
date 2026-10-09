import * as THREE from 'three';
import { contactShadow } from './world.js';

// Heidi: a simple, stylized figure, slim and petite, with long straight black hair, a navy V-neck
// sweater, a navy maxi skirt that brushes the floor, and black flats. Every shape is smooth and
// closed, so she reads as one figurine rather than a pile of parts.
//
// Movement is kept small and soft: short steps hidden under the skirt, a gentle sway of the hips,
// arms that barely swing, hands resting together in front when she stands. Faces +z by default.

const SKIN = 0xe9c3ab;
const NAVY = 0x223058;
const NAVY_DEEP = 0x1a2546;
const HAIR = 0x0c0c10;

const SHOULDER_Y = 1.315;
const SHOULDER_X = 0.108;
const UPPER = 0.25;
const FORE = 0.23;

/** A smooth solid of revolution from [radius, y] pairs, closed at both ends. */
function lathe(points, segments = 40) {
  const pts = points.map(([r, y]) => new THREE.Vector2(r, y));
  const curve = new THREE.SplineCurve(pts);
  const smooth = curve.getPoints(points.length * 8).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  smooth[0].x = 0;
  smooth[smooth.length - 1].x = 0;
  return new THREE.LatheGeometry(smooth, segments);
}

export function createGuide() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const mat = (color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.35 });
  const skin = mat(SKIN, 0.6);
  const sweater = mat(NAVY, 0.9);
  const skirtMat = mat(NAVY_DEEP, 0.85);
  const hairMat = mat(HAIR, 0.45);
  const flats = mat(0x111114, 0.35);
  const dark = mat(0x1a1416, 0.4);

  const add = (geo, m, parent, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // Hips: the skirt and the sweater hang from here, so the sway moves them together.
  const hips = new THREE.Group();
  hips.position.y = 0.96;
  body.add(hips);

  // Maxi skirt, waist to floor: a slim column that flares just a little toward the hem.
  const skirt = add(lathe([
    [0.0, -0.935], [0.158, -0.93], [0.14, -0.82], [0.12, -0.58], [0.112, -0.32], [0.104, -0.14], [0.076, 0.0], [0.0, 0.02],
  ], 48), skirtMat, hips);
  skirt.scale.z = 0.82;

  // Flats peeking out under the hem.
  const feet = [0.05, -0.05].map((x) => {
    const f = new THREE.Group();
    f.position.set(x, 0, 0.02);
    body.add(f);
    const shoe = add(new THREE.SphereGeometry(0.045, 20, 12), flats, f, 0, 0.022, 0.06);
    shoe.scale.set(0.75, 0.45, 1.6);
    return f;
  });

  // Torso: a fitted sweater from the waist to the shoulders.
  const chest = new THREE.Group();
  chest.position.y = 0.0;
  hips.add(chest);
  const torso = add(lathe([
    [0.0, -0.02], [0.078, 0.0], [0.072, 0.06], [0.08, 0.16], [0.092, 0.25], [0.097, 0.31], [0.112, 0.345], [0.096, 0.38], [0.04, 0.4], [0.0, 0.405],
  ]), sweater, chest);
  torso.scale.z = 0.72;
  // V neckline: a sliver of skin set into the front of the sweater.
  const v = new THREE.Shape();
  v.moveTo(-0.032, 0); v.quadraticCurveTo(0, 0.004, 0.032, 0); v.lineTo(0, -0.085); v.closePath();
  const vNeck = add(new THREE.ShapeGeometry(v, 8), skin, chest, 0, 0.384, 0.055);
  vNeck.rotation.x = -0.62;

  // Neck and head.
  const neck = add(lathe([[0.0, 0.0], [0.026, 0.0], [0.023, 0.07], [0.024, 0.12], [0.0, 0.12]], 24), skin, chest, 0, 0.37);
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.008);
  head.scale.setScalar(0.9);
  chest.add(head);
  // An egg-shaped head with a gently tapered chin.
  const skull = add(lathe([
    [0.0, -0.105], [0.03, -0.1], [0.06, -0.075], [0.078, -0.035], [0.083, 0.01], [0.08, 0.055], [0.065, 0.09], [0.035, 0.11], [0.0, 0.115],
  ], 40), skin, head);
  skull.scale.z = 0.95;
  // Eyes: two soft dark almonds, slightly downcast for a calm expression.
  for (const x of [-0.029, 0.029]) {
    const e = add(new THREE.SphereGeometry(0.0105, 14, 10), dark, head, x, 0.005, 0.073);
    e.scale.set(1.35, 0.55, 0.5);
    e.rotation.z = x > 0 ? -0.12 : 0.12;
    e.userData.noOutline = true;
  }
  // A hint of lips.
  const lips = add(new THREE.SphereGeometry(0.012, 12, 8), mat(0xc98580, 0.5), head, 0, -0.058, 0.07);
  lips.scale.set(1.4, 0.38, 0.5);
  lips.userData.noOutline = true;

  // Hair: a smooth cap with a center part, and a long straight curtain down to the middle of the back.
  const hairSide = hairMat.clone();
  hairSide.side = THREE.DoubleSide;
  // The cap follows the skull's own outline, a few millimetres out, down to just above the brows.
  const capProfile = new THREE.SplineCurve([
    [0.088, 0.028], [0.09, 0.055], [0.077, 0.095], [0.05, 0.12], [0.02, 0.129], [0.0, 0.13],
  ].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(30);
  const cap = add(new THREE.LatheGeometry(capProfile, 48), hairSide, head);
  cap.scale.z = 0.97;
  const curtain = add(
    new THREE.CylinderGeometry(0.088, 0.112, 0.5, 40, 1, true, 1.25, Math.PI * 2 - 2.5),
    hairSide, head, 0, -0.22, -0.01,
  );
  curtain.scale.z = 0.86;
  // Two thin locks framing the face, falling in front of the shoulders.
  for (const s of [-1, 1]) {
    const lock = add(new THREE.CylinderGeometry(0.016, 0.022, 0.34, 12, 1, true), hairSide, head, s * 0.086, -0.15, 0.0);
    lock.scale.z = 0.5;
    lock.rotation.z = s * 0.06;
    lock.userData.noOutline = true;
  }

  // Arms: shoulder and elbow pivots. Rotation order YXZ lets a bent forearm turn inward.
  const arms = [1, -1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * SHOULDER_X, SHOULDER_Y - 0.96, 0);
    chest.add(shoulder);
    add(lathe([[0.0, 0.012], [0.025, -0.005], [0.021, -UPPER * 0.5], [0.018, -UPPER], [0.0, -UPPER - 0.015]], 20), sweater, shoulder);
    const elbow = new THREE.Group();
    elbow.position.y = -UPPER;
    elbow.rotation.order = 'YXZ';
    shoulder.add(elbow);
    add(lathe([[0.0, 0.015], [0.018, 0.0], [0.017, -FORE * 0.6], [0.0145, -FORE], [0.0, -FORE - 0.008]], 20), sweater, elbow);
    const hand = new THREE.Group();
    hand.position.y = -FORE - 0.01;
    elbow.add(hand);
    const palm = add(new THREE.SphereGeometry(0.019, 16, 12), skin, hand, 0, -0.03, 0);
    palm.scale.set(0.55, 1.7, 0.9);
    return { side, shoulder, elbow, hand };
  });
  const [armL, armR] = arms; // +x is her left
  // Hair shells are open surfaces; an ink outline would stand off them as flaps.
  for (const o of [cap, curtain]) o.userData.noOutline = true;

  group.add(contactShadow(0.36, 0.3));

  // Poses: [shoulder x, shoulder z (outward), elbow x (forward bend), elbow y (inward),
  //         hand z, elbow z (lifts the forearm out and up)].
  const POSE = {
    rest: [0.02, -0.08, -0.8, 0.5, 0.0, 0.0],    // hands resting together in front of the hips
    walk: [0.0, 0.1, -0.2, 0.0, 0.0, 0.0],       // arms soft at her sides
    wave: [-0.15, 0.4, -0.35, 0.0, 0.0, 2.3],    // forearm raised, hand beside her face
    point: [-0.5, 0.85, -0.25, 0.0, 0.5, 0.0],   // an open, presenting arm toward the portal
  };
  const N = POSE.rest.length;
  const cur = new Map(arms.map((a) => [a, [...POSE.rest]]));

  let phase = 0;
  let walkBlend = 0;
  const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);

  /** state: { walking, speed, waving, point: -1 | 0 | 1 (local side) } */
  function update(dt, t, state) {
    walkBlend = damp(walkBlend, state.walking ? 1 : 0, 5, dt);
    // Small, unhurried steps: cadence rises only a little with speed.
    if (state.walking) phase += dt * (5.2 + Math.min(state.speed, 3) * 0.6);
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const w = walkBlend;
    const breathe = Math.sin(t * 1.3);

    // Steps under the skirt.
    feet.forEach((f, i) => {
      const k = i === 0 ? s : -s;
      f.position.z = 0.02 + k * 0.09 * w;
      f.position.y = Math.max(0, -Math.cos(phase + (i ? Math.PI : 0))) * 0.025 * w;
    });

    // A light rise and fall, a gentle hip sway, and shoulders that answer it.
    body.position.y = Math.abs(c) * 0.008 * w + breathe * 0.002;
    hips.rotation.z = s * 0.035 * w + Math.sin(t * 0.6) * 0.01 * (1 - w);
    hips.rotation.y = s * 0.06 * w;
    chest.rotation.y = -s * 0.1 * w;
    chest.rotation.z = -s * 0.03 * w;
    skirt.rotation.x = s * 0.035 * w;
    skirt.scale.x = 1 + Math.abs(s) * 0.04 * w;
    head.rotation.z = -hips.rotation.z * 0.6 + (state.waving ? Math.sin(t * 1.5) * 0.06 : 0);
    head.rotation.x = 0.06 + breathe * 0.01;
    head.rotation.y = -chest.rotation.y * 0.8;

    for (const a of arms) {
      let pose = w > 0.5 ? POSE.walk : POSE.rest;
      if (state.waving && a === armR) pose = POSE.wave;
      if (state.point && state.point === a.side && !state.waving) pose = POSE.point;
      const p = cur.get(a);
      for (let k = 0; k < N; k++) p[k] = damp(p[k], pose[k], 4, dt);
      // Arms swing only a little, opposite to the steps.
      const swing = pose === POSE.walk ? -a.side * s * 0.12 * w : 0;
      a.shoulder.rotation.set(p[0] + swing, 0, a.side * p[1]);
      const sway = pose === POSE.wave ? Math.sin(t * 4.5) * 0.12 : 0;
      a.elbow.rotation.set(p[2] + (pose === POSE.walk ? -Math.max(0, a.side * s) * 0.12 * w : 0), -a.side * p[3], a.side * (p[5] + sway));
      a.hand.rotation.set(0, 0, a.side * p[4]);
      if (pose === POSE.wave) a.hand.rotation.z = Math.sin(t * 4.5 + 0.6) * 0.3;
    }
  }

  const tmp = new THREE.Vector3();
  function headWorld() {
    return head.getWorldPosition(tmp).add(new THREE.Vector3(0, 0.17, 0));
  }

  return { group, update, headWorld };
}
