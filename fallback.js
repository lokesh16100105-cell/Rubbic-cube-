/* ═══════════════════════════════════════════════════════════
   fallback.js  ·  Pure JS Rubik's Cube fallback for non-WebGL devices
═══════════════════════════════════════════════════════════════════ */
'use strict';

const FallbackGame = (() => {
  const FACE = { U:0, R:1, F:2, D:3, L:4, B:5 };
  const FACE_LABELS = ['Up', 'Right', 'Front', 'Down', 'Left', 'Back'];
  const FACE_NAMES = ['U','R','F','D','L','B'];
  const COLORS = ['#ffffff', '#ff6f00', '#00a958', '#ffdd00', '#cc0000', '#0046ad'];
  const MOVE_DEFS = {
    R:  { axis:'x', val: 1, dir:-1 }, Rp: { axis:'x', val: 1, dir: 1 }, R2: { axis:'x', val: 1, dir:-1, double:true },
    L:  { axis:'x', val:-1, dir: 1 }, Lp: { axis:'x', val:-1, dir:-1 }, L2: { axis:'x', val:-1, dir: 1, double:true },
    U:  { axis:'y', val: 1, dir:-1 }, Up: { axis:'y', val: 1, dir: 1 }, U2: { axis:'y', val: 1, dir:-1, double:true },
    D:  { axis:'y', val:-1, dir: 1 }, Dp: { axis:'y', val:-1, dir:-1 }, D2: { axis:'y', val:-1, dir: 1, double:true },
    F:  { axis:'z', val: 1, dir:-1 }, Fp: { axis:'z', val: 1, dir: 1 }, F2: { axis:'z', val: 1, dir:-1, double:true },
    B:  { axis:'z', val:-1, dir: 1 }, Bp: { axis:'z', val:-1, dir:-1 }, B2: { axis:'z', val:-1, dir: 1, double:true },
  };
  const MOVE_KEYS = ['R','Rp','R2','L','Lp','L2','U','Up','U2','D','Dp','D2','F','Fp','F2','B','Bp','B2'];

  let cubies = [];
  let moveCount = 0;
  let undoStack = [];
  let redoStack = [];
  let lastMove = '--';

  let container = null;
  let statusEl = null;
  let countEl = null;
  let lastMoveEl = null;
  let faceCells = [];

  const _buildCubies = () => {
    cubies = [];
    for(let x=-1; x<=1; x++){
      for(let y=-1; y<=1; y++){
        for(let z=-1; z<=1; z++){
          const stickers = {};
          if(x ===  1) stickers['+X'] = FACE.R;
          if(x === -1) stickers['-X'] = FACE.L;
          if(y ===  1) stickers['+Y'] = FACE.U;
          if(y === -1) stickers['-Y'] = FACE.D;
          if(z ===  1) stickers['+Z'] = FACE.F;
          if(z === -1) stickers['-Z'] = FACE.B;
          cubies.push({ pos:{ x,y,z }, stickers });
        }
      }
    }
  };

  const _copyPos = p => ({ x:p.x, y:p.y, z:p.z });

  const _rotateVector = (dir, axis, sign) => {
    const v = { x:0, y:0, z:0 };
    v[dir.slice(1).toLowerCase()] = dir[0] === '+' ? 1 : -1;
    let nx = v.x, ny = v.y, nz = v.z;
    if(axis === 'x'){
      if(sign === 1){ ny = -v.z; nz = v.y; }
      else          { ny = v.z; nz = -v.y; }
    } else if(axis === 'y'){
      if(sign === 1){ nx = v.z; nz = -v.x; }
      else          { nx = -v.z; nz = v.x; }
    } else if(axis === 'z'){
      if(sign === 1){ nx = -v.y; ny = v.x; }
      else          { nx = v.y; ny = -v.x; }
    }
    if(nx === 1) return '+X'; if(nx === -1) return '-X';
    if(ny === 1) return '+Y'; if(ny === -1) return '-Y';
    if(nz === 1) return '+Z'; if(nz === -1) return '-Z';
    return dir;
  };

  const _rotatePoint = (pos, axis, sign) => {
    let { x, y, z } = pos;
    if(axis === 'x'){
      if(sign === 1){ [y, z] = [-z, y]; }
      else          { [y, z] = [z, -y]; }
    } else if(axis === 'y'){
      if(sign === 1){ [x, z] = [z, -x]; }
      else          { [x, z] = [-z, x]; }
    } else if(axis === 'z'){
      if(sign === 1){ [x, y] = [-y, x]; }
      else          { [x, y] = [y, -x]; }
    }
    return { x, y, z };
  };

  const _faceIndex = dir => {
    if(dir === '+Y') return FACE.U;
    if(dir === '-Y') return FACE.D;
    if(dir === '+X') return FACE.R;
    if(dir === '-X') return FACE.L;
    if(dir === '+Z') return FACE.F;
    if(dir === '-Z') return FACE.B;
    return 0;
  };

  const _faceOffset = (face, pos) => {
    let row = 0, col = 0;
    switch(face){
      case FACE.U:
        row = -pos.z + 1; col = pos.x + 1; break;
      case FACE.D:
        row = pos.z + 1; col = pos.x + 1; break;
      case FACE.F:
        row = 1 - pos.y; col = pos.x + 1; break;
      case FACE.B:
        row = 1 - pos.y; col = 1 - pos.x; break;
      case FACE.R:
        row = 1 - pos.y; col = 1 - pos.z; break;
      case FACE.L:
        row = 1 - pos.y; col = pos.z + 1; break;
    }
    return row * 3 + col;
  };

  const _updateDisplay = () => {
    const facelets = new Array(54).fill(null);
    cubies.forEach(c => {
      Object.entries(c.stickers).forEach(([dir, face]) => {
        const index = _faceOffset(_faceIndex(dir), c.pos);
        facelets[face * 9 + index] = face;
      });
    });
    faceCells.forEach((cell, idx) => {
      const face = facelets[idx];
      cell.style.background = face !== null ? COLORS[face] : '#141428';
      cell.textContent = '';
    });
  };

  const _setStatus = (message) => {
    if(statusEl) statusEl.textContent = message;
    if(countEl) countEl.textContent = moveCount;
    if(lastMoveEl) lastMoveEl.textContent = lastMove;
  };

  const _inverseMove = name => {
    if(name.endsWith('2')) return name;
    if(name.endsWith('p')) return name.slice(0, -1);
    return `${name}p`;
  };

  const _rotateLayer = (axis, value, sign) => {
    cubies = cubies.map(c => {
      if(c.pos[axis] !== value) return c;
      const nextPos = _rotatePoint(c.pos, axis, sign);
      const nextStickers = {};
      Object.entries(c.stickers).forEach(([dir, color]) => {
        nextStickers[_rotateVector(dir, axis, sign)] = color;
      });
      return { pos: nextPos, stickers: nextStickers };
    });
  };

  const _checkSolved = () => {
    const faceColors = Array(6).fill(null).map(() => new Set());
    cubies.forEach(c => {
      Object.entries(c.stickers).forEach(([dir, face]) => {
        faceColors[face].add(face);
      });
    });
    const solved = faceColors.every(set => set.size === 1);
    if(solved) _setStatus('Solved!');
    return solved;
  };

  const init = (target) => {
    container = target;
    if(!container) return;
    container.id = 'fallbackGame';
    container.classList.add('fallback-ui');
    container.innerHTML = `
      <div class="fallback-panel">
        <div class="fallback-header">
          <div>
            <h1>Rubik's Cube Fallback</h1>
            <p>Play this version on any browser. Use the buttons below to turn faces, scramble, and solve.</p>
          </div>
          <div class="fallback-meta">
            <div><strong>Moves</strong><span id="fbMoves">0</span></div>
            <div><strong>Last</strong><span id="fbLastMove">--</span></div>
          </div>
        </div>
        <div class="fallback-body">
          <div class="fallback-grid" id="fbFaces"></div>
          <div class="fallback-actions">
            <div class="fallback-controls">
              <button data-move="U">U</button>
              <button data-move="Up">U'</button>
              <button data-move="U2">U2</button>
              <button data-move="D">D</button>
              <button data-move="Dp">D'</button>
              <button data-move="D2">D2</button>
              <button data-move="L">L</button>
              <button data-move="Lp">L'</button>
              <button data-move="L2">L2</button>
              <button data-move="R">R</button>
              <button data-move="Rp">R'</button>
              <button data-move="R2">R2</button>
              <button data-move="F">F</button>
              <button data-move="Fp">F'</button>
              <button data-move="F2">F2</button>
              <button data-move="B">B</button>
              <button data-move="Bp">B'</button>
              <button data-move="B2">B2</button>
            </div>
            <div class="fallback-footer">
              <button id="fbScramble" class="abtn primary">Scramble</button>
              <button id="fbReset" class="abtn">Reset</button>
              <button id="fbUndo" class="abtn">Undo</button>
              <button id="fbRedo" class="abtn">Redo</button>
            </div>
            <div class="fallback-status"><span id="fbStatus">Ready to play</span></div>
          </div>
        </div>
      </div>
    `;

    const faceGrid = document.getElementById('fbFaces');
    faceCells = [];
    for(let face=0; face<6; face++){
      const faceBox = document.createElement('div');
      faceBox.className = 'face-panel';
      faceBox.innerHTML = `<div class="face-label">${FACE_LABELS[face]}</div>`;
      const grid = document.createElement('div');
      grid.className = 'face-grid';
      for(let i=0; i<9; i++){
        const cell = document.createElement('div');
        cell.className = 'face-cell';
        grid.appendChild(cell);
        faceCells.push(cell);
      }
      faceBox.appendChild(grid);
      faceGrid.appendChild(faceBox);
    }

    statusEl = container.querySelector('#fbStatus');
    countEl = container.querySelector('#fbMoves');
    lastMoveEl = container.querySelector('#fbLastMove');

    container.querySelectorAll('[data-move]').forEach(btn => {
      btn.addEventListener('click', () => _applyMove(btn.dataset.move));
    });
    container.querySelector('#fbScramble').addEventListener('click', () => _scramble());
    container.querySelector('#fbReset').addEventListener('click', () => _reset());
    container.querySelector('#fbUndo').addEventListener('click', () => _undo());
    container.querySelector('#fbRedo').addEventListener('click', () => _redo());

    _reset();
  };

  const _reset = () => {
    _buildCubies();
    moveCount = 0;
    undoStack = [];
    redoStack = [];
    lastMove = '--';
    _updateDisplay();
    _setStatus('Ready to play');
  };

  const _applyMove = (name, save=true) => {
    const def = MOVE_DEFS[name];
    if(!def) return;
    const turns = def.double ? 2 : 1;
    for(let i=0; i<turns; i++){
      _rotateLayer(def.axis, def.val, def.dir);
    }
    if(save){
      undoStack.push(name);
      redoStack = [];
      moveCount += 1;
      lastMove = name;
    }
    _updateDisplay();
    _checkSolved();
  };

  const _inverseMove = (name) => {
    if(name.endsWith('2')) return name;
    return name.endsWith('p') ? name.slice(0,-1) : `${name}p`;
  };

  const _undo = () => {
    if(!undoStack.length) return;
    const name = undoStack.pop();
    const inverse = _inverseMove(name);
    _applyMove(inverse, false);
    redoStack.push(name);
    moveCount = Math.max(0, moveCount - 1);
    lastMove = `Undo ${inverse}`;
    _setStatus('Move undone');
  };

  const _redo = () => {
    if(!redoStack.length) return;
    const name = redoStack.pop();
    _applyMove(name, false);
    undoStack.push(name);
    moveCount += 1;
    lastMove = `Redo ${name}`;
    _setStatus('Move redone');
  };

  const _scramble = () => {
    const seq = [];
    let last = '';
    for(let i=0; i<20; i++){
      let choice;
      do { choice = MOVE_KEYS[Math.floor(Math.random() * MOVE_KEYS.length)]; }
      while(choice[0] === last[0]);
      seq.push(choice);
      last = choice;
    }
    seq.forEach(move => _applyMove(move, false));
    undoStack = [];
    redoStack = [];
    moveCount = 0;
    lastMove = 'Scrambled';
    _setStatus('Scrambled to start');
  };

  const _checkSolved = () => {
    const faceColors = Array(6).fill(null).map(() => new Set());
    cubies.forEach(c => {
      Object.entries(c.stickers).forEach(([dir, face]) => faceColors[face].add(face));
    });
    const solved = faceColors.every(set => set.size === 1);
    if(solved){ _setStatus('Solved!'); lastMove = 'Solved'; }
  };

  return { init: (target) => init(target) };
})();
