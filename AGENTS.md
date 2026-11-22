# AGENTS.md

## Project
- Vanilla JS Pac-Man MVP; no build system, package manager, linter, or tests.
- Entry point: `src/index.html` (open directly in browser or serve `src/` statically).

## Structure
- `src/index.html`: canvas + overlay markup; script load order matters.
- `src/js/maze.js`: pristine maze data/globals (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`).
- `src/js/game.js`: game state/rules; exposes `window.createGame`, `window.update`, `window.DIRS`.
- `src/js/render.js`: canvas rendering; exposes `window.draw`.
- `src/js/main.js`: input, loop, overlays; wires globals together.
- `src/css/style.css`: UI styling.

## Code conventions
- Plain browser scripts (no ES modules/imports). Shared APIs are globals on `window`.
- Keep script order in `index.html`: `maze.js` -> `game.js` -> `render.js` -> `main.js`.
- `MAZE` is pristine; gameplay mutates `game.grid` (copied in `createGame`).
- Tile codes: `0` empty, `1` wall, `2` dot, `3` ghost door.
- Canvas/tile geometry is coupled: `TILE=20`, maze `28x31`, canvas `560x620`.
- UI text is Spanish; code identifiers in English; comments in Spanish only when useful.

## Spec workflow
- Repo includes local skills in `.agents/skills/` (`spec`, `spec-impl`) and `skills-lock.json`.
- `README.md` notes Spec Driven Development; if using specs, follow those skill workflows rather than inventing a new format.
