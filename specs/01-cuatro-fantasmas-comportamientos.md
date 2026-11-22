# SPEC 01 — Cuatro fantasmas con comportamientos propios

> **Status:** Aprobado
> **Depends on:** Ninguna
> **Date:** 2026-11-22
> **Objective:** Incorporar un cuarto fantasma y dotar a los cuatro de IA distinta, con un perseguidor agresivo que calcula la ruta más corta hasta Pac-Man.

## Por qué este spec

Hoy solo existen `hunter` (distancia de Manhattan) y `random` en `src/js/game.js`. El objetivo exige cuatro personalidades reconocibles y una persecución que no se quede atrapada, por lo que se sustituye la heurística actual por decisión de ruta.

## Scope

**In:**

- Cuarto fantasma en `GHOST_STARTS` con posición, `kind` y frame de salida propios.
- Cuatro `kind`: `chaser`, `ambusher`, `flanker`, `coward`.
- Salida escalonada de la pen a 0, 180, 360 y 540 frames (~0, 3, 6 y 9 s a 60 fps).
- Bloqueo de la puerta (`tile 3`) hasta la liberación de cada fantasma.
- BFS con envolvente de túnel para el `chaser`.
- Reinicio del temporizador y de los cuatro fantasmas al perder una vida.

**Out of scope (for future specs):**

- Power pellets, modo asustado y comer fantasmas.
- Fases globales `scatter`/`chase`.
- Velocidades diferenciadas, HUD con nombres y persistencia.
- Tests automáticos o exponer `window.game`.

## Data model

```js
// src/js/maze.js
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'chaser',   releaseFrame: 0 },
  { x: 13, y: 14, kind: 'ambusher', releaseFrame: 180 },
  { x: 14, y: 14, kind: 'flanker',  releaseFrame: 360 },
  { x: 15, y: 14, kind: 'coward',   releaseFrame: 540 },
];

// src/js/game.js — estado añadido
{
  elapsedFrames: 0,
  ghosts: GHOST_STARTS.map((g) => ({
    x: g.x,
    y: g.y,
    dir: 'up',
    speed: GHOST_SPEED, // 0.1 para los cuatro
    kind: g.kind,
    releaseFrame: g.releaseFrame,
    released: false,
  })),
}

// Constantes de decisión
const AMBUSH_TILES = 4;
const FLANK_TILES = 2;
const COWARD_RANGE = 8;
const COWARD_CORNER = { x: 26, y: 1 };
```

Convenciones: coordenadas `(x, y)` con origen arriba-izquierda; el BFS considera vecinos de `(0,14)` y `(27,14)` como conectados por el túnel.

## Implementation plan

1. Ampliar `GHOST_STARTS` en `src/js/maze.js` a las cuatro entradas de la fila 14, con `kind` y `releaseFrame`. Al iniciar aparecen cuatro fantasmas con los cuatro colores.
2. Añadir `elapsedFrames` en `createGame()` y `released: false` en cada fantasma; incrementar el contador en `update()` y marcar `released` al alcanzar `releaseFrame`.
3. Tratar `tile 3` como pared para fantasmas no liberados y extender `resetPositions()` para devolver los cuatro a `(12..15, 14)`, con `dir: 'up'`, `released: false` y `elapsedFrames = 0`.
4. Sustituir la rama `hunter` por BFS desde la celda del fantasma hasta la celda redondeada de Pac-Man. El primer paso debe pertenecer a los candidatos válidos de `decideGhost()`; si no hay ruta, se conserva la selección actual.
5. Implementar los objetivos de `ambusher` (4 celdas por delante de `p.dir`), `flanker` (2 celdas por delante más el vector desde el `chaser`) y `coward` (esquina `(26,1)` si está a ≤ 8 celdas; si no, la celda de Pac-Man). Elegir vecino por distancia de Manhattan, con la regla actual de no invertir salvo callejón.
6. Confirmar que `GHOST_COLORS` de `src/js/render.js` ya cubre los cuatro índices; no se modifica el archivo.

## Acceptance criteria

- [ ] Al iniciar aparecen cuatro fantasmas en `(12,14)`, `(13,14)`, `(14,14)` y `(15,14)` con los colores rojo, cian, rosa y naranja.
- [ ] El rojo cruza la puerta desde el inicio; el cian no antes de ~3 s, el rosa de ~6 s y el naranja de ~9 s.
- [ ] Ningún fantasma cruza la puerta antes de su frame de liberación.
- [ ] El rojo recalcula la ruta hacia Pac-Man en cada intersección y no se queda detenido en un callejón.
- [ ] El cian gira para cortar el paso unas 4 celdas por delante de Pac-Man.
- [ ] El rosa se sitúa en el lado opuesto al fantasma rojo respecto de Pac-Man.
- [ ] El naranja se retira hacia `(26,1)` cuando Pac-Man está a 8 celdas o menos y vuelve a acercarse cuando se aleja.
- [ ] Los cuatro mantienen `speed = 0.1`.
- [ ] Tras una colisión, los cuatro vuelven a la pen y cian/rosa/naranja vuelven a esperar 3/6/9 s antes de cruzar la puerta.
- [ ] La partida sigue terminando en `won`/`lost` como antes y la consola no muestra errores.

## Decisions

- **Sí:** `chaser`, `ambusher`, `flanker`, `coward`. Identificadores en inglés, coherentes con el código; sustituyen a `hunter`/`random`.
- **Sí:** BFS para `chaser`. "Agresivo" significa ruta óptima real, no solo distancia Manhattan.
- **Sí:** conservar la regla de no invertir dirección salvo callejón. Evita vaivenes; el BFS se aplica sobre los primeros pasos válidos.
- **Sí:** temporizador en frames, no en milisegundos. El bucle ya es por frame y no hace falta `performance.now()`.
- **Sí:** reinicio completo al perder vida. Cada vida empieza en las mismas condiciones.
- **Sí:** colores por índice en `render.js`. Ya existen cuatro y el orden de `GHOST_STARTS` es fijo.
- **No:** power pellets, modo asustado ni comer fantasmas. Van en otro spec.
- **No:** fases `scatter`/`chase` globales. Cada fantasma mantiene una sola regla.
- **No:** velocidades distintas. La diferencia es táctica, no numérica.
- **No:** `window.game` ni framework de tests. Verificación manual en navegador.

## Risks

| Risk | Mitigation |
| --- | --- |
| BFS en cada intersección | Grid de 28x31 y cuatro actores: coste trivial. Si se midiera, cachear por frame. |
| Fantasmas solapados en la pen | Celdas iniciales distintas y regla de no inversión. |
| Objetivos virtuales dentro de paredes | Se usan solo como referencia; el vecino elegido siempre es transitable. |
| `requestAnimationFrame` no garantiza 60 fps | Los segundos son aproximados; la verdadera regla son los frames. |

## What is **not** in this spec

- Power pellets, modo asustado y fantasmas comibles.
- Fases globales `scatter`/`chase`.
- Velocidades diferenciadas, nombres en el HUD, persistencia y tests automáticos.

Cada uno, si llega, va en su propio spec.
