# Heidi's Portfolio Tour

A walkable 3D hallway. Heidi greets you, walks you down a pale, foggy corridor lined with pillars, and points out a portal for each year's project. Click a portal to step through to that project's own page. At the end of the hallway, an invitation portal leads to a page about having Heidi host your event.

| Portal | Where | Theme | Page |
| --- | --- | --- | --- |
| 2024 | Left | Birthday party: minigolf, trivia, food trucks | `projects/2024/` |
| 2025 | Right | 1920s mafia speakeasy | `projects/2025/` |
| 2026 | Left | AI murder mystery, hacker game, dance floor | `projects/2026/` |
| 2027 | Right | Next chapter (not enterable yet) | none |
| Host | End of the hallway | Invitation: have Heidi host your event | `host/` |

Each page is a standalone HTML file (no shared code with the hallway) with a placeholder in its portal's theme, so each one can be built out on its own. A page's "Back to the hallway" link goes to `../../#2024` (and so on), which puts you back in front of that portal.

## Controls

- Scroll to walk (swipe up on a phone). W / S also work.
- Drag to look around, or press A / D or the left and right arrows.
- Click a portal (or "Step inside") to open its page.
- The year bar at the bottom walks you to any portal. `#2025` in the URL starts in front of that portal.

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
src/guide.js            loads Heidi's avatar; idle and walk clips, waving and pointing
src/ui.js               speech bubble, year bar, fades
src/projects.js         the tour order, Heidi's lines, and each portal's page
src/portals/*.js        one file per portal: buildPortal()
src/lib/                shader and text helpers
assets/heidi.glb        Heidi's avatar (rigged, with idle and walk clips)
projects/<year>/        one standalone page per project
host/                   the "host your event" page
```

## Adding a project

1. Create `src/portals/<name>.js` exporting `buildPortal()`. The existing portal files show the shape of what it returns.
2. Create the project's page, for example `projects/2027/index.html` (copy one of the others).
3. Add an entry to `PROJECTS` in `src/projects.js` with `page: 'projects/2027/'`. Portals alternate left and right in that order; the `end: true` entry stays last, across the end of the hallway.

## Heidi's avatar

`assets/heidi.glb` is a rigged human built from the [MakeHuman](http://www.makehumancommunity.org/) CC0 system assets (body, face, long straight hair, blouse, skirt and shoes), configured and exported with [CharacterCreator](https://github.com/kblood/CharacterCreator), whose exported files are CC0 as well. Its idle and walk clips come from the same export. On top of that we styled it: slim and petite, black hair, navy top, a navy skirt pulled in from an A-line to a column, an even skin tone, and bare ankles instead of socks. Everything in the file is CC0 (public domain), so no credit is required; this note is here as thanks.

It deliberately isn't a model of Mirage from *The Incredibles*: those characters are Disney/Pixar's copyrighted designs, and models ripped from the films or games can't be used on a public site.
