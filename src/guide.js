import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { contactShadow } from './world.js';

// Heidi: slim and petite, long straight black hair, navy sweater, navy column skirt, black flats.
// The model is a rigged human (assets/heidi.glb, built from CC0 MakeHuman assets, see the README)
// with idle and walk clips. Waving and pointing are layered on top by aiming the arm bones.
// Faces +z by default.

const MODEL_URL = new URL('../assets/heidi.glb', import.meta.url).href;
const SCALE = 1.04;

export async function createGuide() {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const group = new THREE.Group();
  const model = gltf.scene;
  model.scale.setScalar(SCALE);
  group.add(model);
  group.add(contactShadow(0.42, 0.32));

  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // skinned bounds don't follow the animation
    o.userData.noOutline = true; // ink outlines don't follow skinning
    const m = o.material;
    if (m.isMeshStandardMaterial) {
      m.envMapIntensity = 0.5;
      // Fabric and hair shouldn't shine like plastic under the studio environment.
      if (/Cloth|Hair/.test(m.name)) m.roughness = Math.max(m.roughness, 0.85);
    }
  });

  const bone = (name) => model.getObjectByName(name);
  const mixer = new THREE.AnimationMixer(model);
  const clip = (name) => gltf.animations.find((a) => a.name === name);
  const idle = mixer.clipAction(clip('idle'));
  const walk = mixer.clipAction(clip('walk'));
  // The walk clip is in place; its extras say how fast it travels (m/s).
  const walkSpeed = gltf.parser.json.animations?.find((a) => a.name === 'walk')?.extras?.rootMotion?.speed ?? 1.2;
  idle.play();
  walk.play();
  walk.setEffectiveWeight(0);

  // Arms, by which side of the body they're on (+x is her left when she faces +z).
  const arms = ['l', 'r'].map((s) => ({ upper: bone(`upperarm_${s}`), lower: bone(`lowerarm_${s}`), hand: bone(`hand_${s}`), weight: 0 }));
  model.updateMatrixWorld(true);
  const wp = new THREE.Vector3();
  arms.sort((a, b) => a.upper.getWorldPosition(wp).x - b.upper.getWorldPosition(new THREE.Vector3()).x);
  const [armRight, armLeft] = arms; // -x first
  const head = bone('head');

  // Turn `b` so the direction to its child points along `dir` (in the guide's own space), blended by k.
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  const qParent = new THREE.Quaternion();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const childPos = new THREE.Vector3();
  function aim(b, child, dir, k) {
    if (k <= 0.001) return;
    b.updateWorldMatrix(true, true);
    b.getWorldPosition(wp);
    child.getWorldPosition(childPos);
    from.subVectors(childPos, wp).normalize();
    to.copy(dir).normalize().transformDirection(group.matrixWorld);
    qA.setFromUnitVectors(from, to);
    b.getWorldQuaternion(qB);
    qB.premultiply(qA);
    b.parent.getWorldQuaternion(qParent);
    qB.premultiply(qParent.invert());
    b.quaternion.slerp(qB, k);
  }

  const dirUp = new THREE.Vector3();
  const dirFore = new THREE.Vector3();
  let walkW = 0;
  let waveW = 0;

  /** state: { walking, speed, waving, point: -1 | 0 | 1 (local side) } */
  function update(dt, t, state) {
    walkW += ((state.walking ? 1 : 0) - walkW) * Math.min(1, dt * 6);
    walk.setEffectiveWeight(walkW);
    idle.setEffectiveWeight(1 - walkW);
    walk.timeScale = THREE.MathUtils.clamp((state.speed || walkSpeed) / walkSpeed, 0.7, 1.8);
    mixer.update(dt);
    group.updateMatrixWorld(true);

    // Wave with the right hand in the intro.
    waveW += ((state.waving ? 1 : 0) - waveW) * Math.min(1, dt * 5);
    const swing = Math.sin(t * 7) * 0.35;
    aim(armRight.upper, armRight.lower, dirUp.set(-0.75, 0.55, 0.25), waveW);
    aim(armRight.lower, armRight.hand, dirFore.set(-0.15 + swing, 1, 0.15), waveW);

    // Point at a portal with the arm on that side.
    for (const [arm, side] of [[armLeft, 1], [armRight, -1]]) {
      arm.weight += ((state.point === side && !state.waving ? 1 : 0) - arm.weight) * Math.min(1, dt * 5);
      const lift = Math.sin(t * 2) * 0.03;
      aim(arm.upper, arm.lower, dirUp.set(side, 0.2 + lift, 0.35), arm.weight);
      aim(arm.lower, arm.hand, dirFore.set(side, 0.28 + lift, 0.45), arm.weight);
    }

    if (state.waving) head.rotation.z += Math.sin(t * 1.8) * 0.07;
  }

  const tmp = new THREE.Vector3();
  const aboveHead = new THREE.Vector3(0, 0.16, 0);
  function headWorld() {
    return head.getWorldPosition(tmp).add(aboveHead);
  }

  return { group, update, headWorld };
}
