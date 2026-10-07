import * as THREE from 'three';
import { surfaceMaterial } from './lib/shader.js';

// The hallway itself: a pale grey floor under a darker grey, starlit sky. Fog thickens toward
// the horizon, so you can see far ahead but not clearly.
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

  // Sky: a dome that follows the camera. Hazy at the horizon, deepening to slate grey overhead,
  // with twinkling stars that fade out into the haze.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 48, 24),
    surfaceMaterial(/* glsl */ `
      vec3 dir = normalize(vWorld - cameraPosition);
      float h = max(dir.y, 0.0);
      vec3 haze = vec3(0.69, 0.70, 0.72);
      vec3 low = vec3(0.24, 0.25, 0.30);
      vec3 high = vec3(0.045, 0.05, 0.075);
      col = mix(haze, low, smoothstep(0.0, 0.07, h));
      col = mix(col, high, smoothstep(0.07, 0.7, h));
      // A thin bright seam where the sky meets the floor.
      col += vec3(0.10) * exp(-h * 90.0);

      // Stars on a lat/long grid, one candidate per cell.
      vec2 sph = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
      vec2 grid = sph * vec2(38.0, 38.0);
      vec2 cell = floor(grid);
      vec2 f = fract(grid) - 0.5;
      float rnd = hash(cell);
      vec2 offset = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float dist = length((f - offset * 0.7) * vec2(cos(sph.y), 1.0));
      float size = 0.035 + 0.05 * hash(cell + 1.3);
      float star = step(0.86, rnd) * smoothstep(size, 0.0, dist);
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + 2.5 * hash(cell + 5.0)) + rnd * 40.0);
      col += vec3(1.25, 1.25, 1.35) * star * twinkle * smoothstep(0.04, 0.3, h);
      col += (hash(gl_FragCoord.xy) - 0.5) / 160.0;
    `, { fog: false, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  // Floor: flat pale grey, a little brighter around the visitor's feet. No lines.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    surfaceMaterial(/* glsl */ `
      float d = length(vWorld.xz - cameraPosition.xz);
      col = mix(vec3(0.78, 0.785, 0.80), vec3(0.64, 0.65, 0.67), smoothstep(2.0, 20.0, d));
      col += (hash(gl_FragCoord.xy) - 0.5) / 160.0; // dither away banding rings
    `),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  scene.add(floor);

  // Drifting motes of light.
  const rand = mulberry32(7);
  const COUNT = 500;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rand() - 0.5) * 36;
    pos[i * 3 + 1] = rand() * 9;
    pos[i * 3 + 2] = 12 - rand() * 90;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.06, map: dotTexture(), transparent: true, opacity: 0.9, depthWrite: false,
  }));
  scene.add(dust);

  function update(t, dt, camera) {
    if (camera) sky.position.copy(camera.position);
    const a = dustGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      a[i * 3 + 1] += dt * (0.05 + (i % 7) * 0.012);
      a[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.03;
      if (a[i * 3 + 1] > 9) a[i * 3 + 1] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  return { scene, floor, update };
}

/** A soft round dot, so points render as glints instead of squares. */
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
