# SPEC 03 — Power pellets esquina y modo asustado

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-23
> **Objective:** Incorporar cuatro power pellets en las esquinas del laberinto que activen un modo asustado de 360 frames en el que los fantasmas huyen, pueden ser comidos por una cadena de puntos y regresan a la pen antes de reanudar su IA.

## Por qué este spec

Los specs 01 y 02 dejaron explícitamente fuera los power pellets. Hoy `tile 2` es el único comestible y toda colisión con un fantasma quita una vida; este spec añade el estado que falta para que las esquinas del laberinto tengan efecto real.

## Scope

**In:**

- Cuatro power pellets en `(1,1)`, `(26,1)`, `(1,29)` y `(26,29)` como `tile 4` en `src/js/maze.js`.
- Dibujo de pelota grande en `src/js/render.js` y consumo con `+50` puntos en `movePacman()`.
- `dotsRemaining` incluye las cuatro pellets; la victoria sigue llegando al vaciar el grid.
- Modo asustado global de 360 frames, con parpadeo visual en los últimos 120.
- Inversión de dirección y huida determinista de los fantasmas `active`.
- Cadena de puntos `200/400/800/1600` al comer fantasmas asustados.
- Estado `eaten`: vuelta BFS a la celda de origen, espera con el delay original y salida normal.
- Reinicio del modo asustado y de la cadena al perder una vida.

**Out of scope (for future specs):**

- Fases globales `scatter`/`chase`.
- Parpadeo de las propias pellets, HUD del modo asustado o avisos de audio.
- Cambios en los `releaseFrame` iniciales ni en la IA de los specs 01 y 02.
- Persistencia de puntuación, niveles adicionales y tests automáticos.

## Data model

```js
// src/js/maze.js — 'o' = power pellet (4), '.' = dot (2)
// fila 1:  '#o...........##...........o#'
// fila 29: '#o........................o#'
function parseTile(ch) {
  if (ch === '#') return 1;
  if (ch === '.') return 2;
  if (ch === '-') return 3;
  if (ch === 'o') return 4;
  return 0;
}

// src/js/game.js — constantes nuevas
const FRIGHTENED_FRAMES = 360;
const BLINK_FRAMES = 120;
const FRIGHTENED_SPEED = 0.05;
const EATEN_SPEED = 0.2;
const GHOST_POINTS = [200, 400, 800, 1600];

// Estado nuevo en createGame()
{
  frightenedFrames: 0, // frames restantes; 0 = inactivo
  ghostCombo: 0,       // fantasmas comidos en el modo actual
  ghosts: GHOST_STARTS.map((g) => ({
    x: g.x, y: g.y,
    dir: 'up',
    speed: GHOST_SPEED,
    kind: g.kind,
    releaseFrame: g.releaseFrame,
    mode: 'pen', // 'pen' | 'leaving' | 'active' | 'frightened' | 'eaten'
    home: { x: g.x, y: g.y },       // destino del estado 'eaten'
    releaseDelay: g.releaseFrame,   // 0/180/360/540 tras el regreso
  })),
}
```

Convenciones: coordenadas `(x, y)` con origen arriba-izquierda; `dotsRemaining` cuenta `tile 2` y `tile 4`; la puerta (`tile 3`) solo es transitable en `leaving` y `eaten`.

## Implementation plan

1. En `src/js/maze.js`, añadir `'o'` a `MAZE_STR` en las cuatro esquinas y `parseTile()` → `4`. En `src/js/render.js`, pintar `tile 4` como círculo de radio ~6. Manual: cuatro pelotas grandes visibles y el juego carga sin errores.
2. En `src/js/game.js`, contar `v === 2 || v === 4` en `createGame()` y consumir `tile 4` en `movePacman()` con `+50` y `dotsRemaining--`. Manual: comer una esquina puntúa 50 y la victoria sigue funcionando.
3. En `src/js/game.js`, declarar las constantes y los campos `frightenedFrames`, `ghostCombo`, `home` y `releaseDelay`. Al comer una pellet: sumar 50, fijar `frightenedFrames = 360`, `ghostCombo = 0`, invertir `dir` de los `active` y pasarlos a `frightened` con `speed = 0.05`. Si el modo ya estaba activo, solo se reinician temporizador y cadena, sin segunda inversión. Manual: los fantasmas activos giran 180°.
4. En `update()`, decrementar `frightenedFrames` al inicio de cada frame; al llegar a 0, devolver los `frightened` a `active` con `speed = GHOST_SPEED` y poner `ghostCombo = 0`. En `decideGhost()`, añadir la rama `frightened`: elegir el vecino transitable que maximice la distancia Manhattan a la celda de Pac-Man, sin inversión salvo callejón. Manual: huida de ~6 s y reanudación de la IA de SPEC 01.
5. En `update()`, tratar la colisión: `frightened` → sumar `GHOST_POINTS[min(ghostCombo,3)]`, incrementar `ghostCombo` y pasar a `eaten` con `speed = EATEN_SPEED`; `eaten` → sin efecto; los demás → quitar vida como hoy. En `moveGhost()`, usar `shortestStep(game, g, g.home, true)` para `eaten` y, al llegar, fijar `mode = 'pen'`, `dir = 'up'`, `speed = GHOST_SPEED` y `releaseFrame = game.elapsedFrames + g.releaseDelay`. Extender `resetPositions()` con `frightenedFrames = 0` y `ghostCombo = 0`. Manual: puntos encadenados, ojos volviendo a la pen y salida escalonada.
6. En `src/js/render.js`, dibujar `frightened` en azul con ojos blancos, alternar azul/blanco cada ~10 frames cuando `game.frightenedFrames <= BLINK_FRAMES`, y dibujar `eaten` solo como ojos. Manual: verificación visual completa en navegador.

## Acceptance criteria

- [ ] Al iniciar aparecen cuatro power pellets en `(1,1)`, `(26,1)`, `(1,29)` y `(26,29)`, más grandes que los dots.
- [ ] Comer una power pellet suma 50 puntos, la elimina del grid y reduce `dotsRemaining` en 1.
- [ ] Al comerla, los fantasmas `active` invierten dirección, pasan a `frightened` y usan `speed = 0.05`; los de `pen`/`leaving` no cambian.
- [ ] Durante 360 frames los fantasmas asustados eligen el vecino que más aleja de Pac-Man; al expirar vuelven a su IA y a `speed = 0.1`.
- [ ] En los últimos 120 frames el cuerpo asustado alterna azul y blanco.
- [ ] Comer cuatro fantasmas asustados seguidos suma exactamente 200, 400, 800 y 1600 puntos, sin perder vida.
- [ ] Un fantasma comido se dibuja solo como ojos, vuelve a su celda inicial cruzando la puerta y espera 0/180/360/540 frames antes de salir.
- [ ] Chocar con un fantasma en estado `eaten` no quita vida.
- [ ] Comer una segunda power pellet con el modo activo reinicia el temporizador a 360 y la cadena a 200 puntos, sin invertir dos veces la dirección.
- [ ] Al perder una vida, `frightenedFrames` y `ghostCombo` vuelven a 0 y los cuatro fantasmas reinician su salida escalonada.
- [ ] Comer las cuatro pellets cuenta para la victoria: al llegar `dotsRemaining` a 0 aparece el overlay `GANASTE`.
- [ ] La partida sigue cargando sin errores en la consola del navegador.

## Decisions

- **Sí:** `tile 4` con carácter `'o'`. Reutiliza el flujo existente de `grid`, `dotsRemaining` y `drawDots()` sin arrays paralelos.
- **Sí:** 50 puntos y cuenta como dot. Mantiene intacta la condición de victoria.
- **Sí:** 360 frames con 120 de parpadeo. 6 s de efecto y 2 s de aviso a 60 fps.
- **Sí:** inversión + huida por distancia Manhattan. Es la lectura arcade de «comportamiento correspondiente»; el empate se resuelve conservando la dirección actual si es válida.
- **Sí:** cadena `200/400/800/1600`. Recompensa comer varios fantasmas dentro del mismo modo.
- **Sí:** `eaten` con BFS hasta `home` y reingreso con el delay original. Evita que el fantasma reaparezca encima de Pac-Man y conserva los tiempos de SPEC 02.
- **Sí:** `0.05` asustado y `0.2` ojos. Huida lenta y regreso rápido, como en el arcade.
- **Sí:** reinicio completo al perder vida. Coherente con el criterio ya aprobado en SPEC 01.
- **No:** parpadeo de las pellets ni HUD del modo. No cambian las reglas y mantienen el alcance acotado.
- **No:** alterar `pen`/`leaving` ni las fases `scatter`/`chase`. Son decisiones cerradas en specs anteriores o merecen su propio spec.

## Risks

| Risk | Mitigation |
| --- | --- |
| Una pellet se come mientras hay fantasmas `eaten` | El estado `eaten` no se transforma: sigue su BFS a la pen y conserva su velocidad. |
| El BFS de regreso atraviesa la puerta y la pen | `shortestStep()` ya acepta `ghostCanUseDoor`; se pasa `true` solo para `eaten`. |
| El parpadeo depende del frame de dibujo y no del de juego | Usar `game.frightenedFrames`, que se reinicia en cada activación y al perder vida. |
| Fantasma asustado acorralado en un callejón | Se mantiene la regla existente de permitir inversión de 180° sin salida. |

## What is **not** in this spec

- Fases globales `scatter`/`chase`, parpadeo de las pellets, HUD del modo y audio.
- Cambios en los tiempos de salida ni en la IA aprobada en SPEC 01 y SPEC 02.
- Persistencia, nuevos niveles y tests automáticos.

Cada uno, si llega, va en su propio spec.
