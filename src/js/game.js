// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const AMBUSH_TILES = 4;
const FLANK_TILES = 2;
const COWARD_RANGE = 8;
const COWARD_CORNER = { x: 26, y: 1 };
const PEN_EXIT = { x: 13, y: 11 }; // celda transitable justo sobre la puerta

const FRIGHTENED_FRAMES = 360;
const BLINK_FRAMES = 120;
const FRIGHTENED_SPEED = 0.05;
const EATEN_SPEED = 0.2;
const GHOST_POINTS = [ 200, 400, 800, 1600 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    elapsedFrames: 0,
    frightenedFrames: 0,
    ghostCombo: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseFrame: g.releaseFrame,
      mode: 'pen', // 'pen' -> 'leaving' -> 'active' -> 'frightened' -> 'eaten'
      home: { x: g.x, y: g.y },
      releaseDelay: g.releaseFrame,
    } ) ),
  };
}

function activateFrightened( game ) {
  game.frightenedFrames = FRIGHTENED_FRAMES;
  game.ghostCombo = 0;
  for ( const g of game.ghosts ) {
    if ( g.mode !== 'active' ) continue;
    g.dir = OPPOSITE[ g.dir ];
    g.mode = 'frightened';
    g.speed = FRIGHTENED_SPEED;
  }
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1) y, si no esta saliendo, por la puerta (3)
function isWall( grid, x, y, actor, ghostCanUseDoor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return actor !== 'ghost' || !ghostCanUseDoor;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor, ghostCanUseDoor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor, ghostCanUseDoor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 || tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += tile === 4 ? 50 : 10;
      game.dotsRemaining--;
      if ( tile === 4 ) activateFrightened( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function pacmanCell( actor ) {
  return { x: Math.round( actor.x ), y: Math.round( actor.y ) };
}

function aheadCell( p, tiles ) {
  const cell = pacmanCell( p );
  const d = DIRS[ p.dir ];
  return { x: cell.x + d.x * tiles, y: cell.y + d.y * tiles };
}

function ghostTarget( game, g ) {
  const pac = pacmanCell( game.pacman );

  if ( g.kind === 'chaser' ) return pac;
  if ( g.kind === 'ambusher' ) return aheadCell( game.pacman, AMBUSH_TILES );

  if ( g.kind === 'flanker' ) {
    const ahead = aheadCell( game.pacman, FLANK_TILES );
    const chaser = game.ghosts.find( ( other ) => other.kind === 'chaser' );
    const anchor = chaser ? pacmanCell( chaser ) : pac;
    return {
      x: ahead.x + ( ahead.x - anchor.x ),
      y: ahead.y + ( ahead.y - anchor.y ),
    };
  }

  const distance = Math.abs( pac.x - g.x ) + Math.abs( pac.y - g.y );
  return distance <= COWARD_RANGE ? COWARD_CORNER : pac;
}

function tunnelX( x, width ) {
  if ( x < 0 ) return x + width;
  if ( x >= width ) return x - width;
  return x;
}

// Primer paso de la ruta mas corta hasta el objetivo, respetando el tunel.
function shortestStep( game, g, target, ghostCanUseDoor ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;
  const start = pacmanCell( g );
  const goal = pacmanCell( target );
  const key = ( x, y ) => y * width + x;
  const visited = new Set( [ key( start.x, start.y ) ] );
  const queue = [ { x: start.x, y: start.y, firstDir: null } ];

  while ( queue.length ) {
    const node = queue.shift();
    if ( node.x === goal.x && node.y === goal.y ) return node.firstDir;

    for ( const dir of Object.keys( DIRS ) ) {
      const d = DIRS[ dir ];
      const nx = node.x + d.x;
      const ny = node.y + d.y;
      if ( !canMove( grid, node.x, node.y, dir, 'ghost', ghostCanUseDoor ) ) continue;
      const cellX = ny === TUNNEL_ROW ? tunnelX( nx, width ) : nx;
      const id = key( cellX, ny );
      if ( visited.has( id ) ) continue;
      visited.add( id );
      queue.push( { x: cellX, y: ny, firstDir: node.firstDir || dir } );
    }
  }

  return null;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;
  const leaving = g.mode === 'leaving';
  const target = leaving ? PEN_EXIT : ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => ( leaving || dir !== OPPOSITE[ g.dir ] ) &&
      canMove( grid, g.x, g.y, dir, 'ghost', leaving )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  if ( g.mode === 'frightened' ) {
    const pac = pacmanCell( game.pacman );
    const distance = ( dir ) => {
      const d = DIRS[ dir ];
      const nx = g.x + d.x;
      const ny = g.y + d.y;
      const cellX = ny === TUNNEL_ROW ? tunnelX( nx, width ) : nx;
      return Math.abs( cellX - pac.x ) + Math.abs( ny - pac.y );
    };
    let best = choices.includes( g.dir ) ? g.dir : choices[ 0 ];
    let bestDist = distance( best );
    for ( const dir of choices ) {
      const dist = distance( dir );
      if ( dist > bestDist ) {
        bestDist = dist;
        best = dir;
      }
    }
    g.dir = best;
    return;
  }

  if ( leaving || g.kind === 'chaser' ) {
    const step = shortestStep( game, g, target, leaving );
    if ( step && choices.includes( step ) ) {
      g.dir = step;
      return;
    }
    if ( !step ) return;
  }

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const cellX = ny === TUNNEL_ROW ? tunnelX( nx, width ) : nx;
    const dist = Math.abs( cellX - Math.round( target.x ) ) +
      Math.abs( ny - Math.round( target.y ) );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.mode === 'leaving' && g.x === PEN_EXIT.x && g.y === PEN_EXIT.y ) {
      g.mode = 'active';
      g.dir = 'left';
    }
    if ( g.mode === 'pen' ) {
      // Rebote vertical en la pen: invertir al chocar, sin decidir ruta.
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost', false ) ) g.dir = OPPOSITE[ g.dir ];
    } else {
      decideGhost( game, g );
    }
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost', g.mode === 'leaving' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.elapsedFrames = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.mode = 'pen';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.elapsedFrames++;
  if ( game.frightenedFrames > 0 ) {
    game.frightenedFrames--;
    if ( game.frightenedFrames === 0 ) {
      game.ghosts.forEach( ( g ) => {
        if ( g.mode !== 'frightened' ) return;
        g.mode = 'active';
        g.speed = GHOST_SPEED;
      } );
      game.ghostCombo = 0;
    }
  }
  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    if ( g.mode === 'pen' && game.elapsedFrames >= g.releaseFrame ) g.mode = 'leaving';
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
