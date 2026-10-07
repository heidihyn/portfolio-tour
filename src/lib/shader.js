import * as THREE from 'three';

// Every material made here has a uTime uniform; main.js ticks them all once per frame.
export const timedMaterials = new Set();

export const GLSL_HASH = /* glsl */ `
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
`;

/**
 * An unlit, animated surface. `main` is GLSL that writes `col` (linear RGB) and optionally `alpha`.
 * Available inside: vUv, vWorld, uTime, hash(), plus anything declared in `head`.
 */
export function surfaceMaterial(main, { head = '', uniforms = {}, fog = true, ...opts } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }, uniforms]),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${GLSL_HASH}
      ${head}
      #include <fog_pars_fragment>
      void main() {
        vec3 col = vec3(0.0);
        float alpha = 1.0;
        ${main}
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog,
    ...opts,
  });
  timedMaterials.add(mat);
  return mat;
}

/** A self-lit color that stays bright enough to bloom. */
export function glowMaterial(hex, intensity = 2, extra = {}) {
  const c = new THREE.Color(hex).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, ...extra });
}
