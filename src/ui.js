// The HTML layer over the 3D scene: speech bubble, year rail, room card, fades, loading screen.

const $ = (id) => document.getElementById(id);

export function createUI({ projects, onJump, onExitRoom }) {
  const bubble = $('bubble');
  const bubbleText = $('bubble-text');
  const bubbleActions = $('bubble-actions');
  const fade = $('fade');
  const roomCard = $('room-card');
  let bubbleKey = null;
  const scrollCue = $('scroll-cue');
  if (window.matchMedia('(pointer: coarse)').matches) $('scroll-cue-text').textContent = 'Swipe up to walk';

  // Year rail.
  const rail = $('rail');
  const railButtons = projects.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<b>${p.year}</b><small>${p.locked ? 'Soon' : p.tags[0] ?? p.kind}</small>`;
    b.setAttribute('aria-label', `Walk to ${p.year}: ${p.title}`);
    b.addEventListener('click', () => onJump(i));
    rail.appendChild(b);
    return b;
  });

  $('room-exit').addEventListener('click', () => onExitRoom());

  return {
    /** Show a line from the guide. `key` avoids rebuilding the DOM every frame. */
    say(key, text, actions = []) {
      if (key === bubbleKey) return;
      bubbleKey = key;
      if (!text) { bubble.hidden = true; return; }
      bubbleText.textContent = text;
      bubbleActions.replaceChildren(...actions.map(({ label, primary, onClick }) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        if (primary) b.className = 'primary';
        b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
        return b;
      }));
      bubble.hidden = false;
    },

    /** Place the bubble so its tail sits at screen point (x, y), kept on screen. */
    placeBubble(x, y) {
      if (bubble.hidden) return;
      const w = bubble.offsetWidth;
      const h = bubble.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.min(Math.max(16, x - 18), vw - w - 16);
      const top = Math.min(Math.max(64, y - h - 8), vh - h - 90);
      bubble.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    },

    setBubbleShown(on) {
      bubble.style.visibility = on ? '' : 'hidden';
    },

    showScrollCue(on) {
      scrollCue.hidden = !on;
    },

    setActive(i) {
      railButtons.forEach((b, k) => b.classList.toggle('active', k === i));
    },

    setRailEnabled(on) {
      railButtons.forEach((b) => { b.disabled = !on; });
    },

    fadeTo(color, opacity) {
      if (color) fade.style.background = color;
      fade.style.opacity = String(opacity);
    },

    showRoom(p) {
      roomCard.style.setProperty('--accent', p.accent);
      $('room-eyebrow').textContent = `${p.year} · ${p.kind}`;
      $('room-title').textContent = p.title;
      $('room-tags').replaceChildren(...p.tags.map((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        return li;
      }));
      $('room-note').textContent = p.roomNote ?? '';
      roomCard.hidden = false;
      rail.hidden = true;
      scrollCue.hidden = true;
      $('room-exit').focus({ preventScroll: true });
    },

    hideRoom() {
      roomCard.hidden = true;
      rail.hidden = false;
    },

    ready() {
      $('loading').classList.add('done');
      window.__tourReady = true;
    },

    fail(message) {
      $('loading-note').textContent = message;
    },
  };
}
