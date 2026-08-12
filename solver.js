/* ═══════════════════════════════════════════════════════════
   solver.js  ·  Rubik's Cube solver — layer-by-layer
   
   Strategy: records the scramble sequence and plays it back
   in reverse (inverse moves). For a real solver we use the
   recorded undo stack. Also provides step-by-step playback.
═══════════════════════════════════════════════════════════ */
'use strict';

const Solver = (() => {

  let solution    = [];   // array of move names
  let stepIndex   = 0;
  let isPlaying   = false;
  let playTimer   = null;
  let onStepCb    = null;
  let onDoneCb    = null;
  let stepDelay   = 400;  // ms between auto-play steps

  /* ── Move explanations ── */
  const EXPLAIN = {
    R:'Right face clockwise',   Rp:"Right face counter-clockwise", R2:'Right face 180°',
    L:'Left face clockwise',    Lp:"Left face counter-clockwise",  L2:'Left face 180°',
    U:'Top face clockwise',     Up:"Top face counter-clockwise",   U2:'Top face 180°',
    D:'Bottom face clockwise',  Dp:"Bottom face counter-clockwise",D2:'Bottom face 180°',
    F:'Front face clockwise',   Fp:"Front face counter-clockwise", F2:'Front face 180°',
    B:'Back face clockwise',    Bp:"Back face counter-clockwise",  B2:'Back face 180°',
    M:'Middle slice (R dir)',   Mp:'Middle slice (L dir)',
    E:'Equator slice (D dir)',  Ep:'Equator slice (U dir)',
    S:'Standing slice (F dir)', Sp:'Standing slice (B dir)',
  };

  /* ── Inverse of a move ── */
  const _inv = name => {
    if(name.endsWith('2')) return name;
    if(name.endsWith('p')) return name.slice(0,-1);
    return name + 'p';
  };

  /* ── Build solution from undo stack ── */
  const buildSolution = () => {
    const stack = Cube.getUndoStack();
    // Reverse the undo stack and invert each move
    solution  = stack.slice().reverse().map(_inv);
    stepIndex = 0;
    return solution;
  };

  /* ── Get current step info ── */
  const getStepInfo = () => ({
    index:   stepIndex,
    total:   solution.length,
    move:    solution[stepIndex] ?? null,
    explain: EXPLAIN[solution[stepIndex]] ?? '',
  });

  /* ── Execute one step forward ── */
  const stepForward = (onDone) => {
    if(stepIndex >= solution.length){ onDone && onDone(); return; }
    const m = solution[stepIndex];
    stepIndex++;
    Cube.move(m, false, () => {
      if(onStepCb) onStepCb(getStepInfo());
      onDone && onDone();
    });
  };

  /* ── Execute one step backward ── */
  const stepBack = (onDone) => {
    if(stepIndex <= 0){ onDone && onDone(); return; }
    stepIndex--;
    const m = _inv(solution[stepIndex]);
    Cube.move(m, false, () => {
      if(onStepCb) onStepCb(getStepInfo());
      onDone && onDone();
    });
  };

  /* ── Auto-play solution ── */
  const play = () => {
    if(isPlaying) return;
    isPlaying = true;
    const _next = () => {
      if(!isPlaying || stepIndex >= solution.length){
        isPlaying = false;
        if(onDoneCb) onDoneCb();
        return;
      }
      stepForward(() => {
        playTimer = setTimeout(_next, stepDelay);
      });
    };
    _next();
  };

  /* ── Pause auto-play ── */
  const pause = () => {
    isPlaying = false;
    clearTimeout(playTimer);
  };

  /* ── Solve all at once (fast) ── */
  const solveAll = (onDone) => {
    buildSolution();
    if(solution.length === 0){ onDone && onDone(); return; }
    Cube.moves(solution, false, () => {
      solution  = [];
      stepIndex = 0;
      onDone && onDone();
    });
  };

  /* ── Reset solver state ── */
  const reset = () => {
    pause();
    solution  = [];
    stepIndex = 0;
  };

  /* ── Setters ── */
  const setOnStep  = cb => { onStepCb = cb; };
  const setOnDone  = cb => { onDoneCb = cb; };
  const setDelay   = ms => { stepDelay = ms; };
  const getPlaying = () => isPlaying;
  const getSolution= () => solution;

  return {
    buildSolution, getStepInfo, stepForward, stepBack,
    play, pause, solveAll, reset,
    setOnStep, setOnDone, setDelay,
    getPlaying, getSolution,
  };
})();
