import * as THREE from 'three';
import { surfaceMaterial, glowMaterial } from '../lib/shader.js';
import { FONTS } from '../lib/text.js';

// 2026 · a news-desk teleprompter above the portal, rolling Heidi's note on what inspired the party.
// The script is drawn once onto a tall canvas; the screen scrolls through it by moving the texture
// window, with a LIVE bar on top, a BREAKING chyron below and magenta cue arrows at the reading line.
// The screen ignores the hallway fog so the text stays crisp black-and-white from across the hall.

const SCRIPT = [
  { text: 'Jacob Coxon just quit Anthropic saying AI builders “earnestly believe that it could kill us all.”', color: '#2ff3ff' },
  { text: 'So naturally I’m throwing a party about it.' },
  { text: 'I designed this as an immersive experience in a sound studio, for facilitating bonding a crowd that is analytical but not most comfortable with small talks. Think escape room meets mafia meets a house party at scale: loosely structured, fun and cerebral, with all the social warmth of an actual party. Your team gets to know each other and goes through some manufactured trauma bonding, without anyone being forced to initiate awkward small talk.' },
  { text: 'It’s the kind of experience where strangers are accusing each other of sabotage within ten minutes and dancing together by the end of the night. Nobody has time to feel awkward, and people are still arguing about it in the group chat the next morning.' },
];

const W = 4.6;        // screen size, in portal units
const H = 2.6;
const BAR = 0.34;     // height of the LIVE bar and the chyron
const SPEED = 0.07;   // screen heights per second
const HOLD = 2.5;     // seconds to rest at the start and the end before rolling again
const MAGENTA = 0xff2fa8;
const CYAN = 0x2ff3ff;

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

/** The whole script on one tall canvas, padded by half a window above and below so it starts and ends on the cue line. */
function scriptTexture(windowPx) {
  const w = 1024;
  const pad = 70;
  const size = 50;
  const lh = size * 1.38;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `700 ${size}px ${FONTS.body}`;
  const paras = SCRIPT.map((p) => ({ ...p, lines: wrap(measure, p.text, w - pad * 2) }));
  const body = paras.reduce((s, p) => s + p.lines.length * lh, 0) + (paras.length - 1) * lh * 0.6;
  const h = Math.min(4096, Math.ceil(body + windowPx));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.font = measure.font;
  ctx.textBaseline = 'middle';
  let y = windowPx / 2;
  for (const p of paras) {
    ctx.fillStyle = p.color ?? '#fbfaff';
    for (const l of p.lines) { ctx.fillText(l, pad, y); y += lh; }
    y += lh * 0.6;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  return { tex, height: h };
}

function stripTexture(draw, aspect) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.round(1024 / aspect);
  draw(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function strip(draw, y) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W, BAR),
    new THREE.MeshBasicMaterial({ map: stripTexture(draw, W / BAR), fog: false }),
  );
  mesh.position.set(0, y, 0.02);
  return mesh;
}

export function buildTeleprompter() {
  const group = new THREE.Group();

  // Backing panel and neon trim.
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.16, H + BAR * 2 + 0.16),
    new THREE.MeshBasicMaterial({ color: 0x07060d, fog: false }),
  );
  group.add(panel);
  const trim = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(W + 0.16, H + BAR * 2 + 0.16)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(CYAN).multiplyScalar(1.6) }),
  );
  trim.position.z = 0.01;
  group.add(trim);

  // The rolling script, faded toward the top and bottom edges like a prompter hood.
  const windowPx = Math.round(1024 * (H / W));
  const { tex, height } = scriptTexture(windowPx);
  const frac = windowPx / height;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    surfaceMaterial(/* glsl */ `
      vec2 uv = vec2(vUv.x, 1.0 - uScroll - (1.0 - vUv.y) * uFrac);
      col = texture2D(uMap, uv).rgb;
      col *= smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
    `, {
      head: 'uniform sampler2D uMap; uniform float uScroll; uniform float uFrac;',
      uniforms: { uMap: { value: null }, uScroll: { value: 0 }, uFrac: { value: frac } },
      fog: false,
    }),
  );
  screen.material.uniforms.uMap.value = tex;
  screen.position.z = 0.02;
  group.add(screen);

  // Cue arrows at the reading line.
  const arrow = new THREE.Shape([new THREE.Vector2(0, 0.11), new THREE.Vector2(0.16, 0), new THREE.Vector2(0, -0.11)]);
  for (const side of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.ShapeGeometry(arrow), glowMaterial(MAGENTA, 2.2));
    a.position.set(side * (W / 2 - 0.06), 0, 0.03);
    a.scale.x = -side;
    group.add(a);
  }

  const top = H / 2 + BAR / 2;
  group.add(strip((ctx, w, h) => {
    ctx.fillStyle = '#0c0816';
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    ctx.font = `700 34px ${FONTS.body}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillStyle = '#ff2040';
    ctx.fillText('LIVE', 62, h / 2 + 2);
    ctx.fillStyle = 'rgba(233, 230, 245, 0.75)';
    ctx.textAlign = 'right';
    ctx.fillText('NEWS DESK · 2026', w - 30, h / 2 + 2);
  }, top));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), glowMaterial(0xff2040, 2.5));
  dot.position.set(-W / 2 + 0.17, top, 0.03);
  group.add(dot);

  group.add(strip((ctx, w, h) => {
    ctx.fillStyle = '#0c0816';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff2040';
    ctx.fillRect(0, 0, 250, h);
    ctx.textBaseline = 'middle';
    ctx.font = `700 32px ${FONTS.body}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.fillStyle = '#fff';
    ctx.fillText('BREAKING', 28, h / 2 + 2);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    ctx.font = `600 34px ${FONTS.body}`;
    ctx.fillStyle = '#e9e6f5';
    ctx.fillText('What inspired this party', 282, h / 2 + 2);
  }, -top));
  const chyronLine = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.02), glowMaterial(MAGENTA, 2));
  chyronLine.position.set(0, -H / 2, 0.03);
  group.add(chyronLine);

  // Roll: rest on the first line, scroll to the end, rest, and start over.
  const span = 1 - frac;
  const rollTime = span / frac / SPEED;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function update(t) {
    const cycle = rollTime + HOLD * 2;
    const k = THREE.MathUtils.clamp(((t % cycle) - HOLD) / rollTime, 0, 1);
    screen.material.uniforms.uScroll.value = (reduced ? 0 : k) * span;
    dot.visible = reduced || Math.floor(t * 1.6) % 2 === 0;
  }

  // Not part of the portal's click target; outlines stay off the flat screen parts.
  group.traverse((o) => { o.userData.noHit = true; o.userData.noOutline = true; });
  return { group, height: H + BAR * 2 + 0.16, update };
}
