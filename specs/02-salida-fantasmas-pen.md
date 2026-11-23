# SPEC 02 — Salida de la pen por estado de liberación

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-11-23
> **Objective:** Que cada fantasma salga de la pen al cumplir su `releaseFrame` mediante un estado de salida con BFS y luego retome su comportamiento establecido.

## Por qué este spec

Solo el `chaser` usa BFS; los otros tres eligen dirección por distancia Manhattan greedy. La pen es una concavidad: salir exige subir (alejarse temporalmente de Pac-Man), así que el greedy nunca cruza la puerta y los fantasmas quedan encerrados para siempre aunque `released` sea `true`.

## Scope

**In:**

- Estado por fantasma `mode: 'pen' | 'leaving' | 'active'` que sustituye al booleano `released`.
- Rebote vertical en la celda de inicio mientras `mode === 'pen'`.
- Al cumplir `releaseFrame`: `mode = 'leaving'` y navegación BFS hasta `PEN_EXIT = { x: 13, y: 11 }`, permitiendo inversión de dirección.
- Al llegar a `PEN_EXIT`: `mode = 'active'`, `dir = 'left'` y comportamiento normal de SPEC 01.
- Puerta (`tile 3`) transitable solo durante `'leaving'`; pared en `'pen'` y `'active'`.
- `resetPositions()` devuelve a los cuatro a `'pen'` con los mismos tiempos.

**Out of scope (for future specs):**

- Contador de dots para liberación (estilo arcade original).
- Regreso a la pen tras ser comido (depende de power pellets).
- Fases `scatter`/`chase`, velocidades diferenciadas, cambios de `releaseFrame`.

## Data model

```js
// src/js/game.js
const PEN_EXIT = { x: 13, y: 11 }; // celda transitable justo sobre la puerta

// Cada fantasma en createGame() y resetPositions():
{
  x: g.x, y: g.y,
  dir: 'up',
  speed: GHOST_SPEED,
  kind: g.kind,
  releaseFrame: g.releaseFrame,
  mode: 'pen', // 'pen' -> 'leaving' -> 'active'
}
```

`GHOST_STARTS` en `src/js/maze.js` no cambia. El parámetro `ghostCanUseDoor` de `isWall`/`canMove`/`shortestStep` se mantiene; ahora se pasa `g.mode === 'leaving'`.

## Implementation plan

1. En `src/js/game.js`: añadir `PEN_EXIT`, sustituir `released` por `mode` en `createGame()` y `resetPositions()`, y cambiar `update()` para pasar de `'pen'` a `'leaving'` al alcanzar `releaseFrame`. Reemplazar los usos de `g.released` por `g.mode === 'leaving'`. Manual: el rojo sigue saliendo; los demás aún no.
2. En `moveGhost()`: si `mode === 'pen'`, rebote vertical — alinear, y si no puede seguir en `dir`, invertirla (`up` ↔ `down`); no llamar a `decideGhost()`. Manual: los tres esperan oscilando en su celda.
3. En `decideGhost()`: si `mode === 'leaving'`, usar `shortestStep(game, g, PEN_EXIT, true)` sin la regla de no-inversión; en `moveGhost()`, al estar alineado en `PEN_EXIT`, pasar a `'active'` con `dir = 'left'`. Manual: los cuatro salen escalonados y retoman su IA.

## Acceptance criteria

- [ ] Al iniciar, los cuatro fantasmas están en la pen; el rojo cruza la puerta de inmediato.
- [ ] Cian, rosa y naranja rebotan verticalmente en su celda de inicio hasta su frame de liberación.
- [ ] Ningún fantasma cruza la puerta antes de su `releaseFrame` (180/360/540).
- [ ] Tras liberarse, cada fantasma alcanza `(13,11)` y sale de la pen (verificable en < 2 s tras su frame).
- [ ] Ya fuera, cada uno sigue su comportamiento: rojo BFS, cian 4 celdas adelante, rosa vector desde el rojo, naranja esquina `(26,1)` a ≤ 8 celdas.
- [ ] Ningún fantasma vuelve a entrar a la pen tras salir.
- [ ] Tras perder una vida, los cuatro vuelven a la pen, rebotan y salen de nuevo con los mismos tiempos.
- [ ] La partida termina en `won`/`lost` como antes y no hay errores en consola.

## Decisions

- **Sí:** `mode` tri-estado en lugar de `released`. La puerta solo es transitable durante la salida; evita re-encierro del greedy.
- **Sí:** reutilizar `shortestStep()` (BFS) para la salida. Ya existe y probado con el `chaser`.
- **Sí:** permitir inversión durante `'leaving'`. La ruta óptima puede exigir girar 180° dentro de la pen.
- **Sí:** rebote vertical en espera. Fiel al original y evita amontonamiento.
- **Sí:** `dir = 'left'` al salir. Coherente con el arcade; el no-inversión arranca limpio.
- **No:** BFS permanente para los cuatro. Cambiaría el comportamiento aprobado en SPEC 01.
- **No:** ruta scriptada a la puerta. Más casos borde que reutilizar el BFS.
- **No:** liberación por contador de dots. Otro spec si llega.

## Risks

| Risk | Mitigation |
| --- | --- |
| Inversión visible durante la salida | Tramo corto (2–4 celdas); aceptable. |
| Fantasmas solapados al salir en cadena | Tiempos separados 180 frames; la salida dura ~40 frames. |
| `PEN_EXIT` sobre una celda con dot | Los fantasmas no comen dots; no afecta. |

## What is **not** in this spec

- Liberación por dots, regreso a la pen tras ser comido, fases globales y cambios de tiempos.

Cada uno, si llega, va en su propio spec.