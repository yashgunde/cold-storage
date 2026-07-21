# COLD STORAGE

*A first-person office stealth game about the most morally bankrupt heist in corporate history: stealing the intern's lunch. Fully vibecoded with Claude lol*

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
| E | Interact (doors, fridges, keycards, notes, **soda cans**) |
| Q | Throw a pocketed can — the clatter lures guards away. Cans are scavenged (vending machines, bins) and can be picked back up |
| R / N / M | Retry / Next shift / Lobby (after a mission ends) |

**Touchpad users:** many Windows touchpads ignore the pad while keys are held (palm rejection). Use the arrow keys to steer, or set *Settings → Bluetooth & devices → Touchpad → Touchpad sensitivity → Most sensitive*.

## How stealth works

You *work here* — walking upright through public areas makes you invisible. What gets you noticed: **crouching, sprinting, trespassing in restricted areas, throwing things, and visibly carrying someone's lunch.** Guards escalate like people do: a double-take stare (?) → walking over → **searching the hiding spots nearby** → chasing (!). If an officer reaches you, you're escorted to HR. Civilians never tackle — they **run and fetch security**, which is worse. A guard who shouts pulls every colleague in earshot toward *you*; a guard who finds nothing stays **wary** for a while.

Guards see like humans: a narrow cone of real attention plus wide peripheral vision that mostly catches fast movement. They hear imprecisely at distance — but a thrown can is unmistakable, and they walk straight to it… unless they *watched you throw it*. Repeat the can trick on the same guard and it wears thin.

**Posted guards** stand on one door all shift and never leave. A can (Q) is the only thing that moves them.

## Shifts

1. **Orientation Day** (tutorial) — Floor 2
2. **The Bullpen** — Floor 3
3. **Middle Management** — Floor 7 · first cameras
4. **Facilities** — Floor 9 · first posted guard; learn the can lure
5. **The Glass Floor** — Floor 12 · glass walls, executive assistants
6. **The Stacks** — Floor 16 · dark archive, an archivist who hears everything
7. **Research & Development** — Floor 21 · lasers, headphoned techs
8. **The Night Shift** — Sub-Level A · darkness is cover
9. **Cold Storage** — Sub-Level B · everything at once, then a choice

Collectible sticky notes carry the story. Progress and graphics settings save automatically (localStorage).

## Tech

TypeScript + Three.js + Vite. All art is procedural low-poly (no downloaded assets); sound effects and voices are synthesized with WebAudio. Targets 60 FPS at 1080p on a dedicated GPU — use the **GRAPHICS: HIGH/LOW** toggle in the lobby if needed.

## Credits

Background music: **"Girls Rituals" by HRT** (slowed + reverb edit), streamed live from YouTube via the official IFrame Player API — nothing is downloaded or bundled. Edit uploaded by [FontaineFuturistics](https://www.youtube.com/@FontaineFuturistics_x): https://www.youtube.com/watch?v=tKTgdMHV8Ks
