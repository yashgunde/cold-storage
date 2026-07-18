# COLD STORAGE

*A first-person office stealth game about the most morally bankrupt heist in corporate history: stealing the intern's lunch.*

You are Employee #7431 at **Halcyon Dynamics**. On your first day, someone takes your lunch from the communal fridge. What follows is a climb through the entire tower — promotion by promotion, fridge by fridge — toward Sub-Level B, where the company keeps the **First Lunch (1987, never eaten)** and the answer to why the intern's lunch is always, impossibly, perfect.

## How to run

**Double-click `PLAY.cmd`.** It installs dependencies on first run, builds the game, and opens it in your browser. Close the console window to stop the game.

Developers: `npm install`, then `npm run dev` (dev server) or `npm run build` + `npm run play`.

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse **or Arrow Keys** | Look |
| SHIFT (hold) | Sprint — fast but loud and suspicious |
| C or CTRL | Crouch — quiet, hides you behind low cover, but looks shifty |
| E | Interact (doors, fridges, keycards, notes) |
| R / N / M | Retry / Next shift / Lobby (after a mission ends) |

**Touchpad users:** many Windows touchpads ignore the pad while keys are held (palm rejection). Use the arrow keys to steer, or set *Settings → Bluetooth & devices → Touchpad → Touchpad sensitivity → Most sensitive*.

## How stealth works

You *work here* — walking upright through public areas makes you invisible. What gets you noticed: **crouching, sprinting, trespassing in restricted areas, and visibly carrying someone's lunch.** Guards escalate: curious (?) → investigating → chasing (!). If one reaches you, you're escorted to HR. Cameras sweep and page security; knee-height lasers sound the floor alarm. Every fridge grab puts the floor on edge for your escape. Finish a shift unseen for **GHOST CLEARANCE**.

## Shifts

1. **Orientation Day** (tutorial) — Floor 2
2. **The Bullpen** — Floor 3
3. **Middle Management** — Floor 7 · first cameras
4. **The Glass Floor** — Floor 12 · glass walls, executive assistants
5. **Research & Development** — Floor 21 · lasers, headphoned techs
6. **Cold Storage** — Sub-Level B · everything at once, then a choice

Collectible sticky notes carry the story. Progress and graphics settings save automatically (localStorage).

## Tech

TypeScript + Three.js + Vite. All art is procedural low-poly (no downloaded assets); all audio is synthesized with WebAudio. Targets 60 FPS at 1080p on a dedicated GPU — use the **GRAPHICS: HIGH/LOW** toggle in the lobby if needed.
