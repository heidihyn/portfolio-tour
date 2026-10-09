import * as THREE from 'three';
import { surfaceMaterial } from '../lib/shader.js';
import { makeLabel } from '../lib/text.js';

// A dim placeholder at the end of the hallway for whatever comes next. It has no page yet.

const R = 1.5;
const CY = 1.95;

export function buildPortal({ year = '2027' } = {}) {
  const group = new THREE.Group();
  const focus = new THREE.Group();
  focus.position.y = CY;
  group.add(focus);

  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(R, 64),
    surfaceMaterial(/* glsl */ `
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0;
      float n = hash(floor(vUv * 90.0) + floor(uTime * 12.0));
      col = vec3(0.55, 0.56, 0.6) + vec3(0.12) * n * (1.0 - r);
      col += vec3(0.2) * smoothstep(0.9, 1.0, r);
    `),
  );
  focus.add(surface);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.06, 0.05, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x9aa0b4, wireframe: true }),
  );
  focus.add(ring);

  const label = makeLabel(year, { sub: 'NEXT CHAPTER', color: '#a3a6b2', subColor: '#b3b6c0' });
  label.position.set(0, CY + R + 0.75, 0);
  group.add(label);

  function update(t) {
    ring.rotation.z = t * 0.1;
  }

  return { group, focus, hitTargets: [surface], centerY: CY, update };
}
