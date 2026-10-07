# Heidi's Portfolio Tour

A walkable 3D hallway. Heidi greets you, walks you down a pale, foggy corridor, and points out a portal for each year's project. Click a portal to step through into that project's room.

| Year | Side | Theme |
| --- | --- | --- |
| 2024 | Left | Birthday party: minigolf, trivia, food trucks |
| 2025 | Right | 1920s mafia speakeasy |
| 2026 | Left | AI murder mystery, hacker game, dance floor |
| 2027 | Right | Next chapter (not enterable yet) |

The rooms are placeholders for now.

## Controls

- Click the floor to walk, or scroll, or press W / S.
- Drag to look around, or press A / D or the left and right arrows.
- Click a portal (or "Step inside") to enter. Esc or "Back to the hallway" to leave.
- The year bar at the bottom walks you to any portal. `#2025` in the URL starts at that portal.

## Live site

Hosted on GitHub Pages from the `main` branch: https://heidihyn.github.io/portfolio-tour/

## Run it locally

No build step. Three.js loads from jsDelivr through an import map, so you only need a static server (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Layout

```
index.html              page shell, HUD styles, import map
src/main.js             renderer, camera, walking, look-around, portal transitions
src/world.js            the hallway (floor, fog, light) and contact shadows
src/guide.js            Heidi's avatar and her animations
src/ui.js               speech bubble, year bar, room card
src/projects.js         the tour order and Heidi's lines for each portal
src/portals/*.js        one file per project: buildPortal() and buildRoom()
src/lib/                shader and text helpers
```

## Adding a project

1. Create `src/portals/<name>.js` exporting `buildPortal()` and, once it has a room, `buildRoom({ env })`. The existing portal files show the shape of what each returns.
2. Add an entry to `PROJECTS` in `src/projects.js`. Portals alternate left and right in that order.
