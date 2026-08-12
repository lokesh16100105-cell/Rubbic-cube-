/* ═══════════════════════════════════════════════════════════
   cube.js  ·  Realistic Rubik's Cube — 3×3×3
═══════════════════════════════════════════════════════════ */
'use strict';

const Cube = (() => {

  /* ── Constants ── */
  const SIZE    = 1.0;
  const GAP     = 0.06;    // black gap between cubies
  const STEP    = SIZE + GAP;
  const INSET   = 0.09;    // sticker inset from edge
  const S_SIZE  = SIZE - INSET * 2;  // sticker face size
  const S_THICK = 0.015;   // sticker thickness

  /* Official Rubik's Cube colors */
  const COLORS = {
    right:  0xffa500,  // Orange  +X
    left:   0xcc0000,  // Red     -X
    top:    0xffffff,  // White   +Y
    bottom: 0xffdd00,  // Yellow  -Y
    front:  0x009b48,  // Green   +Z
    back:   0x0046ad,  // Blue    -Z
  };

  const BLACK = 0x0a0a0a;

  /* ── State ── */
  let group      = null;
  let cubies     = [];
  let scene      = null;
  let isAnimating= false;
  let moveQueue  = [];
  let undoStack  = [];
  let redoStack  = [];
  let moveCount  = 0;
  let isSolved   = true;
  let onMoveCb   = null;
  let onSolvedCb = null;
  let animSpeed  = 320;

  /* ══════════════════════════════════════
     MATERIALS
  ══════════════════════════════════════ */

  /* Shared black plastic material for all cubie bodies */
  const _plasticMat = () => new THREE.MeshStandardMaterial({
    color:     BLACK,
    roughness: 0.4,
    metalness: 0.05,
  });

  /* Colored sticker material — slight gloss like real stickers */
  const _stickerMat = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.15,
    metalness: 0.0,
  });

  /* ══════════════════════════════════════
     CUBIE BUILDER
  ══════════════════════════════════════ */
  const _makeCubie = (gx, gy, gz) => {
    const cubie = new THREE.Group();
    cubie.userData = { gx, gy, gz };

    /* ── Black plastic body ── */
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE, SIZE, SIZE),
      _plasticMat()
    );
    body.castShadow    = true;
    body.receiveShadow = true;
    cubie.add(body);

    /* ── Colored stickers — only on outer faces ── */
    const off = SIZE / 2 + S_THICK / 2 + 0.001;

    // Each sticker is a flat PlaneGeometry sitting flush on the face
    const addSticker = (color, x, y, z, rx, ry, rz) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(S_SIZE, S_SIZE),
        _stickerMat(color)
      );
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.userData.isSticker = true;
      mesh.userData.stickerColor = color;
      cubie.add(mesh);
    };

    // +X right face  — plane faces +X
    if(gx ===  1) addSticker(COLORS.right,  off, 0, 0,  0,  Math.PI/2, 0);
    // -X left face   — plane faces -X
    if(gx === -1) addSticker(COLORS.left,  -off, 0, 0,  0, -Math.PI/2, 0);
    // +Y top face    — plane faces +Y
    if(gy ===  1) addSticker(COLORS.top,    0,  off, 0, -Math.PI/2, 0, 0);
    // -Y bottom face — plane faces -Y
    if(gy === -1) addSticker(COLORS.bottom, 0, -off, 0,  Math.PI/2, 0, 0);
    // +Z front face  — plane faces +Z (default PlaneGeometry orientation)
    if(gz ===  1) addSticker(COLORS.front,  0, 0,  off,  0, 0, 0);
    // -Z back face   — plane faces -Z
    if(gz === -1) addSticker(COLORS.back,   0, 0, -off,  0, Math.PI, 0);

    cubie.position.set(gx * STEP, gy * STEP, gz * STEP);
    return cubie;
  };

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  const init = (threeScene) => {
    scene  = threeScene;
    group  = new THREE.Group();
    cubies = [];
    for(let x=-1; x<=1; x++)
    for(let y=-1; y<=1; y++)
    for(let z=-1; z<=1; z++){
      const c = _makeCubie(x, y, z);
      group.add(c);
      cubies.push(c);
    }
    scene.add(group);
    return group;
  };

  /* ══════════════════════════════════════
     MOVES
  ══════════════════════════════════════ */
  const MOVES = {
    R:  { axis:new THREE.Vector3(1,0,0), coord:'x', val: 1, dir:-1 },
    Rp: { axis:new THREE.Vector3(1,0,0), coord:'x', val: 1, dir: 1 },
    R2: { axis:new THREE.Vector3(1,0,0), coord:'x', val: 1, dir:-1, double:true },
    L:  { axis:new THREE.Vector3(1,0,0), coord:'x', val:-1, dir: 1 },
    Lp: { axis:new THREE.Vector3(1,0,0), coord:'x', val:-1, dir:-1 },
    L2: { axis:new THREE.Vector3(1,0,0), coord:'x', val:-1, dir: 1, double:true },
    U:  { axis:new THREE.Vector3(0,1,0), coord:'y', val: 1, dir:-1 },
    Up: { axis:new THREE.Vector3(0,1,0), coord:'y', val: 1, dir: 1 },
    U2: { axis:new THREE.Vector3(0,1,0), coord:'y', val: 1, dir:-1, double:true },
    D:  { axis:new THREE.Vector3(0,1,0), coord:'y', val:-1, dir: 1 },
    Dp: { axis:new THREE.Vector3(0,1,0), coord:'y', val:-1, dir:-1 },
    D2: { axis:new THREE.Vector3(0,1,0), coord:'y', val:-1, dir: 1, double:true },
    F:  { axis:new THREE.Vector3(0,0,1), coord:'z', val: 1, dir:-1 },
    Fp: { axis:new THREE.Vector3(0,0,1), coord:'z', val: 1, dir: 1 },
    F2: { axis:new THREE.Vector3(0,0,1), coord:'z', val: 1, dir:-1, double:true },
    B:  { axis:new THREE.Vector3(0,0,1), coord:'z', val:-1, dir: 1 },
    Bp: { axis:new THREE.Vector3(0,0,1), coord:'z', val:-1, dir:-1 },
    B2: { axis:new THREE.Vector3(0,0,1), coord:'z', val:-1, dir: 1, double:true },
    M:  { axis:new THREE.Vector3(1,0,0), coord:'x', val: 0, dir: 1 },
    Mp: { axis:new THREE.Vector3(1,0,0), coord:'x', val: 0, dir:-1 },
    E:  { axis:new THREE.Vector3(0,1,0), coord:'y', val: 0, dir: 1 },
    Ep: { axis:new THREE.Vector3(0,1,0), coord:'y', val: 0, dir:-1 },
    S:  { axis:new THREE.Vector3(0,0,1), coord:'z', val: 0, dir:-1 },
    Sp: { axis:new THREE.Vector3(0,0,1), coord:'z', val: 0, dir: 1 },
  };

  const _inverse = n => n.endsWith('p') ? n.slice(0,-1) : n.endsWith('2') ? n : n+'p';

  const _getLayer = (coord, val) => cubies.filter(c => {
    const wp = new THREE.Vector3();
    c.getWorldPosition(wp);
    return Math.round(wp[coord] / STEP) === val;
  });

  const _snap = (layer) => {
    layer.forEach(c => {
      c.position.x = Math.round(c.position.x / STEP) * STEP;
      c.position.y = Math.round(c.position.y / STEP) * STEP;
      c.position.z = Math.round(c.position.z / STEP) * STEP;
      const e = new THREE.Euler().setFromQuaternion(c.quaternion, 'XYZ');
      e.x = Math.round(e.x / (Math.PI/2)) * (Math.PI/2);
      e.y = Math.round(e.y / (Math.PI/2)) * (Math.PI/2);
      e.z = Math.round(e.z / (Math.PI/2)) * (Math.PI/2);
      c.quaternion.setFromEuler(e);
      c.userData.gx = Math.round(c.position.x / STEP);
      c.userData.gy = Math.round(c.position.y / STEP);
      c.userData.gz = Math.round(c.position.z / STEP);
    });
  };

  const _execMove = (moveName, addToUndo, onDone) => {
    const def = MOVES[moveName];
    if(!def){ onDone && onDone(); return; }

    const layer = _getLayer(def.coord, def.val);
    const angle = def.dir * Math.PI/2 * (def.double ? 2 : 1);
    const pivot = new THREE.Group();
    scene.add(pivot);

    layer.forEach(c => { group.remove(c); pivot.add(c); });

    const startQ = pivot.quaternion.clone();
    const endQ   = new THREE.Quaternion().setFromAxisAngle(def.axis, angle);
    endQ.multiply(startQ);

    Animations.tween({
      from:0, to:1,
      dur: def.double ? animSpeed * 1.5 : animSpeed,
      ease: Utils.Ease.inOut,
      onUpdate: v => pivot.quaternion.slerpQuaternions(startQ, endQ, v),
      onComplete: () => {
        pivot.updateMatrixWorld(true);
        layer.forEach(c => {
          const wp = new THREE.Vector3();
          const wq = new THREE.Quaternion();
          const ws = new THREE.Vector3();
          c.getWorldPosition(wp);
          c.getWorldQuaternion(wq);
          c.getWorldScale(ws);
          pivot.remove(c);
          group.add(c);
          c.position.copy(wp);
          c.quaternion.copy(wq);
          c.scale.copy(ws);
        });
        scene.remove(pivot);
        _snap(layer);

        if(addToUndo){
          undoStack.push(moveName);
          redoStack = [];
          moveCount++;
          if(onMoveCb) onMoveCb(moveName, moveCount);
        }
        Audio3D.playRotate();
        _checkSolved();
        onDone && onDone();
      }
    });
  };

  const _processQueue = () => {
    if(isAnimating || moveQueue.length === 0) return;
    isAnimating = true;
    const { name, addToUndo, onDone } = moveQueue.shift();
    _execMove(name, addToUndo, () => {
      isAnimating = false;
      if(moveQueue.length > 0) _processQueue();
      else onDone && onDone();
    });
  };

  const move = (name, addToUndo=true, onDone=null) => {
    moveQueue.push({ name, addToUndo, onDone });
    _processQueue();
  };

  const moves = (names, addToUndo=true, onAllDone=null) => {
    names.forEach((n, i) => {
      moveQueue.push({ name:n, addToUndo, onDone: i===names.length-1 ? onAllDone : null });
    });
    _processQueue();
  };

  /* ── Undo / Redo ── */
  const undo = () => {
    if(!undoStack.length || isAnimating) return;
    const last = undoStack.pop();
    redoStack.push(last);
    moveQueue.push({ name:_inverse(last), addToUndo:false, onDone:null });
    moveCount = Math.max(0, moveCount-1);
    _processQueue();
    Audio3D.playUndo();
    if(onMoveCb) onMoveCb(_inverse(last), moveCount);
  };

  const redo = () => {
    if(!redoStack.length || isAnimating) return;
    const next = redoStack.pop();
    undoStack.push(next);
    moveQueue.push({ name:next, addToUndo:false, onDone:null });
    moveCount++;
    _processQueue();
    if(onMoveCb) onMoveCb(next, moveCount);
  };

  /* ── Scramble ── */
  const SMOVES = ['R','Rp','R2','L','Lp','L2','U','Up','U2','D','Dp','D2','F','Fp','F2','B','Bp','B2'];

  const scramble = (count=22, onDone=null) => {
    const seq = [];
    let last = '';
    for(let i=0; i<count; i++){
      let m;
      do { m = SMOVES[Utils.randInt(0, SMOVES.length-1)]; } while(m[0]===last[0]);
      seq.push(m); last = m;
    }
    undoStack = []; redoStack = []; moveCount = 0; isSolved = false;
    moves(seq, false, onDone);
    Audio3D.playScramble();
    return seq;
  };

  /* ── Reset ── */
  const reset = () => {
    cubies.forEach(c => group.remove(c));
    cubies = []; moveQueue = []; undoStack = []; redoStack = [];
    moveCount = 0; isSolved = true; isAnimating = false;
    for(let x=-1; x<=1; x++)
    for(let y=-1; y<=1; y++)
    for(let z=-1; z<=1; z++){
      const c = _makeCubie(x, y, z);
      group.add(c); cubies.push(c);
    }
    group.rotation.set(0,0,0);
    group.quaternion.identity();
  };

  /* ── Solved check ── */
  const _checkSolved = () => {
    const faceNormals = [
      new THREE.Vector3( 1,0,0), new THREE.Vector3(-1,0,0),
      new THREE.Vector3( 0,1,0), new THREE.Vector3( 0,-1,0),
      new THREE.Vector3( 0,0,1), new THREE.Vector3( 0,0,-1),
    ];

    for(const worldDir of faceNormals){
      const colors = new Set();
      cubies.forEach(c => {
        // Only outer cubies on this face
        const cp = new THREE.Vector3();
        c.getWorldPosition(cp);
        if(cp.dot(worldDir) < STEP * 0.5) return;

        c.children.forEach(child => {
          if(!child.userData.isSticker) return;
          // Check if sticker faces worldDir
          const sp = new THREE.Vector3();
          child.getWorldPosition(sp);
          const cp2 = new THREE.Vector3();
          c.getWorldPosition(cp2);
          const offset = sp.clone().sub(cp2).normalize();
          if(offset.dot(worldDir) > 0.7){
            colors.add(child.material.color.getHex());
          }
        });
      });
      if(colors.size > 1){ isSolved = false; return; }
    }
    isSolved = true;
    if(onSolvedCb) onSolvedCb();
  };

  /* ── Getters / Setters ── */
  const getGroup       = () => group;
  const getCubies      = () => cubies;
  const getMoveCount   = () => moveCount;
  const getIsSolved    = () => isSolved;
  const getIsAnimating = () => isAnimating || moveQueue.length > 0;
  const getUndoLen     = () => undoStack.length;
  const getRedoLen     = () => redoStack.length;
  const getUndoStack   = () => [...undoStack];
  const setAnimSpeed   = ms => { animSpeed = ms; };
  const setOnMove      = cb => { onMoveCb   = cb; };
  const setOnSolved    = cb => { onSolvedCb = cb; };
  const clearQueue     = () => { moveQueue = []; isAnimating = false; };

  return {
    init, move, moves, undo, redo, scramble, reset,
    getGroup, getCubies, getMoveCount, getIsSolved,
    getIsAnimating, getUndoLen, getRedoLen, getUndoStack,
    setAnimSpeed, setOnMove, setOnSolved, clearQueue,
    MOVES, STEP,
  };
})();
