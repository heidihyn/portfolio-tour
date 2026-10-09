import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWorld, contactShadow } from './world.js';
import { createGuide } from './guide.js';
import { PROJECTS } from './projects.js';
import { timedMaterials } from './lib/shader.js';
import { addOutlines } from './lib/outline.js';
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
const END_GAP = 16;         // from the last side portal to the one across the end of the hallway
const END_STAND = 7.5;      // the visitor stops this far before the end portal

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Renderer, camera, post-processing

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const BASE_FOV = 68;
const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 220);
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

// Multisampled render target: post-processing otherwise turns off antialiasing and edges go jagged.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(world.scene, camera));
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Stations: one portal per project, alternating left (-x) and right (+x), and the end portal
// across the far end of the hallway (side 0).

const stations = PROJECTS.map((project, i) => {
  const side = project.end ? 0 : i % 2 === 0 ? -1 : 1;
  const z = project.end ? FIRST_PORTAL_Z - (i - 1) * SPACING - END_GAP : FIRST_PORTAL_Z - i * SPACING;
  const portal = project.module.buildPortal({ year: project.year });
  // Clicks land on a generous invisible box around the whole portal (frame included, either side),
  // not just its inner surface, so a click anywhere on the portal counts. Measured before the
  // group is placed, so the box sits in the portal's own frame. Labels, floor decor and parts
  // marked noHit (like the 2026 teleprompter) don't count.
  const box = new THREE.Box3();
  portal.group.updateMatrixWorld(true);
  portal.group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noHit) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.max.y > 0.4) box.union(b);
  });
  const size = box.getSize(new THREE.Vector3()).addScalar(0.4);
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, Math.max(size.z, 0.8)),
    new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
  );
  box.getCenter(hitBox.position);
  portal.group.add(hitBox);
  portal.hitTargets = [...portal.hitTargets, hitBox];
  portal.group.position.set(side * PORTAL_X, 0, z);
  portal.group.scale.setScalar(PORTAL_SCALE);
  portal.group.add(contactShadow(3.2, 0.2));
  // Angle each side portal toward the visitor walking up the hallway; the end one faces them.
  portal.group.rotation.y = side * -0.95;
  world.scene.add(portal.group);
  portal.hitTargets.forEach((m) => { m.userData.station = i; });
  return { project, portal, side, z, standZ: z + (project.end ? END_STAND : STAND_OFFSET), hover: 0 };
});
// The studio environment is bright; keep plastic surfaces subtle in the dark hallway and let metals shine.
world.scene.traverse((o) => {
  const m = o.material;
  if (m && m.isMeshStandardMaterial && m.metalness < 0.5) m.envMapIntensity = Math.min(m.envMapIntensity, 0.4);
});
addOutlines(world.scene);
const hitTargets = stations.flatMap((s) => s.portal.hitTargets);
const Z_MIN = stations[stations.length - 1].standZ;

// ---------------------------------------------------------------------------
// State

const state = {
  mode: 'intro',        // intro | tour | transit (stepping through a portal)
  camZ: START_Z,
  targetZ: START_Z,
  yaw: 0,
  pitch: -0.04,
  lookYaw: 0,          // how far the visitor has turned by dragging (radians, unbounded)
  lookPitch: 0,
  hovered: -1,
  walked: 0,
  dragging: false,
  speed: 0,
  bob: 0,
  guideYaw: 0,
  keys: new Set(),
  announced: -1,
};
// ?debug exposes internals for testing in the browser console.
if (new URLSearchParams(location.search).has('debug')) window.__tour = { THREE, camera, stations, hitTargets, state };

const ui = createUI({
  projects: PROJECTS,
  onJump: (i) => jumpTo(i),
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

function jumpTo(i) {
  if (state.mode === 'transit') return;
  walkTo(stations[i].standZ);
}

// Step through a portal: walk up to it, fly in, and open the project's own page.
async function enterStation(i) {
  const st = stations[i];
  if (state.mode === 'transit') return;
  if (!st.project.page) {
    if (state.mode === 'intro') startTour();
    walkTo(st.standZ);
    state.announced = -1;
    return;
  }
  state.mode = 'transit';
  // Coming back (browser back button) lands in front of this portal.
  history.replaceState(null, '', `#${encodeURIComponent(st.project.id)}`);
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
    camera.fov = BASE_FOV + k * k * 30;
    camera.updateProjectionMatrix();
  });
  location.href = new URL(st.project.page, document.baseURI).href;
}

/** Stand in front of portal i, facing it, as if you'd just walked up. */
function standAt(i) {
  const st = stations[i];
  state.camZ = state.targetZ = st.standZ;
  state.lookYaw = state.lookPitch = 0;
  state.yaw = yawToward(st);
  state.guideYaw = 0;
  state.walked = Math.max(state.walked, 6);
  guide.group.position.set(st.side ? -st.side * 1.4 : 1.6, 0, st.standZ - GUIDE_LEAD);
  state.announced = -1;
  state.mode = 'tour';
}

// Coming back from a project page with the browser's back button can restore this page exactly
// as it was left: mid-fade, inside the portal. Put the visitor back in the hallway.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  tweens.clear();
  const i = PROJECTS.findIndex((p) => p.id === decodeURIComponent(location.hash.slice(1)));
  standAt(Math.max(0, i));
  resize();
  ui.setRailEnabled(true);
  ui.fadeTo(null, 0);
});

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
      if (state.mode === 'intro' || state.mode === 'tour') {
        state.lookYaw += dx * 0.0045;
        if (e.pointerType === 'touch') {
          // Touch screens have no scroll wheel: swiping up walks forward, like scrolling a page.
          if (state.mode === 'intro') startTour();
          state.targetZ = THREE.MathUtils.clamp(state.targetZ + dy * 0.03, Z_MIN, START_Z);
        } else {
          state.lookPitch = THREE.MathUtils.clamp(state.lookPitch + dy * 0.003, -0.55, 0.5);
        }
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
    canvas.style.cursor = 'default';
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
  // Clicking only enters portals. Walking is by scrolling (or swiping on touch screens).
  const portalHit = raycaster.intersectObjects(hitTargets, false)[0];
  if (portalHit) enterStation(portalHit.object.userData.station);
});

canvas.addEventListener('pointercancel', () => { state.dragging = false; down = null; });

window.addEventListener('wheel', (e) => {
  if (state.mode === 'intro') startTour();
  if (state.mode === 'tour') state.targetZ = THREE.MathUtils.clamp(state.targetZ - e.deltaY * 0.01, Z_MIN, START_Z);
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
    // She stands on the far side of the path from a side portal, and off to the right of the end one.
    const gx = st && near.weight > 0.2 ? (st.side ? -st.side * 1.7 : 1.6) : 0.8;
    guideTarget = new THREE.Vector3(gx, 0, state.camZ - GUIDE_LEAD - (atStation ? 0.6 : 0));
    guideYawTarget = atStation ? 0 : Math.PI;
    if (atStation) point = st.side ? (st.side * Math.cos(state.guideYaw) > 0 ? 1 : -1) : -1;
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
    ui.say('intro', "Hi, I'm Heidi. Welcome to my corner of the universe. Scroll to take a tour with me.");
  } else if (atStation) {
    const p = st.project;
    const actions = p.page ? [{ label: p.end ? 'Step through' : 'Step inside', primary: true, onClick: () => enterStation(near.index) }] : [];
    ui.say(`station-${near.index}`, p.guideLine, actions);
    state.announced = near.index;
  } else if (state.announced < 0 && !moving) {
    ui.say('howto', 'Follow me. Keep scrolling to walk. My projects are the portals along the way.');
  } else {
    ui.say('quiet', null);
  }
  ui.setActive(st && near.weight > 0.3 ? near.index : -1);
  ui.showScrollCue(state.walked < 6);
}

// ---------------------------------------------------------------------------
// Resize + loop

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // Keep the hallway readable on tall phone screens.
  camera.fov = w / h < 0.8 ? 74 : BASE_FOV;
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
  } else {
    guide.update(dt, t, { walking: state.speed > 0, speed: 2, waving: false, point: 0 });
  }
  guide.group.rotation.y = state.guideYaw;

  world.update(t, dt, camera);
  stations.forEach((s) => s.portal.update(t, dt));
  headScreen.copy(guide.headWorld()).project(camera);
  // Only show what she says while she's on screen (you may have turned away).
  const onScreen = headScreen.z < 1 && Math.abs(headScreen.x) < 1.25;
  ui.setBubbleShown(onScreen);
  if (onScreen) {
    ui.placeBubble((headScreen.x * 0.5 + 0.5) * window.innerWidth, (-headScreen.y * 0.5 + 0.5) * window.innerHeight);
  }

  composer.render(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(() => {
  frame();
  ui.ready();
  // Deep link: #2025 starts in front of that portal (it's also where a project page's back link lands).
  const id = decodeURIComponent(location.hash.slice(1));
  const i = PROJECTS.findIndex((p) => p.id === id);
  if (i >= 0) standAt(i);
});
