import * as minigolf from './portals/minigolf-2024.js';
import * as speakeasy from './portals/speakeasy-2025.js';
import * as mystery from './portals/mystery-2026.js';
import * as nextChapter from './portals/next-chapter.js';
import * as hostInvite from './portals/host-invite.js';

// The tour, in walking order. Portals alternate left, right, left... down the hallway, and an
// entry with `end: true` stands across the far end of it, facing you.
//
// To add a project: create a module in ./portals that exports
//   buildPortal() -> { group, focus, hitTargets, centerY, update(t, dt) }
// and a standalone page for it (see projects/2024/index.html), then add an entry below with
// `page` pointing at that page. Stepping through the portal opens the page. Leave out `page`
// (like 2027) for a portal you can't enter yet.

export const PROJECTS = [
  {
    id: '2024',
    year: '2024',
    kind: 'Birthday party',
    title: 'Minigolf, Trivia & Food Trucks',
    tags: ['Minigolf', 'Trivia', 'Food trucks'],
    accent: '#7be06a',
    guideLine: "On your left is my 2024 birthday: minigolf, trivia, and food trucks. Want to play a round?",
    page: 'projects/2024/',
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
    page: 'projects/2025/',
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
    page: 'projects/2026/',
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
  {
    id: 'host',
    year: 'Host',
    kind: 'Invitation',
    title: 'Have Heidi host your event',
    tags: ['Your event'],
    accent: '#d8b26a',
    guideLine: "This last door is for you. Let me take you and your guests through a curated experience of your own, the kind of creative, immersive world they never knew could exist.",
    page: 'host/',
    end: true,
    module: hostInvite,
  },
];
