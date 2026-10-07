import * as minigolf from './portals/minigolf-2024.js';
import * as speakeasy from './portals/speakeasy-2025.js';
import * as mystery from './portals/mystery-2026.js';
import * as nextChapter from './portals/next-chapter.js';

// The tour, in walking order. Portals alternate left, right, left... down the hallway.
//
// To add a project: create a module in ./portals that exports
//   buildPortal() -> { group, focus, hitTargets, centerY, update(t, dt) }
//   buildRoom({ env }) -> { scene, update(t, dt), view: { center, radius, height }, bloom }
// then add an entry below. Leave out buildRoom (like nextChapter) for a portal you can't enter yet.

export const PROJECTS = [
  {
    id: '2024',
    year: '2024',
    kind: 'Birthday party',
    title: 'Minigolf, Trivia & Food Trucks',
    tags: ['Minigolf', 'Trivia', 'Food trucks'],
    accent: '#7be06a',
    guideLine: "On your left is my 2024 birthday: minigolf, trivia, and food trucks. Want to play a round?",
    roomNote: "This room is a placeholder for now. We'll fill it in with the real party together.",
    module: minigolf,
  },
  {
    id: '2025',
    year: '2025',
    kind: 'Experience',
    title: '1920s Mafia Speakeasy',
    tags: ['1920s', 'Mafia', 'Speakeasy'],
    accent: '#f3b45a',
    guideLine: "Over here is 2025. We went back to the 1920s for a mafia night in a speakeasy. Know the password?",
    roomNote: "This room is a placeholder for now. We'll fill it in with the real night together.",
    module: speakeasy,
  },
  {
    id: '2026',
    year: '2026',
    kind: 'Immersive game',
    title: 'AI Murder Mystery & Dance Floor',
    tags: ['AI murder mystery', 'Hacker game', 'Dance floor'],
    accent: '#ff4fb4',
    guideLine: "And this is 2026: an AI murder mystery, a hacking game, and a dance floor. Someone in there is lying.",
    roomNote: "This room is a placeholder for now. Next we can bring in the real game.",
    module: mystery,
  },
  {
    id: '2027',
    year: '2027',
    kind: 'Next chapter',
    title: 'Coming soon',
    tags: [],
    accent: '#8f97bd',
    guideLine: "That one hasn't happened yet. You'll have to come back next year.",
    locked: true,
    module: nextChapter,
  },
];
