/* ═══════════════════════════════════════════════════════════
   script.js  ·  Main entry point — wires all modules together
═══════════════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════
   LOADING PROGRESS HELPER
══════════════════════════════════════ */
const _setLoad = (pct, msg) => {
  document.getElementById('ldFill').style.width = pct + '%';
  document.getElementById('ldMsg').textContent  = msg;
};

/* ══════════════════════════════════════
   BOOT SEQUENCE
══════════════════════════════════════ */
let useFallbackMode = false;

const boot = async () => {

  _setLoad(10, 'Initializing renderer…');
  await _frame();

  /* 1. Try Three.js scene */
  const sceneData = Scene3D.init();
  useFallbackMode = !sceneData;

  if(useFallbackMode){
    _setLoad(25, 'Starting fallback mode…');
    await _frame();
    document.getElementById('loading').classList.add('out');
  }

  let cubeGroup = null;
  if(!useFallbackMode){
    const { renderer, scene, camera } = sceneData;
    _setLoad(30, 'Building scene…');
    await _frame();

    /* 2. Build Rubik's Cube */
    cubeGroup = Cube.init(scene);
    _setLoad(55, 'Assembling cube…');
    await _frame();

    /* 3. Init controls */
    Controls.init(camera, renderer, cubeGroup);
    _setLoad(70, 'Setting up controls…');
    await _frame();
  }

  /* 4. Init UI */
  UI.init(useFallbackMode);
  _setLoad(80, 'Loading UI…');
  await _frame();

  /* 5. Init gesture control */
  GestureControl.init();
  _setLoad(90, 'Setting up gesture control…');
  await _frame();

  /* 5. Wire cube callbacks */
  Cube.setOnMove((moveName, count) => {
    UI.addMoveToHistory(moveName, count);
  });

  Cube.setOnSolved(() => {
    // Small delay so last animation finishes
    setTimeout(() => {
      if(Cube.getMoveCount() > 0) UI.showVictory();
    }, 400);
  });

  /* 6. Init audio (deferred — needs user gesture) */
  document.addEventListener('click',     () => { Audio3D.init(); Audio3D.resume(); }, { once:true });
  document.addEventListener('touchstart',() => { Audio3D.init(); Audio3D.resume(); }, { once:true });
  document.addEventListener('keydown',   () => { Audio3D.init(); Audio3D.resume(); }, { once:true });

  _setLoad(100, 'Ready!');
  await _frame();

  /* 7. Hide loading screen */
  await _sleep(400);
  document.getElementById('loading').classList.add('out');

  /* 8. Start render loop */
  _loop();
};

/* ══════════════════════════════════════
   MAIN RENDER LOOP
══════════════════════════════════════ */
const _loop = (timestamp = 0) => {
  requestAnimationFrame(_loop);
  if(!useFallbackMode){
    Scene3D.render(timestamp);
  }
  UI.updateHUD();
};

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
const _frame = () => new Promise(r => requestAnimationFrame(r));
const _sleep  = ms => new Promise(r => setTimeout(r, ms));

/* ══════════════════════════════════════
   START
══════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', boot);
