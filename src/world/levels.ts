import type { LevelDef } from './LevelBuilder';

const PI = Math.PI;

/**
 * The nine shifts of COLD STORAGE. Floors are corridor-and-room
 * architecture: `rooms` generate their own walls with door gaps, so keep
 * rooms separated by corridors. Waypoint lanes stay on documented clear
 * corridors; 2-waypoint guards ping-pong (safe in tight geometry).
 * A single-waypoint guard is a POSTED guard: they stand there facing
 * `facing` and only a lure (thrown can) reliably moves them.
 */
export const LEVELS: LevelDef[] = [
  // ------------------------------------------------------------------
  // L0 — ORIENTATION DAY (tutorial) — 44 x 26
  // ------------------------------------------------------------------
  {
    id: 'orientation',
    name: 'ORIENTATION DAY',
    floorLabel: 'FLOOR 2 · ONBOARDING',
    briefing: {
      from: 'PAL — People & Alignment Liaison (automated)',
      lines: [
        'Welcome to Halcyon Dynamics, Employee #7431.',
        'Today: locate your desk, complete mobility compliance, and enjoy the lunch you brought from home.',
        'Halcyon reminds you that the communal refrigerator operates on the honor system.',
        'The honor system has a 4% success rate.'
      ]
    },
    palette: {
      wall: 0xcbc2ae, accent: 0x7dd3fc, trim: 0x7a6248,
      carpetA: '#5a5449', carpetB: '#5e584c', fog: 0x181712,
      ceiling: '#d9d4c7', sun: 0xffe3bd
    },
    size: [44, 26],
    spawn: { x: -18, z: 9, yaw: -0.9 },
    walls: [
      [-14.5, 2, 15, 0.4],
      [1.5, 2, 13, 0.4],
      [16.75, 2, 10.5, 0.4]
    ],
    rooms: [
      { x: 15, z: -7, w: 12, d: 10, doors: [{ side: 'W', at: 0, door: true }] },
      { x: -16, z: -8, w: 10, d: 8, doors: [{ side: 'E', at: 0, door: true }] }
    ],
    desks: [
      [-8, -4], [-4, -4], [0, -4], [4, -4],
      [-8, -8], [-4, -8], [0, -8], [4, -8],
      [-17, -9]
    ],
    props: [
      { type: 'sofa', x: -12, z: 6.5 },
      { type: 'sofa', x: -7, z: 6.5 },
      { type: 'plant', x: -21, z: 6 },
      { type: 'plant', x: 7, z: 6.8 },
      { type: 'counter', x: 2, z: 6, rot: PI / 2 },
      { type: 'art', x: -10, z: 2.45, rot: PI },
      { type: 'clock', x: 3, z: 2.45, rot: PI },
      { type: 'board', x: -1, z: 2.45, rot: PI },
      { type: 'copier', x: -9.5, z: -2.8 },
      { type: 'bin', x: 5.2, z: -6 },
      { type: 'filing', x: -21.3, z: -2.5 },
      { type: 'vend', x: 10.5, z: -10.5 },
      { type: 'table', x: 12.5, z: -5 },
      { type: 'table', x: 16, z: -9.5 },
      { type: 'counter', x: 17, z: -3.5, rot: PI / 2 },
      { type: 'cooler', x: 9.8, z: -11.5 },
      { type: 'whiteboard', x: -16, z: -11.6, rot: 0 }
    ],
    doors: [{ hinge: [-7, 2], length: 2, axis: 'x' }],
    keycards: [],
    guards: [],
    notes: [
      { x: 0, z: -3.7, text: 'PAL ONBOARDING CARD — "Your desk is your castle. Your chair is your throne. Your lunch is, statistically, someone else\'s."' },
      { x: 12.5, z: -4.8, y: 0.8, text: 'BREAKROOM POSTER — "FRIDGE CRIME: A JOURNEY. Talk to HR today!" Someone has drawn a tiny crown on the sandwich.' },
      { x: -17, z: -8.6, y: 0.81, text: 'HR PAMPHLET (laminated) — "Grief has five stages. So does lunch theft: Denial. Anger. Bargaining. Salad. Promotion."' }
    ],
    lights: [[-12, 7], [2, 7], [-2, -6], [15, -7], [-16, -8], [10, 6]],
    windowsSide: 'S',
    cans: [[13.2, -4.2]],
    fridge: { x: 19.5, z: -9 },
    exit: { x: -18, z: 9, r: 1.5 },
    objectives: {
      start: 'Report to your assigned desk.',
      toFridge: 'End of day. Retrieve YOUR lunch from the breakroom fridge.',
      escape: ''
    },
    tutorial: true,
    lunchName: 'YOUR LUNCH'
  },

  // ------------------------------------------------------------------
  // L1 — THE BULLPEN — 72 x 40
  // ------------------------------------------------------------------
  {
    id: 'bullpen',
    name: 'THE BULLPEN',
    floorLabel: 'FLOOR 3 · GENERAL OPERATIONS',
    briefing: {
      from: 'A note, folded into your keyboard. Unsigned. Smells faintly of floor wax.',
      lines: [
        '"They took yours on day one. That was not an accident. Nothing here is."',
        '"The intern, Dorian, keeps a lunch in the Floor 3 breakroom. Take it, and the building will notice you."',
        '"Blue keycard. Someone always leaves one on an office desk. People are careless before they are executives."',
        '— M.'
      ]
    },
    palette: {
      wall: 0xcbc2ae, accent: 0x7dd3fc, trim: 0x7a6248,
      carpetA: '#5a5449', carpetB: '#5e584c', fog: 0x181712,
      ceiling: '#d9d4c7', sun: 0xffe3bd
    },
    size: [72, 40],
    spawn: { x: -33, z: 16, yaw: -1.2 },
    walls: [],
    rooms: [
      { x: -28, z: -10, w: 12, d: 12, doors: [{ side: 'S', at: 2 }] },
      { x: -13, z: -10, w: 12, d: 12, doors: [{ side: 'S', at: 0, door: true }] },
      { x: 2, z: -10, w: 10, d: 12, doors: [{ side: 'S', at: -2, door: true }] },
      { x: 17, z: -10, w: 14, d: 12, doors: [{ side: 'S', at: 0, door: true, locked: 'BLUE' }] },
      { x: 30, z: -10, w: 8, d: 12, doors: [{ side: 'W', at: 0, door: true }] },
      { x: 27, z: 11, w: 14, d: 14, doors: [{ side: 'N', at: -3 }] }
    ],
    partitions: [
      [-11, 8, 42, 0.15],
      [-11, 12, 42, 0.15]
    ],
    desks: [
      [-30, 6], [-26, 6], [-22, 6], [-18, 6], [-14, 6], [-10, 6], [-6, 6], [-2, 6], [2, 6], [6, 6], [10, 6],
      [-30, 10], [-26, 10], [-22, 10], [-18, 10], [-14, 10], [-10, 10], [-6, 10], [-2, 10], [2, 10], [6, 10], [10, 10],
      [-30, 14], [-26, 14], [-22, 14], [-18, 14], [-14, 14], [-10, 14], [-6, 14], [-2, 14], [2, 14], [6, 14], [10, 14],
      [-28, -11], [2, -11]
    ],
    props: [
      { type: 'plant', x: -34.5, z: 2 },
      { type: 'plant', x: 34.5, z: 2 },
      { type: 'filing', x: -20.5, z: -3.55 },
      { type: 'filing', x: -4.5, z: -3.55 },
      { type: 'filing', x: 8.5, z: -3.55 },
      { type: 'art', x: -30, z: -3.72, rot: PI },
      { type: 'clock', x: -5, z: -3.72, rot: PI },
      { type: 'board', x: 14, z: -3.72, rot: PI },
      { type: 'bin', x: -28, z: 4.6 },
      { type: 'bin', x: -2, z: 4.6 },
      { type: 'bin', x: 6, z: 15.5 },
      { type: 'cooler', x: 13.5, z: 7 },
      { type: 'copier', x: 30, z: -13 },
      { type: 'shelf', x: 32.5, z: -8, rot: PI / 2 },
      { type: 'crate', x: 27.5, z: -14 },
      { type: 'vend', x: 11, z: -14.5 },
      { type: 'counter', x: 23, z: -7 },
      { type: 'table', x: 14, z: -12 },
      { type: 'table', x: 18, z: -8 },
      { type: 'cooler', x: 11, z: -6 },
      { type: 'bin', x: 13, z: -15 },
      { type: 'meeting', x: -13, z: -10 },
      { type: 'whiteboard', x: -13, z: -15.6 },
      { type: 'bookshelf', x: -32.5, z: -15.5 },
      { type: 'bookshelf', x: -2, z: -15.5 },
      { type: 'sofa', x: 30, z: 8 },
      { type: 'sofa', x: 24, z: 12, rot: PI / 2 },
      { type: 'table', x: 27, z: 12 },
      { type: 'plant', x: 21, z: 16 },
      { type: 'plant', x: 33, z: 16 },
      { type: 'bookshelf', x: 27, z: 17.5 },
      { type: 'art', x: 33.7, z: 10, rot: -PI / 2 }
    ],
    doors: [],
    keycards: [{ id: 'BLUE', x: 2, z: -10.55, color: 0x3b82f6 }],
    guards: [
      { name: 'Officer Dwight', waypoints: [[-32, 0], [32, 0]] },
      { name: 'Officer Pat', waypoints: [[-30, -18], [30, -18]], viewDist: 12 },
      { name: 'Gary (Accounts)', waypoints: [[-30, 4], [12, 4], [12, 16], [-30, 16]], civilian: true, patrolSpeed: 1.3 },
      { name: 'Officer Rosa', waypoints: [[25, -18], [25, 0]], viewDist: 12 }
    ],
    notes: [
      { x: -28, z: -10.55, text: 'STICKY NOTE (Gary) — "IOU one (1) yogurt. The market conditions demanded it. — G"' },
      { x: 23, z: -6.9, y: 0.95, text: 'ALL-STAFF MEMO #1 (B. Kowalczyk, Security) — "A lunch was reported MISSING on Floor 2. This is now a Category C incident. I have requested a second lanyard."' },
      { x: 27, z: 11.9, y: 0.8, text: 'FOLDED NOTE — "Cameras arrive on Floor 7. Walk like you have a meeting. Nobody stops a person with a meeting." — M.' },
      { x: 32.4, z: -8, y: 1.1, text: 'SUPPLY AUDIT — "Missing: 44 staplers, 1 chair, 9 lunches (unresolved), 1 sense of institutional trust."' }
    ],
    restricted: [[17, -10, 14, 12]],
    lights: [[-24, 0], [-8, 0], [8, 0], [24, 0], [-16, 10], [0, 10], [17, -10], [27, 11]],
    windowsSide: 'N',
    cans: [[13.9, 6.5], [-1.4, 4.9], [-27.5, 5.1]],
    fridge: { x: 23, z: -15 },
    exit: { x: -33.5, z: 16.5, r: 1.7 },
    objectives: {
      start: 'Somewhere in the offices, someone left a BLUE keycard on a desk. Start searching.',
      toFridge: 'Get into the breakroom. The fridge hums like it knows.',
      escape: 'Return to the elevator. Walk like you belong.'
    },
    lunchName: "DORIAN'S LUNCH"
  },

  // ------------------------------------------------------------------
  // L2 — MIDDLE MANAGEMENT — 72 x 40
  // ------------------------------------------------------------------
  {
    id: 'management',
    name: 'MIDDLE MANAGEMENT',
    floorLabel: 'FLOOR 7 · STRATEGIC ALIGNMENT',
    briefing: {
      from: 'Marv (Custodial) — whispered by the mop closet',
      lines: [
        '"Promoted after one day. You feel that? That\'s the Program noticing you."',
        '"Floor 7 has cameras now. Green light means bored. Red light means paperwork — for you."',
        '"Dorian eats in the manager wing. Yellow clearance. Last I saw, the card was somewhere in the north offices. Careless place, the north offices."',
        '"One more thing: the lid of that container you took. Look at the engraving. They all have one."'
      ]
    },
    palette: {
      wall: 0xb3a794, accent: 0xffc53d, trim: 0x6e5133,
      carpetA: '#565049', carpetB: '#5a544c', fog: 0x16130e,
      ceiling: '#d4cec0', sun: 0xffd9a0
    },
    size: [72, 40],
    spawn: { x: -33, z: 17.5, yaw: -1.2 },
    walls: [
      [-22.75, 8, 26.5, 0.4],
      [5.25, 8, 23.5, 0.4],
      [27.5, 8, 17, 0.4]
    ],
    rooms: [
      { x: -29, z: -15.5, w: 12, d: 9, doors: [{ side: 'S', at: 2 }] },
      { x: -15, z: -15.5, w: 12, d: 9, doors: [{ side: 'S', at: 0, door: true }] },
      { x: -2, z: -15.5, w: 10, d: 9, doors: [{ side: 'S', at: 0, door: true }] },
      { x: 11, z: -15.5, w: 10, d: 9, doors: [{ side: 'S', at: -2 }] },
      { x: 24, z: -15.5, w: 14, d: 9, doors: [{ side: 'S', at: 0, door: true }] },
      { x: 18, z: -2, w: 28, d: 12, doors: [{ side: 'W', at: 0, door: true, locked: 'YELLOW' }] }
    ],
    partitions: [
      [-18, -4, 30, 0.15],
      [-18, 0, 30, 0.15]
    ],
    desks: [
      [-32, -6], [-28, -6], [-24, -6], [-20, -6], [-16, -6], [-12, -6], [-8, -6],
      [-32, -2], [-28, -2], [-24, -2], [-20, -2], [-16, -2], [-12, -2], [-8, -2],
      [-32, 2], [-28, 2], [-24, 2], [-20, 2], [-16, 2], [-12, 2], [-8, 2],
      [0, 14], [4, 14],
      [12, -5], [16, -5], [20, -5],
      [-29, -16.5], [-15, -16.5], [-2, -16.5], [24, -17]
    ],
    props: [
      { type: 'sofa', x: -14, z: 17 },
      { type: 'sofa', x: -10, z: 17 },
      { type: 'plant', x: -19, z: 12 },
      { type: 'plant', x: 10, z: 12 },
      { type: 'art', x: -18, z: 8.45 },
      { type: 'clock', x: 8, z: 8.45 },
      { type: 'board', x: 24, z: 8.45 },
      { type: 'filing', x: -33.5, z: -9.5 },
      { type: 'filing', x: -12, z: -10.6 },
      { type: 'filing', x: 20, z: -10.6 },
      { type: 'bin', x: -30, z: 4.6 },
      { type: 'bin', x: 2, z: 12.5 },
      { type: 'cooler', x: -34.5, z: 4 },
      { type: 'copier', x: -4, z: -10.8 },
      { type: 'counter', x: 30.5, z: -3 },
      { type: 'table', x: 26, z: -6 },
      { type: 'meeting', x: 24, z: 2 },
      { type: 'plant', x: 30.5, z: 2.5 },
      { type: 'art', x: 31.8, z: -7.9, rot: 0 },
      { type: 'shelf', x: 28, z: -18.5 },
      { type: 'shelf', x: 20, z: -18.5 },
      { type: 'crate', x: 30.5, z: -12.5 },
      { type: 'bookshelf', x: -33.5, z: -17.5 },
      { type: 'whiteboard', x: -15, z: -19.6 },
      { type: 'meeting', x: -15, z: -15 },
      { type: 'vend', x: 34.8, z: 12, rot: -PI / 2 },
      { type: 'plant', x: -34.5, z: -8 }
    ],
    doors: [{ hinge: [17, 8], length: 2, axis: 'x' }],
    keycards: [{ id: 'YELLOW', x: 24, z: -16.55, color: 0xeab308 }],
    guards: [
      { name: 'Officer Chen', waypoints: [[-32, 6], [32, 6]] },
      { name: 'Officer Diaz', waypoints: [[-32, -9.5], [32, -9.5]], viewDist: 13 },
      { name: 'Officer Okafor', waypoints: [[9, 0], [27, 0]], viewDist: 13 },
      { name: 'Deb (Ops)', waypoints: [[-30, 16], [28, 16]], civilian: true, patrolSpeed: 1.4 }
    ],
    cameras: [
      { x: -8, z: 7.4, facing: PI, arc: 0.5, range: 10 },
      { x: 8, z: 5, facing: 0, arc: 0.7, range: 12 },
      { x: 6.5, z: -2, facing: PI / 2, arc: 0.5, range: 9 }
    ],
    notes: [
      { x: 4, z: 13.6, text: 'PROMOTION MEMO — "Effective immediately: #7431, Junior Associate → Associate. Justification: [REDACTED]. Welcome to Floor 7. — A.H."' },
      { x: -15, z: -16.95, text: 'ALL-STAFF MEMO #4 (B. Kowalczyk) — "The Floor 3 incident was NOT the HVAC. I have moved the security budget request to FONT SIZE 16."' },
      { x: -2, z: -16.95, text: 'CHAT PRINTOUT — "…okay but WHY does the new intern have a BETTER lunch on every floor?? like an identical, better lunch??" — deleted by moderator' },
      { x: 30.5, z: -3.9, y: 0.95, text: 'KITCHENETTE SIGN — "The manager fridge is for MANAGER LUNCHES. Dorian\'s lunch is here for reasons nobody has ever successfully explained."' }
    ],
    restricted: [[18, -2, 28, 12], [24, -15.5, 14, 9]],
    lights: [[-20, 6], [4, 6], [26, 6], [-20, -9.5], [8, -9.5], [18, -2], [29, -4], [0, 15]],
    windowsSide: 'S',
    cans: [[-33.8, 4.6], [2.6, 12.9], [34, 11]],
    fridge: { x: 30.5, z: -6 },
    exit: { x: -33.5, z: 17.5, r: 1.7 },
    objectives: {
      start: 'The YELLOW keycard is somewhere in the north offices. The manager wing is watching.',
      toFridge: 'Enter the manager wing. Mind the cameras.',
      escape: 'Back to the elevator. You have a meeting. You have always had a meeting.'
    },
    lunchName: "DORIAN'S LUNCH (DELUXE)"
  },

  // ------------------------------------------------------------------
  // L3 — FACILITIES — 72 x 40 · introduces posted guards + can lures
  // ------------------------------------------------------------------
  {
    id: 'facilities',
    name: 'FACILITIES',
    floorLabel: 'FLOOR 9 · BUILDING SERVICES',
    briefing: {
      from: 'Marv — over the service intercom, chewing something',
      lines: [
        '"Floor 9 is the building\'s stomach. Pipes, fuses, and the supply cage where they stage the week\'s lunches."',
        '"The cage wants a RED card. The RED card lives in the custodial office — and Officer Boone has stood in front of that door since 2019. He does not patrol. He does not blink. He is a door with a pension."',
        '"But a man who stands still all day finds any little clatter FASCINATING. People leave soda cans everywhere — pocket one (E), throw it somewhere unhelpful (Q), and walk in while he communes with it."',
        '"Watch the blinking beam by the cage. And keep your lids. — M."'
      ]
    },
    palette: {
      wall: 0x9b9484, accent: 0xf59e0b, trim: 0x54493a,
      carpetA: '#4a463f', carpetB: '#4e4a42', fog: 0x111009,
      ceiling: '#c9c4b6', ceilingGrid: '#a8a396',
      sun: 0xffd9a0, sunIntensity: 1.4, hemiSky: 0xd8cbb8
    },
    size: [72, 40],
    spawn: { x: -33.5, z: 17, yaw: -1.57 },
    walls: [
      [-20, 2, 20, 0.4],
      [8, 2, 16, 0.4],
      [28, 2, 8, 0.4]
    ],
    rooms: [
      { x: -25, z: -13, w: 14, d: 10, doors: [{ side: 'E', at: 2, door: true }] },
      { x: -1, z: -13, w: 12, d: 10, doors: [{ side: 'S', at: -3, door: true, locked: 'RED' }] },
      { x: 24, z: -13, w: 16, d: 10, doors: [{ side: 'W', at: 2, door: true }] },
      { x: -25, z: 13, w: 12, d: 10, doors: [{ side: 'N', at: 0, door: true }] },
      { x: 25, z: 13, w: 14, d: 10, doors: [{ side: 'N', at: -3 }] }
    ],
    desks: [[-25, 13.9], [10, 6.5], [-23, -16.5]],
    props: [
      { type: 'shelf', x: -31, z: -17.5 },
      { type: 'shelf', x: -27, z: -17.5 },
      { type: 'crate', x: -30, z: -10.5 },
      { type: 'crate', x: -20.5, z: -17 },
      { type: 'copier', x: -19.5, z: -10.5 },
      { type: 'whiteboard', x: -25, z: -17.6, rot: 0 },
      { type: 'crate', x: 29, z: -11 },
      { type: 'crate', x: 31, z: -16.5 },
      { type: 'crate', x: 20, z: -16.5 },
      { type: 'shelf', x: 25, z: -17.5 },
      { type: 'filing', x: 17.5, z: -16 },
      { type: 'vend', x: 21.5, z: 17.6 },
      { type: 'vend', x: 24, z: 17.6 },
      { type: 'counter', x: 30, z: 13, rot: PI / 2 },
      { type: 'table', x: 26, z: 12 },
      { type: 'sofa', x: 27, z: 9.5 },
      { type: 'cooler', x: 31.5, z: 17 },
      { type: 'bin', x: 19, z: 16.5 },
      { type: 'filing', x: -30.5, z: 16.5 },
      { type: 'shelf', x: -21, z: 17.5 },
      { type: 'bin', x: -22, z: 9.5 },
      { type: 'plant', x: -34.5, z: 6 },
      { type: 'plant', x: 16, z: 6.5 },
      { type: 'art', x: -14, z: 2.45, rot: PI },
      { type: 'clock', x: 6, z: 2.45, rot: PI },
      { type: 'board', x: 27, z: 2.45, rot: PI },
      { type: 'bin', x: -12, z: -6.5 },
      { type: 'cooler', x: 7, z: -7 },
      { type: 'crate', x: 2, z: -9.5 }
    ],
    doors: [],
    keycards: [{ id: 'RED', x: -25.4, z: 13.6, color: 0xef4444 }],
    guards: [
      { name: 'Officer Boone', waypoints: [[-25, 4.6]], facing: PI, viewDist: 13 },
      { name: 'Officer Pike', waypoints: [[-30, -4], [30, -4]], viewDist: 13 },
      { name: 'Rover Ferris', waypoints: [[-14, 5], [14, 5]], viewDist: 12, patrolSpeed: 1.9 },
      { name: 'Custodian Mopps', waypoints: [[-33.5, 2], [-33.5, -16]], civilian: true, patrolSpeed: 1.2 },
      { name: 'Officer Greaves', waypoints: [[34, -4], [34, 16]], viewDist: 12 }
    ],
    cameras: [
      { x: -4, z: -3, facing: 0, arc: 0.55, range: 9 }
    ],
    lasers: [
      { x0: -7.4, z0: -5.6, x1: 5.4, z1: -5.6, blink: 2.8 }
    ],
    notes: [
      { x: -24.6, z: 14.2, text: 'BOONE-WATCH LOG, DAY 1,208 (Mopps) — "Subject has not moved. Blinked twice on Tuesday. I respect him and I fear him in equal measure."' },
      { x: 26, z: 12.55, y: 0.79, text: 'ALL-STAFF MEMO #6 (B. Kowalczyk) — "Officer Boone is NOT a statue and it is UNKIND to keep leaning umbrellas against him."' },
      { x: -27, z: -17.4, y: 1.05, text: 'LOST & FOUND, COLD ITEMS — "One (1) lunch, unmarked lid. No engraving, so not one of THEIRS. Unclaimed by Friday it becomes infrastructure."' },
      { x: 3, z: -7.2, y: 0.03, text: 'WORK ORDER #4451 — "Reinforce the lunch cage (again). Whatever keeps bending the mesh, it is not mice, and it is not hungry in any normal way."' }
    ],
    restricted: [[-1, -13, 12, 10], [-25, 13, 12, 10]],
    dark: [[-30, -16.5, 3.5, 3], [29, -16.5, 4, 3], [32, 5, 4, 4]],
    lights: [[-25, -13], [-1, -13], [22, -12], [-25, 13], [25, 13], [-16, -4], [12, -4], [0, 5]],
    windowsSide: null,
    cans: [[22, 10.3], [26.5, 10.6], [-28.8, -10.2], [6, 6.6]],
    fridge: { x: -1, z: -15.5 },
    exit: { x: -33.5, z: 17.5, r: 1.7 },
    objectives: {
      start: 'The RED card is in the custodial office, southwest — and Officer Boone IS its door policy. A thrown can (Q) is a meeting he must attend.',
      toFridge: 'RED opens the supply cage, north-center. Time the blinking beam. Mind the camera.',
      escape: 'Elevator, southwest corner. Boone saw nothing. Nobody tell Boone.'
    },
    lunchName: 'A LUNCH (UNMARKED)'
  },

  // ------------------------------------------------------------------
  // L4 — THE GLASS FLOOR — 72 x 40
  // ------------------------------------------------------------------
  {
    id: 'glass',
    name: 'THE GLASS FLOOR',
    floorLabel: 'FLOOR 12 · EXECUTIVE OPERATIONS',
    briefing: {
      from: 'Marv — via a note taped inside your new office chair',
      lines: [
        '"Floor 12. Everything is glass. Transparency, they call it. Means everyone sees everything, always."',
        '"The assistants are worse than security. They walk fast and they remember faces."',
        '"Green clearance for the executive lounge. There\'s a card in one of the window offices, north row — the exec who owned it got \'aligned\' last quarter."',
        '"Second lid says 8. First said 1. Keep them. — M."'
      ]
    },
    palette: {
      wall: 0x8a7462, accent: 0xd8a05a, trim: 0x4a3826,
      carpetA: '#4a3f38', carpetB: '#4e433b', fog: 0x120f0c,
      ceiling: '#cfc7b8', sun: 0xffcf9a, hemiSky: 0xe8d9c8
    },
    size: [72, 40],
    spawn: { x: -33, z: 16, yaw: -1.2 },
    walls: [],
    glass: [
      [-32.5, -12, 7, 0.3],
      [-20, -12, 14, 0.3],
      [-4, -12, 14, 0.3],
      [12, -12, 14, 0.3],
      [26, -12, 10, 0.3],
      [33.5, -12, 1, 0.3],
      [-20, -16, 0.3, 8],
      [-4, -16, 0.3, 8],
      [12, -16, 0.3, 8],
      [28, -16, 0.3, 8],
      [-1, -8, 70, 0.3],
      [-27.5, 0, 17, 0.3],
      [-15, 0, 4, 0.3],
      [1, 0, 24, 0.3],
      [24.5, 0, 19, 0.3],
      [-26, -4, 0.3, 8],
      [-10, -4, 0.3, 8],
      [6, -4, 0.3, 8],
      [22, -4, 0.3, 8]
    ],
    rooms: [
      { x: 26, z: 12, w: 16, d: 14, doors: [{ side: 'W', at: -3, door: true, locked: 'GREEN' }] }
    ],
    partitions: [
      [-11, 10, 42, 0.15],
      [-11, 14, 42, 0.15]
    ],
    desks: [
      [-28, -17], [-12, -17], [4, -17], [20, -17], [31, -17],
      [-31, -4], [-18, -4], [-2, -4], [14, -4], [29, -4],
      [-30, 8], [-26, 8], [-22, 8], [-18, 8], [-14, 8], [-10, 8], [-6, 8], [-2, 8], [2, 8], [6, 8],
      [-30, 12], [-26, 12], [-22, 12], [-18, 12], [-14, 12], [-10, 12], [-6, 12], [-2, 12], [2, 12], [6, 12],
      [-30, 16], [-26, 16], [-22, 16], [-18, 16], [-14, 16], [-10, 16], [-6, 16], [-2, 16], [2, 16], [6, 16]
    ],
    props: [
      { type: 'plant', x: -34.5, z: -3 },
      { type: 'plant', x: 11, z: 18 },
      { type: 'plant', x: -34.5, z: 6 },
      { type: 'cooler', x: 12.5, z: 6 },
      { type: 'copier', x: 12.5, z: 17 },
      { type: 'bin', x: -28, z: 6.5 },
      { type: 'bin', x: 4, z: 17.5 },
      { type: 'sofa', x: 22, z: 17.5 },
      { type: 'sofa', x: 30, z: 8 },
      { type: 'table', x: 26, z: 12 },
      { type: 'plant', x: 20, z: 6.5 },
      { type: 'plant', x: 32.5, z: 6.5 },
      { type: 'bookshelf', x: 33.6, z: 12, rot: PI / 2 },
      { type: 'art', x: 33.7, z: 16, rot: -PI / 2 },
      { type: 'art', x: -35.8, z: -16, rot: PI / 2 },
      { type: 'clock', x: -14, z: 0.5, rot: 0 },
      { type: 'bin', x: -24, z: -10 },
      { type: 'filing', x: 34, z: -18.5 },
      { type: 'filing', x: 34, z: -16.9 }
    ],
    doors: [
      { hinge: [-13, 0], length: 2, axis: 'x' },
      { hinge: [-29, -12], length: 2, axis: 'x' }
    ],
    keycards: [{ id: 'GREEN', x: -12, z: -16.55, color: 0x34d399 }],
    guards: [
      { name: 'Officer Sloane', waypoints: [[-32, 2], [32, 2]], viewDist: 13 },
      { name: 'Asst. Mercer', waypoints: [[-30, -10], [30, -10]], civilian: true, patrolSpeed: 2.0, viewDist: 14 },
      { name: 'Asst. Vale', waypoints: [[21, 7], [31, 7], [31, 16], [21, 16]], civilian: true, patrolSpeed: 1.8, viewDist: 13 },
      { name: 'Officer Brooks', waypoints: [[35, -18], [35, 18]], viewDist: 13 },
      { name: 'Officer Pierce', waypoints: [[15.5, 9]], facing: -PI / 2, viewDist: 13 }
    ],
    cameras: [
      { x: -14, z: 3.4, facing: 0, arc: 0.65, range: 12 },
      { x: 10, z: -11.4, facing: PI, arc: 0.6, range: 11 },
      { x: 19.5, z: 17, facing: -PI / 2, arc: 0.5, range: 10 }
    ],
    notes: [
      { x: -28, z: -16.55, text: 'PERFORMANCE REVIEW (final page) — "Employee exhibits insufficient hunger. Literally. Brings no lunch. Recommend: alignment." The name is blacked out.' },
      { x: 26.3, z: 11.5, y: 0.79, text: 'ALL-STAFF MEMO #9 (B. Kowalczyk) — "To whoever keeps taking the lunches: the cameras are ON now. I picked the ones with the little red light MYSELF."' },
      { x: -6, z: 8.45, text: 'STICKY NOTE — "Dorian was in the lounge again. Nobody hired him for Floor 12. Nobody remembers hiring him at all."' },
      { x: 14, z: -3.55, text: 'CALENDAR PRINTOUT — Every single day at noon: "LUNCH (DORIAN\'S) — DO NOT BOOK OVER THIS." Recurring since 1987.' }
    ],
    restricted: [[26, 12, 16, 14]],
    lights: [[-20, 2], [0, 2], [20, 2], [-15, -10], [10, -10], [26, 12], [-15, 12], [2, 16]],
    windowsSide: 'N',
    cans: [[12.9, 6.6], [13.1, 16.4], [-27.6, 6.9]],
    fridge: { x: 32.5, z: 17 },
    exit: { x: -33.5, z: 16.5, r: 1.7 },
    objectives: {
      start: 'GREEN clearance is in one of the north window offices. Glass remembers nothing. Assistants remember everything.',
      toFridge: 'The executive lounge fridge. Officer Pierce holds the lounge door — something loud (Q), somewhere else.',
      escape: 'Elevator. Do not run. Running is a confession.'
    },
    lunchName: "DORIAN'S LUNCH (ARTISANAL)"
  },

  // ------------------------------------------------------------------
  // L5 — THE STACKS — 72 x 40 · dark archive, keen ears, posted cage guard
  // ------------------------------------------------------------------
  {
    id: 'stacks',
    name: 'THE STACKS',
    floorLabel: 'FLOOR 16 · RECORDS & MEMORY',
    briefing: {
      from: 'M. — a note inside a returned library book, stamped FLOOR 16',
      lines: [
        '"Records keeps everything the company would rather forget, and one thing it cannot: a rival\'s lunch, confiscated in 1994. Consider tonight a rehearsal for the vault."',
        '"The cage takes VIOLET. The card sits in the reading room, in the open — nobody steals from Records twice. Ask the boxes in aisle three."',
        '"Officer Ledger holds the cage door. A wall with a flashlight. You know the drill by now: something loud, somewhere else."',
        '"And mind Quill in the stacks. No headphones, ever. Quill hears a dropped pin apologize. Walk. Softly. — M."'
      ]
    },
    palette: {
      wall: 0x7a715c, accent: 0xc9a13b, trim: 0x40382a,
      carpetA: '#3e3a30', carpetB: '#423e33', fog: 0x0b0a07,
      ceiling: '#c6bfae', ceilingGrid: '#a49d8c',
      sun: 0xffd9a0, sunIntensity: 0.9, hemiSky: 0xcbbba0, hemiGround: 0x191610
    },
    size: [72, 40],
    spawn: { x: -33.5, z: 16, yaw: -1.2 },
    walls: [],
    rooms: [
      { x: 0, z: -12, w: 18, d: 12, doors: [{ side: 'S', at: 4, door: true, locked: 'VIOLET' }] },
      { x: -26, z: -13, w: 12, d: 10, doors: [{ side: 'E', at: 2, door: true }] },
      { x: 25, z: 12, w: 14, d: 12, doors: [{ side: 'W', at: -2, door: true }] }
    ],
    desks: [[-26, -16], [23, 16.5]],
    props: [
      // Three rows of stacks with slip-through gaps — the archive proper.
      { type: 'bookshelf', x: -30, z: -1 }, { type: 'bookshelf', x: -26.8, z: -1 },
      { type: 'bookshelf', x: -23.6, z: -1 }, { type: 'bookshelf', x: -20.4, z: -1 },
      { type: 'bookshelf', x: -17.2, z: -1 }, { type: 'bookshelf', x: -14, z: -1 },
      { type: 'bookshelf', x: -10.8, z: -1 }, { type: 'bookshelf', x: -7.6, z: -1 },
      { type: 'bookshelf', x: -4.4, z: -1 }, { type: 'bookshelf', x: -1.2, z: -1 },
      { type: 'bookshelf', x: 2, z: -1 }, { type: 'bookshelf', x: 5.2, z: -1 },
      { type: 'bookshelf', x: -30, z: 3 }, { type: 'bookshelf', x: -26.8, z: 3 },
      { type: 'bookshelf', x: -23.6, z: 3 }, { type: 'bookshelf', x: -20.4, z: 3 },
      { type: 'bookshelf', x: -17.2, z: 3 }, { type: 'bookshelf', x: -14, z: 3 },
      { type: 'bookshelf', x: -10.8, z: 3 }, { type: 'bookshelf', x: -7.6, z: 3 },
      { type: 'bookshelf', x: -4.4, z: 3 }, { type: 'bookshelf', x: -1.2, z: 3 },
      { type: 'bookshelf', x: 2, z: 3 }, { type: 'bookshelf', x: 5.2, z: 3 },
      { type: 'bookshelf', x: -30, z: 7 }, { type: 'bookshelf', x: -26.8, z: 7 },
      { type: 'bookshelf', x: -23.6, z: 7 }, { type: 'bookshelf', x: -20.4, z: 7 },
      { type: 'bookshelf', x: -17.2, z: 7 }, { type: 'bookshelf', x: -14, z: 7 },
      { type: 'bookshelf', x: -10.8, z: 7 }, { type: 'bookshelf', x: -7.6, z: 7 },
      { type: 'bookshelf', x: -4.4, z: 7 }, { type: 'bookshelf', x: -1.2, z: 7 },
      { type: 'bookshelf', x: 2, z: 7 }, { type: 'bookshelf', x: 5.2, z: 7 },
      // Reading room.
      { type: 'meeting', x: 25, z: 13 },
      { type: 'sofa', x: 20.5, z: 16.5 },
      { type: 'plant', x: 30, z: 7.5 },
      { type: 'bookshelf', x: 31.6, z: 10, rot: PI / 2 },
      { type: 'bookshelf', x: 31.6, z: 14, rot: PI / 2 },
      // Archive office, northwest.
      { type: 'filing', x: -31.5, z: -10 },
      { type: 'crate', x: -30.5, z: -17.2 },
      { type: 'shelf', x: -21.5, z: -17.5 },
      // Records cage interior.
      { type: 'shelf', x: -7, z: -17.5 }, { type: 'shelf', x: -3, z: -17.5 },
      { type: 'shelf', x: 3, z: -17.5 }, { type: 'shelf', x: 7, z: -17.5 },
      { type: 'crate', x: -6, z: -9.2 }, { type: 'crate', x: 6.5, z: -16.5 },
      // South hall + west corridor.
      { type: 'sofa', x: -20, z: 16.5 },
      { type: 'table', x: -15, z: 16.5 },
      { type: 'plant', x: -7, z: 17.5 },
      { type: 'plant', x: 12, z: 17.5 },
      { type: 'cooler', x: 14, z: 13 },
      { type: 'bin', x: -28, z: 13 },
      { type: 'board', x: -2, z: 19.75, rot: 0 },
      { type: 'art', x: -35.75, z: 4, rot: PI / 2 }
    ],
    doors: [],
    keycards: [{ id: 'VIOLET', x: 25.4, z: 12.7, color: 0x8b5cf6 }],
    guards: [
      { name: 'Officer Ledger', waypoints: [[4, -3]], facing: 0, viewDist: 13 },
      { name: 'Archivist Quill', waypoints: [[-30, 1], [10, 1]], civilian: true, keenEars: true, viewDist: 11, patrolSpeed: 1.15, shirt: 0x6b5a3f, pants: 0x3c352a },
      { name: 'Officer Sorel', waypoints: [[-32, -4.5], [32, -4.5]], viewDist: 12 },
      { name: 'Officer Vesper', waypoints: [[34, -16], [34, 16]], viewDist: 12, patrolSpeed: 1.8 },
      { name: 'Officer Marlowe', waypoints: [[-30, 12], [12, 12]], viewDist: 12 },
      { name: 'Asst. Folio', waypoints: [[21, 9], [29, 9]], civilian: true, patrolSpeed: 1.5, viewDist: 12 }
    ],
    cameras: [
      { x: 0, z: -17.4, facing: PI, arc: 0.7, range: 11 },
      { x: 19.2, z: 16.8, facing: -PI / 2, arc: 0.6, range: 10 }
    ],
    notes: [
      { x: -26.4, z: -15.7, text: 'ACQUISITIONS LEDGER, 1994 — "One (1) lunch, confiscated from a rival firm\'s courier at the lobby doors. Lid: unmarked. The Founder wept anyway. Filed under HUNGER, COMPARATIVE."' },
      { x: 24.6, z: 13.3, y: 0.78, text: 'READING ROOM RULES — "1. Silence. 2. SILENCE. 3. If you can hear someone breathing in the stacks, page Quill. Quill heard it first."' },
      { x: -14, z: 1, y: 0.03, text: 'SHELF TAG, AISLE THREE — "EMPLOYEES, FORMER: M–Z. The boxes rattle at noon. We have stopped investigating. — Records"' },
      { x: 2, z: -4.5, y: 0.03, text: 'CHECKOUT SLIP, LAMINATED — "Item: LUNCH (1994). Borrower: D_____. Due: never. Status: RENEWED DAILY SINCE 1994."' }
    ],
    restricted: [[0, -12, 18, 12]],
    dark: [[-24, 1, 3, 3], [-8, 1, 3, 3], [-16, 5, 3, 3], [3, 5, 3, 3], [-31, 8, 3, 3]],
    lights: [[-26, -13], [0, -12], [25, 12], [-33, -3], [16, 2], [-2, 12], [22, -3], [33, 4]],
    windowsSide: null,
    cans: [[19.3, 7.2], [10.5, 1], [-24, -10.5], [-33, 10.5]],
    fridge: { x: 0, z: -15 },
    exit: { x: -33.5, z: 16.5, r: 1.7 },
    objectives: {
      start: 'The VIOLET card sits in the reading room, east — in the open, under a camera. Quill hears everything: walk, never run.',
      toFridge: 'The records cage, center-north. Ledger never leaves the door — pull him away with a can (Q).',
      escape: 'Elevator, southwest. The stacks are dark. Be furniture when the flashlights pass.'
    },
    lunchName: 'A LUNCH, CONFISCATED (1994)'
  },

  // ------------------------------------------------------------------
  // L6 — R&D — 72 x 40
  // ------------------------------------------------------------------
  {
    id: 'rnd',
    name: 'RESEARCH & DEVELOPMENT',
    floorLabel: 'FLOOR 21 · APPLIED CULINARY SCIENCE',
    briefing: {
      from: 'Marv — spoken openly this time, mop abandoned',
      lines: [
        '"Floor 21 is where they make it. The lunch. The one Dorian carries. It\'s the company\'s only real product."',
        '"Lasers at knee height. The techs wear headphones — deaf as drywall, eyes like hawks."',
        '"Cyan card is in the cold annex, northwest. The specimen fridge sits in the middle of the main lab."',
        '"Third lid: 7. You\'re collecting a number, Associate. Sub-Level B has a door that wants it. — M."'
      ]
    },
    palette: {
      wall: 0xc5cdd4, accent: 0x22d3ee, trim: 0x7b8794,
      carpetA: '#5d666d', carpetB: '#616a71', fog: 0x0e1216,
      ceiling: '#dde3e8', ceilingGrid: '#b9c2ca',
      sun: 0xeaf4ff, sunIntensity: 2.2, hemiSky: 0xdfeef8
    },
    size: [72, 40],
    spawn: { x: -33, z: 16, yaw: -1.2 },
    walls: [],
    rooms: [
      { x: 0, z: -4, w: 24, d: 16, doors: [
        { side: 'N', at: 0 },
        { side: 'S', at: 0, door: true, locked: 'CYAN' }
      ] },
      { x: -26, z: -14, w: 14, d: 10, doors: [{ side: 'E', at: 3.5, door: true }] },
      { x: 26, z: -14, w: 14, d: 10, doors: [{ side: 'W', at: 3.5, door: true }] },
      { x: 26, z: 13, w: 14, d: 10, doors: [{ side: 'N', at: -3, door: true }] }
    ],
    partitions: [
      [-11, 10, 42, 0.15],
      [-11, 14, 42, 0.15]
    ],
    desks: [
      [-6, -9], [6, -9], [-6, 1], [6, 1],
      [-30, 8], [-26, 8], [-22, 8], [-18, 8], [-14, 8], [-10, 8], [-6, 8], [-2, 8], [2, 8], [6, 8],
      [-30, 12], [-26, 12], [-22, 12], [-18, 12],
      [-30, 16], [-26, 16], [-22, 16], [-18, 16],
      [-24, -16], [26, -16], [22, 13], [30, 13]
    ],
    props: [
      { type: 'shelf', x: -31, z: -17.5 },
      { type: 'crate', x: -29, z: -11 },
      { type: 'crate', x: -22, z: -17.5 },
      { type: 'copier', x: -21.5, z: -11 },
      { type: 'shelf', x: 30, z: -17.5 },
      { type: 'shelf', x: 22, z: -17.5 },
      { type: 'crate', x: 31.5, z: -11 },
      { type: 'whiteboard', x: 26, z: 8.5, rot: PI },
      { type: 'filing', x: 32.6, z: 13 },
      { type: 'plant', x: -34.5, z: 6 },
      { type: 'plant', x: 11, z: 18 },
      { type: 'cooler', x: -34.5, z: 10 },
      { type: 'bin', x: -14, z: 6.5 },
      { type: 'bin', x: 4, z: 17.5 },
      { type: 'art', x: -12.35, z: -4, rot: PI / 2 },
      { type: 'clock', x: 0, z: 4.45, rot: 0 },
      { type: 'board', x: -16, z: 19.75, rot: 0 },
      { type: 'vend', x: 14, z: 18.5 }
    ],
    doors: [],
    keycards: [{ id: 'CYAN', x: -24, z: -15.55, color: 0x22d3ee }],
    guards: [
      { name: 'Tech Ruiz', waypoints: [[-16, -10.5], [16, -10.5]], civilian: true, deaf: true, viewDist: 15, shirt: 0xd8dde2, pants: 0x9aa2ab },
      { name: 'Tech Imani', waypoints: [[-10, 6], [10, 6]], civilian: true, deaf: true, viewDist: 15, shirt: 0xd8dde2, pants: 0x9aa2ab },
      { name: 'Officer Novak', waypoints: [[34.5, -16], [34.5, 19]], viewDist: 13 },
      { name: 'Officer Weber', waypoints: [[-34, 19], [13, 19]], viewDist: 13, patrolSpeed: 1.9 }
    ],
    cameras: [
      { x: 0, z: -11.3, facing: PI, arc: 0.4, range: 9 },
      { x: 18.7, z: 1, facing: PI / 2, arc: 0.5, range: 10 }
    ],
    lasers: [
      { x0: 12.4, z0: -6, x1: 17, z1: -6, sweep: 0.5, speed: 0.35 },
      { x0: 14, z0: -1, x1: 18.6, z1: -1 },
      { x0: 12.4, z0: 4.5, x1: 17, z1: 4.5, sweep: 0.5, speed: 0.42 },
      { x0: -18.6, z0: -6, x1: -14, z1: -6, sweep: -0.5, speed: 0.35 },
      { x0: -17, z0: -1, x1: -12.4, z1: -1 },
      { x0: -4, z0: -11.9, x1: -4, z1: -9.1, blink: 3 },
      { x0: 4, z0: -11.9, x1: 4, z1: -9.1, blink: 3 }
    ],
    notes: [
      { x: -23.4, z: -16.3, text: 'SHIPMENT MANIFEST — "Batch 88: 1 (one) lunch. Destination: wherever the current intern is. Recipe source: DO NOT ASK (1987)."' },
      { x: 26, z: -15.55, text: 'SPECIMEN LOG — "Day 40: the sandwich has not aged. Morale team wept again. Dorian collected it at noon, as always. Who signs Dorian\'s badge??"' },
      { x: 22, z: 12.55, text: 'STICKY NOTE (on a headphone case) — "If you see someone crouching in here it is NOT a wellness exercise. Page Brenda."' },
      { x: 6, z: 1.45, text: 'LAB WHITEBOARD PHOTO — a flowchart from "SANDWICH" to "LOYALTY" with fourteen arrows and no explanations.' }
    ],
    restricted: [[0, -4, 24, 16], [-26, -14, 14, 10], [26, -14, 14, 10]],
    dark: [[-30, -12.5, 3.5, 3.5], [30, 12, 4, 5]],
    lights: [[0, -7], [0, 6], [-15, -10.5], [15, -10.5], [-26, -14], [26, -14], [-15, 12], [26, 13]],
    windowsSide: 'N',
    cans: [[14.8, 17.8], [-33.9, 10.4], [-20.9, -10.6]],
    fridge: { x: 0, z: -7 },
    exit: { x: -33.5, z: 16.5, r: 1.7 },
    objectives: {
      start: 'CYAN clearance is in the cold annex, northwest. The labs are restricted zones.',
      toFridge: 'The specimen fridge, center lab. The camera never blinks. The techs never hear.',
      escape: 'Elevator. Step OVER nothing — the lasers are at knee height for a reason.'
    },
    lunchName: 'SPECIMEN 88 (A LUNCH)'
  },

  // ------------------------------------------------------------------
  // L7 — THE NIGHT SHIFT — 72 x 40 (geometry cloned from the Bullpen)
  // ------------------------------------------------------------------
  {
    id: 'nightshift',
    name: 'THE NIGHT SHIFT',
    floorLabel: 'SUB-LEVEL A · NIGHT SECURITY',
    briefing: {
      from: 'Marv — a text message, no contact name, 3:11 AM',
      lines: [
        '"You went down instead of up. Good instinct. Sub-Level A is the checkpoint before the vault, and at night they run it dark to save the founder a nickel."',
        '"That works for you. Where the light doesn\'t reach, neither do their eyes — stand in the black and they walk right past."',
        '"Silva works the floor deaf — headphones, all night. She won\'t hear a thing. She will SEE everything. And the corridor scanners move now; watch the rhythm before you commit."',
        '"GREEN badge, on a desk as always. Take the night lunch from the guards\' own fridge. Pettiness is a ladder. — M."'
      ]
    },
    palette: {
      wall: 0x3f4453, accent: 0x9be7c4, trim: 0x2a2f3b,
      carpetA: '#33373f', carpetB: '#363a43', fog: 0x090c11,
      ceiling: '#3a3f4a', ceilingGrid: '#2c313b',
      sun: 0xaac2dc, sunIntensity: 1.0, hemiSky: 0x8098b0, hemiGround: 0x141820
    },
    size: [72, 40],
    spawn: { x: -33, z: 16, yaw: -1.2 },
    walls: [],
    rooms: [
      { x: -28, z: -10, w: 12, d: 12, doors: [{ side: 'S', at: 2 }] },
      { x: -13, z: -10, w: 12, d: 12, doors: [{ side: 'S', at: 0, door: true }] },
      { x: 2, z: -10, w: 10, d: 12, doors: [{ side: 'S', at: -2, door: true }] },
      { x: 17, z: -10, w: 14, d: 12, doors: [{ side: 'S', at: 0, door: true, locked: 'GREEN' }] },
      { x: 30, z: -10, w: 8, d: 12, doors: [{ side: 'W', at: 0, door: true }] },
      { x: 27, z: 11, w: 14, d: 14, doors: [{ side: 'N', at: -3 }] }
    ],
    partitions: [
      [-11, 8, 42, 0.15],
      [-11, 12, 42, 0.15]
    ],
    desks: [
      [-30, 6], [-26, 6], [-22, 6], [-18, 6], [-14, 6], [-10, 6], [-6, 6], [-2, 6], [2, 6], [6, 6], [10, 6],
      [-30, 10], [-26, 10], [-22, 10], [-18, 10], [-14, 10], [-10, 10], [-6, 10], [-2, 10], [2, 10], [6, 10], [10, 10],
      [-30, 14], [-26, 14], [-22, 14], [-18, 14], [-14, 14], [-10, 14], [-6, 14], [-2, 14], [2, 14], [6, 14], [10, 14],
      [-28, -11], [2, -11]
    ],
    props: [
      { type: 'plant', x: -34.5, z: 2 },
      { type: 'plant', x: 34.5, z: 2 },
      { type: 'filing', x: -20.5, z: -3.55 },
      { type: 'filing', x: -4.5, z: -3.55 },
      { type: 'filing', x: 8.5, z: -3.55 },
      { type: 'board', x: -30, z: -3.72, rot: PI },
      { type: 'clock', x: -5, z: -3.72, rot: PI },
      { type: 'vend', x: 14, z: -3.72, rot: PI },
      { type: 'bin', x: -28, z: 4.6 },
      { type: 'bin', x: 6, z: 15.5 },
      { type: 'cooler', x: 13.5, z: 7 },
      { type: 'copier', x: 30, z: -13 },
      { type: 'shelf', x: 32.5, z: -8, rot: PI / 2 },
      { type: 'crate', x: 27.5, z: -14 },
      { type: 'counter', x: 23, z: -7 },
      { type: 'table', x: 14, z: -12 },
      { type: 'cooler', x: 11, z: -6 },
      { type: 'meeting', x: -13, z: -10 },
      { type: 'whiteboard', x: -13, z: -15.6 },
      { type: 'bookshelf', x: -32.5, z: -15.5 },
      { type: 'bookshelf', x: -2, z: -15.5 },
      { type: 'sofa', x: 30, z: 8 },
      { type: 'sofa', x: 24, z: 12, rot: PI / 2 },
      { type: 'plant', x: 21, z: 16 },
      { type: 'plant', x: 33, z: 16 },
      { type: 'bookshelf', x: 27, z: 17.5 }
    ],
    doors: [],
    keycards: [{ id: 'GREEN', x: -13, z: -10.55, color: 0x34d399 }],
    guards: [
      { name: 'Warden Silva', waypoints: [[-32, 0], [32, 0]], deaf: true, viewDist: 16, shirt: 0x1c2733, pants: 0x11161f },
      { name: 'Rookie Delgado', waypoints: [[-30, -18], [30, -18]], viewDist: 12 },
      { name: 'Rover Nyx', waypoints: [[25, -18], [25, 2]], viewDist: 13, patrolSpeed: 1.9, shirt: 0x1c2733, pants: 0x11161f },
      { name: 'Statue Vann', waypoints: [[17, -2.2]], facing: 0, viewDist: 14, shirt: 0x1c2733, pants: 0x11161f }
    ],
    lasers: [
      { x0: -8, z0: -2, x1: -8, z1: 4, blink: 2.4 },
      { x0: 0, z0: -3, x1: 0, z1: 5, sweep: 0.6, speed: 0.4 },
      { x0: 8, z0: -2, x1: 8, z1: 4, blink: 2.4 }
    ],
    notes: [
      { x: -13, z: -10.55, text: 'STICKY NOTE (Delgado) — "Night 1. Silva says the trick is you stop being scared of the dark and start LIVING in it. Then she laughed for a really long time."' },
      { x: 23, z: -6.9, y: 0.95, text: 'DUTY ROSTER — "Lights: HALF (cost directive A.H.). Scanners: ROVING. Morale: see attached (nothing was attached)."' },
      { x: 27, z: 11.9, y: 0.8, text: 'FOLDED NOTE — "One more floor after this one. The last door wants a number, not a badge. You already have the number. You just don\'t know it yet. — M."' }
    ],
    restricted: [[17, -10, 14, 12]],
    dark: [[-30, 2, 5, 5], [10, 2, 5, 5], [-18, 15, 6, 4], [4, 15, 6, 4], [30, 3, 6, 6]],
    lights: [[-24, 0], [8, 0], [27, -10], [-13, -10], [17, -10]],
    windowsSide: 'N',
    cans: [[14.6, -3], [13.9, 7.6], [-27.4, 5.1]],
    fridge: { x: 23, z: -15 },
    exit: { x: -33.5, z: 16.5, r: 1.7 },
    objectives: {
      start: 'Night shift — most lights are off. Stay in the dark and find the GREEN badge.',
      toFridge: 'The breakroom, northeast — Vann stands on its door all night. A can (Q) is the only thing that moves him. Silva won\'t hear it; Vann will.',
      escape: 'Back to the elevator. The dark hides you. Sprinting does not.'
    },
    lunchName: 'THE NIGHT-SHIFT LUNCH'
  },

  // ------------------------------------------------------------------
  // L8 — COLD STORAGE (finale) — 80 x 44
  // ------------------------------------------------------------------
  {
    id: 'vault',
    name: 'COLD STORAGE',
    floorLabel: 'SUB-LEVEL B · UNLISTED',
    briefing: {
      from: 'Marv — waiting for you inside the service elevator',
      lines: [
        '"Lids: 1, 8, 7. And the year the founder walked into this building with a lunch his mother made him: 1987."',
        '"He never ate it. Success came that day, and he decided the hunger was the secret. The First Lunch went into the vault. The Program went into the handbook."',
        '"Everything down here is restricted. The black card lives in the cold archive, northwest. The vault door is south-facing."',
        '"Whatever you find in that fridge — you\'ll know what to do. Or you won\'t. Both are answers. — M."'
      ]
    },
    palette: {
      wall: 0x3d4a5f, accent: 0x7dd3fc, trim: 0x2a3342,
      carpetA: '#2e3644', carpetB: '#313a49', fog: 0x0a0e16,
      ceiling: '#3f4a5c', ceilingGrid: '#2e3745',
      sun: 0x9fc3e8, sunIntensity: 1.5, hemiSky: 0x8fb3d8, hemiGround: 0x1a2230
    },
    size: [80, 44],
    spawn: { x: -39, z: 21, yaw: -1.57 },
    walls: [],
    rooms: [
      { x: 0, z: -3, w: 16, d: 14, doors: [{ side: 'S', at: 0, door: true, locked: 'BLACK' }] },
      { x: -31, z: -15.5, w: 14, d: 9, doors: [{ side: 'E', at: 2, door: true }] },
      { x: 31, z: -15.5, w: 14, d: 9, doors: [{ side: 'W', at: 2, door: true }] },
      { x: -31, z: 15.5, w: 14, d: 9, doors: [{ side: 'N', at: 0, door: true }] },
      { x: 31, z: 15.5, w: 14, d: 9, doors: [{ side: 'N', at: -3, door: true }] }
    ],
    desks: [[-31, -17], [31, -17]],
    props: [
      { type: 'crate', x: 0, z: 12.5 },
      { type: 'crate', x: 4, z: 12.5 },
      { type: 'crate', x: -4, z: 12.5 },
      { type: 'crate', x: -26, z: -18 },
      { type: 'crate', x: -35, z: -12.5 },
      { type: 'shelf', x: -36, z: -18 },
      { type: 'filing', x: 36.5, z: -13 },
      { type: 'filing', x: 36.5, z: -14.6 },
      { type: 'shelf', x: 27, z: 18 },
      { type: 'shelf', x: 31, z: 18 },
      { type: 'shelf', x: 35, z: 18 },
      { type: 'crate', x: -28, z: 17.5 },
      { type: 'crate', x: -33, z: 17.5 },
      { type: 'crate', x: -30.5, z: 13 },
      { type: 'crate', x: 18, z: -19.5 },
      { type: 'crate', x: -18, z: 19.5 },
      { type: 'vend', x: -39.3, z: 8, rot: PI / 2 }
    ],
    doors: [],
    keycards: [{ id: 'BLACK', x: -31, z: -16.55, color: 0x64748b }],
    guards: [
      { name: 'Warden Kowalczyk', waypoints: [[-10, 6], [10, 6], [10, -12], [-10, -12]], viewDist: 15, patrolSpeed: 2.2, shirt: 0x1c2733, pants: 0x11161f },
      { name: 'Spectre East', waypoints: [[14, -21], [14, 21]], viewDist: 15, patrolSpeed: 2.2, shirt: 0x1c2733, pants: 0x11161f },
      { name: 'Spectre West', waypoints: [[-14, -21], [-14, 21]], viewDist: 15, patrolSpeed: 2.2, shirt: 0x1c2733, pants: 0x11161f },
      { name: 'Rover Six', waypoints: [[-18, -16], [18, -16]], viewDist: 14, patrolSpeed: 2.4, shirt: 0x1c2733, pants: 0x11161f },
      { name: 'Rover Seven', waypoints: [[-18, 16], [18, 16]], viewDist: 14, patrolSpeed: 2.4, shirt: 0x1c2733, pants: 0x11161f }
    ],
    cameras: [
      { x: 0, z: 5.4, facing: PI, arc: 0.6, range: 12 },
      { x: -12, z: -21.5, facing: PI, arc: 0.7, range: 11 },
      { x: 12, z: -21.5, facing: PI, arc: 0.7, range: 11 },
      { x: 0, z: 21.5, facing: 0, arc: 0.7, range: 11 },
      { x: 34, z: -21, facing: PI / 2, arc: 0.5, range: 10 }
    ],
    lasers: [
      { x0: -23.6, z0: -4, x1: -12, z1: -4, sweep: 0.45, speed: 0.3 },
      { x0: -14, z0: 2, x1: -8.4, z1: 2 },
      { x0: -23.6, z0: 8, x1: -12, z1: 8, sweep: -0.45, speed: 0.36 },
      { x0: 12, z0: -4, x1: 23.6, z1: -4, sweep: -0.45, speed: 0.3 },
      { x0: 8.4, z0: 2, x1: 14, z1: 2 },
      { x0: 12, z0: 8, x1: 23.6, z1: 8, sweep: 0.45, speed: 0.36 },
      { x0: -4, z0: -20.5, x1: -4, z1: -14, blink: 2.6 },
      { x0: 4, z0: -17, x1: 4, z1: -10.6, blink: 2.6 }
    ],
    notes: [
      { x: 31, z: -16.5, text: 'FINAL MEMO (B. Kowalczyk) — "Request DENIED for the 40th year: \'additional lock for the old fridge.\' Justification given: \'the hunger must remain possible.\' Signed A.H. I quit. Effective the moment someone reads this."' },
      { x: 0.8, z: -4.8, y: 0.03, text: 'HANDWRITTEN, 1987 — "If you are reading this, you got past everything I built to stop you. So it\'s yours now. All of it. The company, the hunger, the sandwich. Choose better than I did. — Aldous"' },
      { x: -36, z: -17.6, y: 1.1, text: 'ARCHIVE INDEX — "Aisle 1: Lunches, Confiscated (1987–2026). Aisle 2: Employees, Aligned. Aisle 3: Blue lids. So many blue lids."' }
    ],
    restricted: [[0, 0, 80, 44]],
    dark: [[-23, -11, 4, 4], [23, 11, 4, 4], [-24, 5, 4, 5], [24, -6, 4, 5]],
    lights: [[-14, 0], [14, 0], [0, -16], [0, 14], [-31, -15], [31, -15], [-31, 15], [31, 15]],
    windowsSide: null,
    cans: [[-38.5, 8.6], [1.3, 13.3], [17.2, -19]],
    fridge: { x: 0, z: -6 },
    exit: { x: -39.2, z: 21.2, r: 1.5 },
    exitLockdown: { x: 39, z: -21, r: 1.5 },
    objectives: {
      start: 'The BLACK card is in the cold archive, northwest. Everything down here is trespassing. Everything.',
      toFridge: 'The vault door, south side. Behind it: the First Lunch, 1987, never eaten.',
      escape: 'LOCKDOWN. The service elevator is sealed — freight elevator, NORTHEAST corner. RUN or GHOST, your call.'
    },
    finale: true,
    lunchName: 'THE FIRST LUNCH (1987)'
  }
];

export const ENDING_CEO = {
  title: 'THE CORNER OFFICE',
  body:
    'You carry the First Lunch to the surface, still wrapped, still perfect, still uneaten. ' +
    'By morning there is a memo with your name on it and a title nobody remembers creating: Chief Executive. ' +
    'Marv — Aldous — hands you the building with a nod and finally, after thirty-nine years, goes home. ' +
    'On your first day you install a lock on every fridge in the building. On your second day, you understand the founder completely: ' +
    'you are hungry, you are powerful, and you will never, ever eat.'
};

export const ENDING_LUNCH = {
  title: 'LUNCH BREAK',
  body:
    'You sit down on the vault floor, cross-legged under four furious cameras, and you eat the First Lunch. ' +
    'It is a sandwich. It is a very good sandwich. Somewhere upstairs, an alarm gives up. ' +
    'The Program ends the way all corporate mysticism ends: quietly, at lunch. ' +
    'Dorian finds you there, sits down, and splits his own lunch with you — the first one he has ever shared. ' +
    '"Finally," the intern says. "Someone who gets it." You are unemployed by Monday. You are free forever.'
};
