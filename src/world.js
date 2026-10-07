import * as THREE from 'three';
import { surfaceMaterial } from './lib/shader.js';

// The hallway itself: a bare, pale grey-white space. A seamless floor that dissolves into fog,
// so you can see far ahead but not clearly.
export const HALL_COLOR = '#d9dadd';

export function createWorld({ env }) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(HALL_COLOR);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.028);
  scene.environment = env;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bbc2, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 9, 6);
  scene.add(key);

  // Floor: flat pale grey, a touch lighter around the visitor's feet. No lines.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    surfaceMaterial(/* glsl */ `
      float d = length(vWorld.xz - cameraPosition.xz);
      col = mix(vec3(0.74, 0.745, 0.76), vec3(0.66, 0.67, 0.69), smoothstep(2.0, 18.0, d));
    `),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  scene.add(floor);

  return { scene, floor, update() {} };
}

/** A soft round shadow that sits an object on the pale floor. */
export function contactShadow(radius = 1, opacity = 0.35) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    surfaceMaterial(/* glsl */ `
      float r = length(vUv - 0.5) * 2.0;
      col = vec3(0.0);
      alpha = smoothstep(1.0, 0.0, r) * ${opacity.toFixed(3)};
    `, { transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.006;
  m.renderOrder = -1;
  return m;
}

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
