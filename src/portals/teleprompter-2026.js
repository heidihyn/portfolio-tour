import * as THREE from 'three';
import { surfaceMaterial } from '../lib/shader.js';
import { FONTS } from '../lib/text.js';

// 2026 · a holographic teleprompter above the portal, rolling Heidi's note on what inspired the party.
// A wide sheet of tinted glass, gently curved toward the visitor, projected by the AI core that floats
// above the portal. The script is drawn once onto a tall transparent canvas; the glass scrolls through it by
// moving the texture window. It ignores the hallway fog so the text stays crisp from across the hall.

const SCRIPT = [
  { text: 'Jacob Coxon just quit Anthropic saying AI builders “earnestly believe that it could kill us all.”', color: '#7ff8ff' },
  { text: 'So naturally I’m throwing a party about it.', color: '#ff7cc8' },
  { text: 'I designed this as an immersive experience in a sound studio, for facilitating bonding a crowd that is analytical but not most comfortable with small talks. Think escape room meets mafia meets a house party at scale: loosely structured, fun and cerebral, with all the social warmth of an actual party. Your team gets to know each other and goes through some manufactured trauma bonding, without anyone being forced to initiate awkward small talk.' },
  { text: 'It’s the kind of experience where strangers are accusing each other of sabotage within ten minutes and dancing together by the end of the night. Nobody has time to feel awkward, and people are still arguing about it in the group chat the next morning.' },
];

const W = 6.6;        // glass size along its curve, in portal units
const H = 2.9;
const CURVE_R = 7.5;  // radius of the curve; the edges lean toward the visitor
const SPEED = 0.07;   // screen heights per second
const HOLD = 2.5;     // seconds to rest at the start and the end before rolling again
const GAP = 0.6;  
const HEAD = 0.14;   // top share of the glass that carries the portal's title instead of the script
    // from the projector (the AI core) up to the bottom of the glass

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The whole script on one tall transparent canvas, padded by half a window above and below so it starts and ends on the reading line. */
function scriptTexture(windowPx) {
  const w = 2048;
  const pad = 190;
  const size = 74;
  const lh = size * 1.42;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `600 ${size}px ${FONTS.body}`;
  const paras = SCRIPT.map((p) => ({ ...p, lines: wrap(measure, p.text, w - pad * 2) }));
  const body = paras.reduce((s, p) => s + p.lines.length * lh, 0) + (paras.length - 1) * lh * 0.55;
  const h = Math.min(4096, Math.ceil(body + windowPx));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.font = measure.font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
  // A dark halo behind each letter keeps the text readable against the pale hallway behind the glass.
  ctx.shadowColor = 'rgba(2, 14, 24, 0.95)';
  ctx.shadowBlur = 18;
  let y = windowPx / 2;
  for (const p of paras) {
    ctx.fillStyle = p.color ?? '#f2fbff';
    for (const l of p.lines) { ctx.fillText(l, w / 2, y); y += lh; }
    y += lh * 0.55;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, height: h };
}

/** The title strip along the top of the glass: the theme on the left, the caption on the right. */
function headerTexture(title, sub, aspect) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = Math.round(2048 / aspect);
  const ctx = c.getContext('2d');
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(2, 14, 24, 0.9)';
  ctx.shadowBlur = 14;
  ctx.font = `700 ${Math.round(c.height * 0.6)}px ${FONTS.display}`;
  ctx.fillStyle = '#ff5fbf';
  ctx.fillText(title, 120, c.height * 0.52);
  ctx.textAlign = 'right';
  ctx.font = `600 ${Math.round(c.height * 0.3)}px ${FONTS.body}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillStyle = '#9ff9ff';
  ctx.fillText(sub, c.width - 120, c.height * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildTeleprompter({ title = '', sub = '' } = {}) {
  const group = new THREE.Group();

  // The glass: a slice of an open cylinder, seen from inside, so it wraps slightly around the visitor.
  const theta = W / CURVE_R;
  const geo = new THREE.CylinderGeometry(CURVE_R, CURVE_R, H, 64, 1, true, Math.PI - theta / 2, theta);
  geo.translate(0, 0, CURVE_R);
  const windowPx = Math.round(2048 * (H / W));
  const { tex, height } = scriptTexture(windowPx);
  const frac = windowPx / height;
  const glass = new THREE.Mesh(
    geo,
    surfaceMaterial(/* glsl */ `
      vec2 p = vec2(1.0 - vUv.x, vUv.y);           // inside of the curve: flip so text reads left to right
      vec2 uv = vec2(p.x, 1.0 - uScroll - (1.0 - p.y) * uFrac);
      vec4 tx = texture2D(uMap, uv);
      float fade = smoothstep(0.02, 0.24, p.y) * smoothstep(1.0 - uHead, 0.66, p.y);
      float ink = tx.a * fade;
      vec3 inkCol = tx.rgb / max(tx.a, 0.001);
      // Title strip, with a hairline under it.
      vec4 hd = texture2D(uHeadMap, vec2(p.x, (p.y - (1.0 - uHead)) / uHead));
      float inHead = step(1.0 - uHead, p.y);
      inkCol = mix(inkCol, hd.rgb / max(hd.a, 0.001), inHead);
      ink = mix(ink, hd.a, inHead);
      float hair = smoothstep(0.003, 0.0, abs(p.y - (1.0 - uHead))) * smoothstep(0.5, 0.42, abs(p.x - 0.5));

      // Tinted glass, brighter toward its edges, with fine scanlines and a slow sheen sweeping across.
      vec2 e = min(p, 1.0 - p) * vec2(${(W / H).toFixed(3)}, 1.0);
      float edge = min(e.x, e.y);
      float rim = smoothstep(0.035, 0.0, edge);
      float inner = smoothstep(0.35, 0.0, edge);
      float scan = 0.5 + 0.5 * sin(p.y * 520.0 - uTime * 3.0);
      float sheen = smoothstep(0.12, 0.0, abs(fract(p.x * 0.6 - p.y * 0.25 - uTime * 0.05) - 0.5));
      // Corner brackets.
      vec2 q = abs(p - 0.5) * 2.0;
      float corner = step(0.86, q.x) * step(0.8, q.y) * (step(0.985, q.x) + step(0.975, q.y));
      // The reading line: a soft band across the middle.
      float band = exp(-pow((p.y - 0.5) * 9.0, 2.0)) * 0.18 + smoothstep(0.004, 0.0, abs(p.y - 0.5)) * step(0.04, abs(p.x - 0.5)) * 0.25 * smoothstep(0.5, 0.3, abs(p.x - 0.5));

      vec3 tint = vec3(0.04, 0.30, 0.40);
      col = tint * (0.18 + inner * 0.35 + scan * 0.05 + sheen * 0.25 + band)
          + vec3(0.6, 1.4, 1.6) * (rim * 0.8 + corner * 1.4 + hair * 0.5)
          + inkCol * ink * 1.25;
      alpha = clamp(0.22 + inner * 0.12 + scan * 0.02 + sheen * 0.06 + band * 0.6 + rim * 0.7 + corner + hair * 0.4 + ink, 0.0, 1.0);
    `, {
      head: 'uniform sampler2D uMap; uniform sampler2D uHeadMap; uniform float uScroll; uniform float uFrac; uniform float uHead;',
      uniforms: { uMap: { value: null }, uHeadMap: { value: null }, uScroll: { value: 0 }, uFrac: { value: frac }, uHead: { value: HEAD } },
      fog: false,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glass.material.uniforms.uMap.value = tex;
  glass.material.uniforms.uHeadMap.value = headerTexture(title, sub, W / (H * HEAD));
  glass.renderOrder = 2;
  group.add(glass);

  // A faint fan of light from below, as if the glass were projected from the portal's AI core.
  const bottom = -H / 2;
  const emitterY = bottom - GAP;
  const fanShape = new THREE.Shape([
    new THREE.Vector2(-0.12, 0), new THREE.Vector2(0.12, 0),
    new THREE.Vector2(W * 0.45, -emitterY + bottom), new THREE.Vector2(-W * 0.45, -emitterY + bottom),
  ]);
  const fanGeo = new THREE.ShapeGeometry(fanShape);
  const fh = bottom - emitterY;
  const fp = fanGeo.attributes.position;
  const fuv = fanGeo.attributes.uv;
  for (let i = 0; i < fp.count; i++) fuv.setXY(i, fp.getX(i) / W + 0.5, fp.getY(i) / fh);
  const fan = new THREE.Mesh(
    fanGeo,
    surfaceMaterial(/* glsl */ `
      float flicker = 0.85 + 0.15 * sin(uTime * 7.0 + vUv.x * 30.0);
      col = vec3(0.2, 0.9, 1.0) * 0.6;
      alpha = 0.16 * (1.0 - vUv.y * 0.6) * flicker * smoothstep(0.5, 0.2, abs(vUv.x - 0.5));
    `, { fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  fan.position.set(0, emitterY, 0);
  group.add(fan);

  // Roll: rest on the first line, scroll to the end, rest, and start over.
  const span = 1 - frac;
  const rollTime = span / frac / SPEED;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function update(t) {
    const cycle = rollTime + HOLD * 2;
    const k = THREE.MathUtils.clamp(((t % cycle) - HOLD) / rollTime, 0, 1);
    glass.material.uniforms.uScroll.value = (reduced ? 0 : k) * span;
  }

  // Not part of the portal's click target, and no ink outlines on the glass.
  group.traverse((o) => { o.userData.noHit = true; o.userData.noOutline = true; });
  return { group, height: H, gap: GAP, update };
}
