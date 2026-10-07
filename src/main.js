import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWorld, contactShadow } from './world.js';
import { createGuide } from './guide.js';
import { PROJECTS } from './projects.js';
import { timedMaterials } from './lib/shader.js';
import { createUI } from './ui.js';

// ---------------------------------------------------------------------------
// Layout of the hallway

const EYE = 1.65;
const START_Z = 9;          // where the visitor lands
const GUIDE_START_Z = 3.2;  // where Heidi greets them
const GUIDE_LEAD = 4.6;     // how far ahead of the visitor she walks
const FIRST_PORTAL_Z = -6;
const SPACING = 13;         // distance between portals along the hallway
const PORTAL_X = 5.8;
const PORTAL_SCALE = 0.72;
const STAND_OFFSET = 5.4;   // the visitor stops this far before a portal to look at it
const BLOOM_HALLWAY = { strength: 0.3, threshold: 0.97 };
const BLOOM_ROOM_THRESHOLD = 0.86;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Renderer, camera, post-processing

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 220);
camera.rotation.order = 'YXZ';

const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

try {
  await Promise.all([document.fonts.load('700 64px Syncopate'), document.fonts.load('600 32px Manrope')]);
} catch { /* fall back to system fonts on the labels */ }

const world = createWorld({ env });
const guide = createGuide();
guide.group.position.set(0, 0, GUIDE_START_Z);
world.scene.add(guide.group);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(world.scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_HALLWAY.strength, 0.5, BLOOM_HALLWAY.threshold);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Stations: one portal per project, alternating left (-x) and right (+x)

const stations = PROJECTS.map((project, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const z = FIRST_PORTAL_Z - i * SPACING;
  const portal = project.module.buildPortal({ year: project.year });
  portal.group.position.set(side * PORTAL_X, 0, z);
  portal.group.scale.setScalar(PORTAL_SCALE);
  portal.group.add(contactShadow(3.2, 0.2));
  // Angle each portal toward the visitor walking up the hallway.
  portal.group.rotation.y = side < 0 ? 0.95 : -0.95;
  world.scene.add(portal.group);
  portal.hitTargets.forEach((m) => { m.userData.station = i; });
  return { project, portal, side, z, standZ: z + STAND_OFFSET, room: null, hover: 0 };
});
// The studio environment is bright; keep plastic surfaces subtle in the dark hallway and let metals shine.
world.scene.traverse((o) => {
  const m = o.material;
  if (m && m.isMeshStandardMaterial && m.metalness < 0.5) m.envMapIntensity = Math.min(m.envMapIntensity, 0.4);
});
const hitTargets = stations.flatMap((s) => s.portal.hitTargets);
const Z_MIN = stations[stations.length - 1].standZ;

// ---------------------------------------------------------------------------
// State

const state = {
  mode: 'intro',        // intro | tour | transit | room
  camZ: START_Z,
  targetZ: START_Z,
  yaw: 0,
  pitch: -0.04,
  lookYaw: 0,          // how far the visitor has turned by dragging (radians, unbounded)
  lookPitch: 0,
  hovered: -1,
  walked: 0,
  station: -1,
  roomAngle: 0,
  dragging: false,
  speed: 0,
  bob: 0,
  guideYaw: 0,
  keys: new Set(),
  announced: -1,
};
let activeRoom = null;

const ui = createUI({
  projects: PROJECTS,
  onJump: (i) => jumpTo(i),
  onExitRoom: () => exitRoom(),
});

// ---------------------------------------------------------------------------
// Tweens (promise-based, advanced in the render loop)

const tweens = new Set();
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
function animate(dur, fn) {
  return new Promise((resolve) => tweens.add({ t: 0, dur: reducedMotion ? Math.min(dur, 0.2) : dur, fn, resolve }));
}
function stepTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    const k = Math.min(tw.t / tw.dur, 1);
    tw.fn(ease(k), k);
    if (k >= 1) { tweens.delete(tw); tw.resolve(); }
  }
}

// ---------------------------------------------------------------------------
// Actions

function startTour() {
  if (state.mode !== 'intro') return;
  state.mode = 'tour';
  state.targetZ = Math.min(state.targetZ, START_Z - 3);
}

function walkTo(z) {
  if (state.mode === 'intro') startTour();
  if (state.mode !== 'tour') return;
  state.targetZ = THREE.MathUtils.clamp(z, Z_MIN, START_Z);
}

async function jumpTo(i) {
  if (state.mode === 'transit') return;
  if (state.mode === 'room') await exitRoom();
  walkTo(stations[i].standZ);
}

async function enterStation(i) {
  const st = stations[i];
  if (state.mode === 'transit' || state.mode === 'room') return;
  if (st.project.locked || !st.project.module.buildRoom) {
    if (state.mode === 'intro') startTour();
    walkTo(st.standZ);
    state.announced = -1;
    return;
  }
  state.mode = 'transit';
  state.station = i;
  ui.say('transit', null);
  ui.setActive(i);
  ui.setRailEnabled(false);

  const g = st.portal.group;
  const center = g.localToWorld(new THREE.Vector3(0, st.portal.centerY, 0));
  const front = g.localToWorld(new THREE.Vector3(0, EYE / PORTAL_SCALE, 4.6));
  const inside = g.localToWorld(new THREE.Vector3(0, st.portal.centerY, -1.0));
  const guideFrom = guide.group.position.clone();
  const guideTo = g.localToWorld(new THREE.Vector3(0.9, 0, 0.6));
  const camFrom = camera.position.clone();
  const qFrom = camera.quaternion.clone();
  const aim = new THREE.PerspectiveCamera();
  aim.position.copy(front);
  aim.lookAt(center);
  const qTo = aim.quaternion.clone();
  const guideYawTo = Math.atan2(center.x - guideTo.x, center.z - guideTo.z);

  await animate(1.4, (k) => {
    camera.position.lerpVectors(camFrom, front, k);
    camera.quaternion.slerpQuaternions(qFrom, qTo, k);
    guide.group.position.lerpVectors(guideFrom, guideTo, k);
    state.guideYaw = lerpAngle(state.guideYaw, guideYawTo, k);
    state.speed = k < 1 ? 2 : 0;
  });

  ui.fadeTo(st.project.accent, 1);
  await animate(0.9, (k) => {
    camera.position.lerpVectors(front, inside, k * k);
    camera.fov = 62 + k * k * 30;
    camera.updateProjectionMatrix();
  });

  if (!st.room) st.room = st.project.module.buildRoom({ env });
  activeRoom = st.room;
  renderPass.scene = activeRoom.scene;
  bloom.strength = activeRoom.bloom ?? 0.5;
  bloom.threshold = BLOOM_ROOM_THRESHOLD;
  camera.fov = 62;
  camera.updateProjectionMatrix();
  state.roomAngle = 0;
  state.mode = 'room';
  placeRoomCamera(0);
  ui.showRoom(st.project);
  ui.setRailEnabled(true);
  ui.fadeTo(null, 0);
}

async function exitRoom() {
  if (state.mode !== 'room') return;
  const st = stations[state.station];
  state.mode = 'transit';
  ui.hideRoom();
  ui.fadeTo(st.project.accent, 1);
  await animate(0.8, () => {});

  activeRoom = null;
  renderPass.scene = world.scene;
  bloom.strength = BLOOM_HALLWAY.strength;
  bloom.threshold = BLOOM_HALLWAY.threshold;
  state.camZ = state.targetZ = st.standZ;
  state.lookYaw = state.lookPitch = 0;
  state.yaw = yawToward(st);
  state.guideYaw = 0;
  guide.group.position.set(-st.side * 1.4, 0, st.standZ - GUIDE_LEAD);
  state.announced = -1;
  state.mode = 'tour';
  ui.fadeTo(null, 0);
  canvas.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Input

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;

function setNdc(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}

canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0 };
  state.dragging = true;
  canvas.setPointerCapture(e.pointerId);
});

// Drag anywhere to look around (a full turn is about one and a half screen widths).
canvas.addEventListener('pointermove', (e) => {
  setNdc(e);
  if (state.dragging && down) {
    const dx = e.clientX - down.lastX;
    const dy = e.clientY - down.lastY;
    down.lastX = e.clientX;
    down.lastY = e.clientY;
    down.moved += Math.abs(dx) + Math.abs(dy);
    if (down.moved > 6) {
      canvas.style.cursor = 'grabbing';
      if (state.mode === 'room') {
        state.roomAngle -= dx * 0.006;
      } else if (state.mode === 'intro' || state.mode === 'tour') {
        state.lookYaw += dx * 0.0045;
        state.lookPitch = THREE.MathUtils.clamp(state.lookPitch + dy * 0.003, -0.55, 0.5);
      }
    }
    return;
  }
  if (state.mode === 'intro' || state.mode === 'tour') {
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    state.hovered = hit ? hit.object.userData.station : -1;
    canvas.style.cursor = state.hovered >= 0 ? 'pointer' : 'grab';
  } else {
    canvas.style.cursor = state.mode === 'room' ? 'grab' : 'default';
  }
});

canvas.addEventListener('pointerup', (e) => {
  state.dragging = false;
  canvas.style.cursor = 'grab';
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 8 || (state.mode !== 'intro' && state.mode !== 'tour')) return;
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const portalHit = raycaster.intersectObjects(hitTargets, false)[0];
  if (portalHit) { enterStation(portalHit.object.userData.station); return; }
  const floorHit = raycaster.intersectObject(world.floor, false)[0];
  if (floorHit) {
    // Clicking near a portal walks to its viewing spot; elsewhere walks to just short of the click.
    const near = stations.find((s) => Math.abs(floorHit.point.z - s.z) < 4 && Math.sign(floorHit.point.x) === s.side && Math.abs(floorHit.point.x) > 2.5);
    const ahead = Math.cos(state.yaw) >= 0 ? 2.2 : -2.2;
    walkTo(near ? near.standZ : floorHit.point.z + ahead);
  }
});

canvas.addEventListener('pointercancel', () => { state.dragging = false; down = null; });

window.addEventListener('wheel', (e) => {
  if (state.mode === 'room') return;
  if (state.mode === 'intro') startTour();
  if (state.mode === 'tour') state.targetZ = THREE.MathUtils.clamp(state.targetZ + e.deltaY * 0.008, Z_MIN, START_Z);
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
  const k = e.key.toLowerCase();
  if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) {
    state.keys.add(k);
    e.preventDefault();
  } else if (['w', 's', 'arrowup', 'arrowdown'].includes(k)) {
    if (state.mode === 'intro') startTour();
    state.keys.add(k);
    e.preventDefault();
  } else if (k === 'escape') {
    exitRoom();
  } else if ((k === 'enter' || k === ' ') && state.mode === 'tour') {
    const i = nearestStation().index;
    if (i >= 0) enterStation(i);
  }
});
window.addEventListener('keyup', (e) => state.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => state.keys.clear());

// ---------------------------------------------------------------------------
// Per-frame updates

function nearestStation() {
  let best = { index: -1, weight: 0 };
  stations.forEach((s, i) => {
    const w = 1 - Math.abs(state.camZ - s.standZ) / 4.5;
    if (w > best.weight) best = { index: i, weight: w };
  });
  return best;
}

function yawToward(st) {
  // Camera yaw that faces the portal from the middle of the hallway at camZ.
  const dx = st.side * PORTAL_X;
  const dz = st.z - state.camZ;
  return Math.atan2(-dx, -dz);
}

function lerpAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function updateHallway(dt, t) {
  const left = state.keys.has('a') || state.keys.has('arrowleft');
  const right = state.keys.has('d') || state.keys.has('arrowright');
  if (left !== right) state.lookYaw += (left ? 1.6 : -1.6) * dt;
  const fwd = state.keys.has('w') || state.keys.has('arrowup');
  const back = state.keys.has('s') || state.keys.has('arrowdown');
  if (state.mode === 'tour' && (fwd || back)) {
    state.targetZ = THREE.MathUtils.clamp(state.targetZ + (back ? 4 : -4) * dt, Z_MIN, START_Z);
  }

  // Walk toward the target at a capped speed.
  const prevZ = state.camZ;
  const v = THREE.MathUtils.clamp((state.targetZ - state.camZ) * 2.2, -4.5, 4.5);
  state.camZ += v * dt;
  state.walked += Math.abs(state.camZ - prevZ);
  state.speed = Math.abs(v);
  const moving = state.speed > 0.15;
  if (moving) state.bob += dt * state.speed * 2.4;

  // Look: pointer parallax, plus an automatic turn toward the portal you're standing at.
  const near = nearestStation();
  const st = near.index >= 0 ? stations[near.index] : null;
  const aspect = window.innerWidth / window.innerHeight;
  // Drag sets where you look; when you're facing roughly down the hallway, the view also eases toward the nearby portal.
  let yawTarget = state.lookYaw;
  const facingForward = Math.max(0, Math.cos(state.lookYaw));
  if (st && state.mode === 'tour' && !state.dragging) yawTarget += yawToward(st) * near.weight * facingForward * (aspect < 1 ? 1.0 : 0.6);
  const pitchTarget = -0.04 + state.lookPitch;
  state.yaw += (yawTarget - state.yaw) * Math.min(1, dt * (state.dragging ? 12 : 2.5));
  state.pitch += (pitchTarget - state.pitch) * Math.min(1, dt * (state.dragging ? 12 : 2.5));

  const bobY = reducedMotion ? 0 : Math.sin(state.bob * 2) * 0.025 * Math.min(1, state.speed);
  camera.position.set(0, EYE + bobY, state.camZ);
  camera.rotation.set(state.pitch, state.yaw, 0);

  // Heidi: waves in the intro, then walks ahead and turns to present each portal.
  const atStation = st && near.weight > 0.55 && !moving && state.mode === 'tour';
  let guideTarget;
  let guideYawTarget;
  let point = 0;
  if (state.mode === 'intro') {
    guideTarget = new THREE.Vector3(0, 0, GUIDE_START_Z);
    guideYawTarget = 0;
  } else {
    const gx = st && near.weight > 0.2 ? -st.side * 1.7 : 0.8;
    guideTarget = new THREE.Vector3(gx, 0, state.camZ - GUIDE_LEAD - (atStation ? 0.6 : 0));
    guideYawTarget = atStation ? 0 : Math.PI;
    if (atStation) point = st.side * Math.cos(state.guideYaw) > 0 ? 1 : -1;
  }
  const gp = guide.group.position;
  const gPrev = gp.clone();
  gp.lerp(guideTarget, Math.min(1, dt * 3));
  const guideSpeed = gPrev.distanceTo(gp) / Math.max(dt, 1e-4);
  state.guideYaw = lerpAngle(state.guideYaw, guideYawTarget, Math.min(1, dt * 5));
  guide.update(dt, t, { walking: guideSpeed > 0.25, speed: guideSpeed, waving: state.mode === 'intro', point });

  // Hover feedback on portals.
  stations.forEach((s, i) => {
    s.hover += ((state.hovered === i ? 1 : 0) - s.hover) * Math.min(1, dt * 8);
    s.portal.focus.scale.setScalar(1 + s.hover * 0.05);
  });

  // What Heidi says.
  if (state.mode === 'intro') {
    ui.say('intro', "Hi, I'm Heidi. Welcome to my corner of the universe. Want to take a tour with me?", [
      { label: 'Take the tour', primary: true, onClick: () => { startTour(); state.targetZ = START_Z - 4; } },
    ]);
  } else if (atStation) {
    const p = st.project;
    const actions = p.locked ? [] : [{ label: 'Step inside', primary: true, onClick: () => enterStation(near.index) }];
    ui.say(`station-${near.index}`, p.guideLine, actions);
    state.announced = near.index;
  } else if (state.announced < 0 && !moving) {
    ui.say('howto', 'Follow me. Click the floor ahead to walk, or scroll. My projects are the portals along the way.');
  } else {
    ui.say('quiet', null);
  }
  ui.setActive(st && near.weight > 0.3 ? near.index : -1);
}

function placeRoomCamera(dt) {
  const v = activeRoom.view;
  if (!state.dragging && !reducedMotion) state.roomAngle += dt * 0.07;
  camera.position.set(
    v.center.x + Math.sin(state.roomAngle) * v.radius,
    v.height,
    v.center.z + Math.cos(state.roomAngle) * v.radius,
  );
  camera.lookAt(v.center);
}

// ---------------------------------------------------------------------------
// Resize + loop

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  camera.aspect = w / h;
  // Keep the hallway readable on tall phone screens.
  camera.fov = w / h < 0.8 ? 72 : 62;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
const headScreen = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  for (const m of timedMaterials) m.uniforms.uTime.value = t;
  stepTweens(dt);

  if (state.mode === 'intro' || state.mode === 'tour') {
    updateHallway(dt, t);
  } else if (state.mode === 'transit' && !activeRoom) {
    guide.update(dt, t, { walking: state.speed > 0, speed: 2, waving: false, point: 0 });
  }
  guide.group.rotation.y = state.guideYaw;

  if (activeRoom) {
    if (state.mode === 'room') placeRoomCamera(dt);
    activeRoom.update(t, dt);
  } else {
    world.update(t, dt);
    stations.forEach((s) => s.portal.update(t, dt));
    headScreen.copy(guide.headWorld()).project(camera);
    // Only show what she says while she's on screen (you may have turned away).
    const onScreen = headScreen.z < 1 && Math.abs(headScreen.x) < 1.25;
    ui.setBubbleShown(onScreen);
    if (onScreen) {
      ui.placeBubble((headScreen.x * 0.5 + 0.5) * window.innerWidth, (-headScreen.y * 0.5 + 0.5) * window.innerHeight);
    }
  }

  composer.render(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(() => {
  frame();
  ui.ready();
  // Deep link: #2025 walks straight to that portal.
  const id = decodeURIComponent(location.hash.slice(1));
  const i = PROJECTS.findIndex((p) => p.id === id);
  if (i >= 0) { startTour(); state.targetZ = stations[i].standZ; }
});
