# Heidi's Portfolio Tour

A walkable 3D hallway. Heidi greets you, walks you down a pale, foggy corridor lined with pillars, and points out a portal for each experience. Click a portal to step through to that project's own page. At the end of the hallway, an invitation portal leads to a page about having Heidi host your event.

| Portal | Where | Theme | Page |
| --- | --- | --- | --- |
| 2024 | Left | Fall Fairway Classic: minigolf, trivia, food trucks | `projects/2024/` |
| 2025 | Right | 1920s mafia speakeasy | `projects/2025/` |
| 2026 | Left | AI murder mystery, hacker game, dance floor | `projects/2026/` |
| 2027 | Right | Next chapter (not enterable yet) | none |
| Host | End of the hallway | Invitation: have Heidi host your event | `host/` |

Each page is a standalone HTML file (no shared code with the hallway) with a placeholder in its portal's theme, so each one can be built out on its own. A page's "Back to the hallway" link goes to `../../#2024` (and so on), which puts you back in front of that portal.

## Controls

- Scroll to walk (swipe up on a phone). W / S also work.
- Drag to look around, or press A / D or the left and right arrows.
- Click a portal (or "Step inside") to open its page.
- The bar at the bottom walks you to any portal. "Hi" (or scrolling all the way back) returns to the start, where Heidi greets you again. `#2025` in the URL starts in front of that portal.

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
src/main.js             renderer, camera, walking, look-around, stepping through portals
src/world.js            the hallway (floor, fog, sky, pillars) and contact shadows
src/guide.js            Heidi: her figure and her movements
src/ui.js               speech bubble, year bar, fades
src/projects.js         the tour order, Heidi's lines, and each portal's page
src/portals/*.js        one file per portal: buildPortal()
src/lib/                shader and text helpers
projects/<year>/        one standalone page per project
host/                   the "host your event" page
```

## Adding a project

1. Create `src/portals/<name>.js` exporting `buildPortal()`. The existing portal files show the shape of what it returns.
2. Create the project's page, for example `projects/2027/index.html` (copy one of the others).
3. Add an entry to `PROJECTS` in `src/projects.js` with `page: 'projects/2027/'`. Portals alternate left and right in that order; the `end: true` entry stays last, across the end of the hallway.

## Heidi's avatar

Heidi is drawn entirely in code (`src/guide.js`): a simple, stylized figure built from smooth shapes, slim and petite, with long straight black hair, a navy V-neck sweater, a navy maxi skirt and black flats. Her movement is deliberately small and soft: short steps under the skirt, a gentle hip sway, hands resting together when she stands, a light wave and an open presenting gesture.

She isn't a model of Mirage from *The Incredibles*: those characters are Disney/Pixar's copyrighted designs, and models ripped from the films or games can't be used on a public site.
