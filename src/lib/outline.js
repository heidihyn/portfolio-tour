import * as THREE from 'three';

// Crisp ink outlines for solid models, so silhouettes read as drawn on purpose.
// Rounded shapes get an inverted-hull outline (a slightly fattened back-face copy);
// boxes get their edges drawn as lines, since their hard corners split a hull apart.
// Flat and open shapes (planes, discs, open cylinders) and glowing parts are left alone.

const FLAT = new Set(['PlaneGeometry', 'CircleGeometry', 'ShapeGeometry', 'RingGeometry']);

function hullMaterial(color, thickness) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uThickness = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uThickness;\nvoid main() {')
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * uThickness;');
  };
  m.customProgramCacheKey = () => `outline-${thickness.toFixed(4)}`;
  return m;
}

/** Add outlines under `root`. `width` is the outline thickness in world units. */
export function addOutlines(root, { color = 0x1d2030, width = 0.012 } = {}) {
  root.updateMatrixWorld(true);
  const lineMat = new THREE.LineBasicMaterial({ color });
  const hulls = new Map();
  const targets = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.isOutline) return;
    const m = o.material;
    if (!m || !m.isMeshStandardMaterial || m.transparent || m.side === THREE.BackSide) return;
    const g = o.geometry;
    if (FLAT.has(g.type) || g.parameters?.openEnded) return;
    targets.push(o);
  });
  const s = new THREE.Vector3();
  for (const o of targets) {
    if (o.geometry.type === 'BoxGeometry') {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry), lineMat);
      lines.userData.isOutline = true;
      o.add(lines);
      continue;
    }
    o.getWorldScale(s);
    const local = width / Math.max(1e-3, (s.x + s.y + s.z) / 3);
    const key = local.toFixed(4);
    if (!hulls.has(key)) hulls.set(key, hullMaterial(color, local));
    const hull = new THREE.Mesh(o.geometry, hulls.get(key));
    hull.userData.isOutline = true;
    hull.raycast = () => {};
    o.add(hull);
  }
}
