import * as THREE from 'three';

export const FONTS = {
  display: '"Syncopate", "Arial Black", sans-serif',
  body: '"Manrope", "Segoe UI", system-ui, sans-serif',
  mono: '"Courier New", ui-monospace, monospace',
  serif: 'Georgia, "Times New Roman", serif',
};

function fitFont(ctx, text, weight, size, family, maxWidth) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 10);
}

/** A floating year label (big line + small caption) that always faces the viewer. */
export function makeLabel(text, { sub = '', color = '#2b2f3d', subColor = '#6c7184', glow = null, height = 0.85, family = FONTS.display } = {}) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, text, 700, 118, family, 980);
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 28; }
  ctx.fillStyle = color;
  ctx.fillText(text, 512, sub ? 98 : 128);
  if (sub) {
    ctx.shadowBlur = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    fitFont(ctx, sub, 600, 34, FONTS.body, 980);
    ctx.fillStyle = subColor;
    ctx.fillText(sub, 512, 204);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(height * 4, height, 1);
  return sprite;
}

/**
 * A sign or board texture. `lines` is a list of { text, size, color, font, weight, gap }.
 */
export function makeBoardTexture(lines, { w = 1024, h = 640, bg = '#111', border = null, pad = 60 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.lineWidth = 2;
    ctx.strokeRect(38, 38, w - 76, h - 76);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = lines.reduce((s, l) => s + (l.size ?? 48) + (l.gap ?? 24), 0);
  let y = (h - total) / 2;
  for (const l of lines) {
    const size = l.size ?? 48;
    y += size / 2;
    fitFont(ctx, l.text, l.weight ?? 600, size, l.font ?? FONTS.body, w - pad * 2);
    ctx.fillStyle = l.color ?? '#fff';
    ctx.fillText(l.text, w / 2, y);
    y += size / 2 + (l.gap ?? 24);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
