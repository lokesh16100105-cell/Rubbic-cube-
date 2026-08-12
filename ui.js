/* ═══════════════════════════════════════════════════════════
   ui.js  ·  All UI interactions, HUD, modals, achievements
═══════════════════════════════════════════════════════════ */
'use strict';

const UI = (() => {

  /* ── Timer state ── */
  let timerInterval = null;
  let timerSeconds  = 0;
  let timerRunning  = false;
  let toastTimer    = null;

  /* ── DOM refs ── */
  const $ = id => document.getElementById(id);

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  let isFallback = false;

  const init = (fallback = false) => {
    isFallback = fallback;
    _bindButtons();
    _bindSettings();
    _bindThemes();
    _bindModals();
    _loadSavedData();
    if(isFallback){
      const fallbackRoot = document.createElement('div');
      fallbackRoot.id = 'fallbackRoot';
      document.body.appendChild(fallbackRoot);
      FallbackGame.init(fallbackRoot);
      document.getElementById('topNav').style.display = 'none';
      document.getElementById('leftPanel').style.display = 'none';
      document.getElementById('rightPanel').style.display = 'none';
      document.getElementById('statusBar').style.display = 'none';
      document.getElementById('gesturePanel')?.classList?.add('hidden');
      document.getElementById('loading').classList.add('out');
    }
  };

  /* ══════════════════════════════════════
     BUTTON BINDINGS
  ══════════════════════════════════════ */
  const _bindButtons = () => {
    /* Scramble */
    $('btnScramble').addEventListener('click', () => {
      Audio3D.resume(); Audio3D.playClick();
      if(Cube.getIsAnimating()) return;
      stopTimer(); resetTimer();
      $('sbState').textContent = 'SCRAMBLING';
      $('moveHist').innerHTML  = '';
      Cube.scramble(Utils.randInt(20,26), () => {
        $('sbState').textContent = 'SCRAMBLED';
        startTimer();
        showToast('Cube scrambled! Good luck 🎲');
      });
    });

    /* Solve */
    $('btnSolve').addEventListener('click', () => {
      Audio3D.resume(); Audio3D.playClick();
      if(Cube.getIsAnimating()) return;
      stopTimer();
      $('sbState').textContent = 'SOLVING…';
      Solver.buildSolution();
      const sol = Solver.getSolution();
      if(sol.length === 0){ showToast('Already solved!'); return; }
      // Show solver controls
      $('solverCtrl').classList.remove('hidden');
      $('sBtnStep').textContent = `0/${sol.length}`;
      Solver.setOnStep(info => {
        $('sBtnStep').textContent = `${info.index}/${info.total}`;
        $('sbMove').textContent   = info.move ?? '--';
        showToast(info.explain, 1200);
      });
      Solver.setOnDone(() => {
        $('sbState').textContent = 'SOLVED';
        $('solverCtrl').classList.add('hidden');
      });
      Solver.play();
    });

    /* Reset */
    $('btnReset').addEventListener('click', () => {
      Audio3D.resume(); Audio3D.playClick();
      stopTimer(); resetTimer();
      Solver.reset();
      Cube.clearQueue();
      Cube.reset();
      $('moveHist').innerHTML  = '';
      $('movesVal').textContent= '0';
      $('sbState').textContent = 'SOLVED';
      $('sbMove').textContent  = '--';
      $('solverCtrl').classList.add('hidden');
      showToast('Cube reset ↺');
    });

    /* Undo */
    $('btnUndo').addEventListener('click', () => {
      Audio3D.resume(); Audio3D.playClick();
      Cube.undo();
    });

    /* Redo */
    $('btnRedo').addEventListener('click', () => {
      Audio3D.resume(); Audio3D.playClick();
      Cube.redo();
    });

    /* Auto Rotate */
    $('btnAutoRot').addEventListener('click', () => {
      Audio3D.playClick();
      const on = Controls.getAutoRotate();
      Controls.setAutoRotate(!on);
      $('btnAutoRot').classList.toggle('on', !on);
      showToast(!on ? 'Auto rotate ON' : 'Auto rotate OFF');
    });

    /* Reset Camera */
    $('btnResetCam').addEventListener('click', () => {
      Audio3D.playClick();
      Controls.resetCamera();
    });

    /* Fullscreen */
    $('btnFullscreen').addEventListener('click', () => {
      Audio3D.playClick();
      if(!document.fullscreenElement){
        document.documentElement.requestFullscreen().catch(()=>{});
        showToast('Fullscreen ON');
      } else {
        document.exitFullscreen().catch(()=>{});
        showToast('Fullscreen OFF');
      }
    });

    /* Mute */
    $('btnMute').addEventListener('click', () => {
      const m = !Audio3D.isMuted();
      Audio3D.setMuted(m);
      $('btnMute').textContent = m ? '🔇' : '🔊';
      Storage.set('settings.muted', m);
      showToast(m ? 'Sound muted 🔇' : 'Sound on 🔊');
    });

    /* Settings open */
    $('btnSettings').addEventListener('click', () => {
      Audio3D.playClick();
      $('settingsModal').classList.remove('hidden');
    });

    /* Solver step controls */
    $('sBtnPrev').addEventListener('click', () => { Audio3D.playClick(); Solver.stepBack(); });
    $('sBtnPlay').addEventListener('click', () => {
      Audio3D.playClick();
      if(Solver.getPlaying()){ Solver.pause(); $('sBtnPlay').textContent='▶'; }
      else { Solver.play(); $('sBtnPlay').textContent='⏸'; }
    });
    $('sBtnNext').addEventListener('click', () => { Audio3D.playClick(); Solver.stepForward(); });

    /* Victory modal */
    $('btnPlayAgain').addEventListener('click', () => {
      Audio3D.playClick();
      $('victoryModal').classList.add('hidden');
      $('btnScramble').click();
    });
    $('btnCloseVic').addEventListener('click', () => {
      Audio3D.playClick();
      $('victoryModal').classList.add('hidden');
    });
  };

  /* ══════════════════════════════════════
     SETTINGS
  ══════════════════════════════════════ */
  const _bindSettings = () => {
    const ranges = [
      ['sSpeed', 'sSpeedV', v => { Cube.setAnimSpeed(1100 - v*100); Solver.setDelay(1100-v*100); }],
      ['sBloom',  'sBloomV',  v => Scene3D.setBloom(v)],
      ['sMusic',  'sMusicV',  v => { Audio3D.setMusicVol(v); Storage.set('settings.music',v); }],
      ['sSound',  'sSoundV',  v => { Audio3D.setSfxVol(v);   Storage.set('settings.sound',v); }],
      ['sCam',    'sCamV',    v => { Controls.setCamSensitivity(v/5); Storage.set('settings.camSens',v); }],
    ];
    ranges.forEach(([id, valId, fn]) => {
      const el = $(id);
      el.addEventListener('input', () => {
        const v = parseInt(el.value);
        $(valId).textContent = v;
        fn(v);
      });
    });

    $('sParticles').addEventListener('change', e => {
      Scene3D.setParticles(e.target.checked);
      Storage.set('settings.particles', e.target.checked);
    });
    $('sShadows').addEventListener('change', e => {
      Scene3D.setShadows(e.target.checked);
      Storage.set('settings.shadows', e.target.checked);
    });

    $('closeSettings').addEventListener('click', () => {
      Audio3D.playClick();
      $('settingsModal').classList.add('hidden');
    });
  };

  /* ══════════════════════════════════════
     THEMES
  ══════════════════════════════════════ */
  const _bindThemes = () => {
    document.querySelectorAll('.tbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        Audio3D.playClick();
        const theme = btn.dataset.theme;
        _applyTheme(theme);
        document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Storage.set('theme', theme);
        showToast(`Theme: ${theme.charAt(0).toUpperCase()+theme.slice(1)}`);
      });
    });
  };

  const _applyTheme = theme => {
    document.body.setAttribute('data-theme', theme);
    // Update scene accent color
    const accents = {
      dark:'#6c63ff', neon:'#00ffff', cyberpunk:'#ffd700',
      glass:'#4fc3f7', gold:'#ffc107', classic:'#e94560'
    };
    Scene3D.setThemeColors(accents[theme] ?? '#6c63ff');
  };

  /* ══════════════════════════════════════
     MODALS — close on backdrop click
  ══════════════════════════════════════ */
  const _bindModals = () => {
    document.querySelectorAll('.modal-bg').forEach(bg => {
      bg.addEventListener('click', () => {
        bg.closest('.modal').classList.add('hidden');
      });
    });
  };

  /* ══════════════════════════════════════
     TIMER
  ══════════════════════════════════════ */
  const startTimer = () => {
    if(timerRunning) return;
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds++;
      $('timerVal').textContent = Utils.fmtTime(timerSeconds);
    }, 1000);
  };

  const stopTimer = () => {
    timerRunning = false;
    clearInterval(timerInterval);
  };

  const resetTimer = () => {
    timerSeconds = 0;
    $('timerVal').textContent = '00:00';
  };

  const getTimerSeconds = () => timerSeconds;

  /* ══════════════════════════════════════
     MOVE HISTORY
  ══════════════════════════════════════ */
  const addMoveToHistory = (moveName, count) => {
    $('movesVal').textContent = count;
    $('sbMove').textContent   = moveName;

    const hist = $('moveHist');
    // Remove 'cur' from previous
    hist.querySelectorAll('.mt.cur').forEach(el => el.classList.remove('cur'));
    const tag = document.createElement('span');
    tag.className   = 'mt cur';
    tag.textContent = moveName;
    hist.appendChild(tag);
    hist.scrollTop  = hist.scrollHeight;

    // Keep max 60 tags
    while(hist.children.length > 60) hist.removeChild(hist.firstChild);

    // Check 100-move achievement
    if(count >= 100) unlockAchievement('achCent');
  };

  /* ══════════════════════════════════════
     VICTORY
  ══════════════════════════════════════ */
  const showVictory = () => {
    stopTimer();
    const t = timerSeconds;
    const m = Cube.getMoveCount();

    // Record stats
    const stats = Storage.recordGame(t, m, true);
    _updateStatsUI(stats);

    // Rating
    let rating = '⭐';
    if(t < 120 && m < 50) rating = '⭐⭐⭐';
    else if(t < 300 || m < 80) rating = '⭐⭐';

    $('vTime').textContent   = Utils.fmtTime(t);
    $('vMoves').textContent  = m;
    $('vRating').textContent = rating;

    // Best time display
    if(stats.bestTime < Infinity){
      $('bestVal').textContent = Utils.fmtTime(stats.bestTime);
      $('stBest').textContent  = Utils.fmtTime(stats.bestTime);
    }

    // Confetti
    Animations.victoryParticles($('vpWrap'));
    $('victoryModal').classList.remove('hidden');
    Audio3D.playVictory();

    // Achievements
    unlockAchievement('achFirst');
    if(t < 120) unlockAchievement('achFast');
    if(m <= 30)  unlockAchievement('achPerf');

    $('sbState').textContent = 'SOLVED! 🎉';
  };

  /* ══════════════════════════════════════
     ACHIEVEMENTS
  ══════════════════════════════════════ */
  const unlockAchievement = (id) => {
    const keyMap = { achFirst:'first', achCent:'cent', achFast:'fast', achPerf:'perfect' };
    const key = keyMap[id];
    if(!key) return;
    const isNew = Storage.unlockAch(key);
    if(isNew){
      const el = $(id);
      if(el){ el.classList.remove('locked'); el.classList.add('unlocked'); }
      Audio3D.playAchievement();
      showToast(`🏆 Achievement unlocked: ${el?.querySelector('b')?.textContent ?? id}`);
    }
  };

  /* ══════════════════════════════════════
     STATS UI
  ══════════════════════════════════════ */
  const _updateStatsUI = (stats) => {
    $('stPlayed').textContent = stats.played;
    $('stWon').textContent    = stats.won;
    $('stTotal').textContent  = stats.totalMoves;
    if(stats.won > 0){
      $('stAvgT').textContent = Utils.fmtTime(Math.round(stats.totalTime / stats.won));
      $('stAvgM').textContent = Math.round(stats.totalMoves / stats.won);
    }
    if(stats.bestTime < Infinity){
      $('stBest').textContent  = Utils.fmtTime(stats.bestTime);
      $('bestVal').textContent = Utils.fmtTime(stats.bestTime);
    }
  };

  /* ══════════════════════════════════════
     LOAD SAVED DATA
  ══════════════════════════════════════ */
  const _loadSavedData = () => {
    const data = Storage.load();

    // Theme
    _applyTheme(data.theme);
    document.querySelectorAll('.tbtn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === data.theme);
    });

    // Settings sliders
    const s = data.settings;
    const setSlider = (id, valId, val) => {
      $(id).value = val;
      $(valId).textContent = val;
    };
    setSlider('sSpeed','sSpeedV', s.speed);
    setSlider('sBloom','sBloomV', s.bloom);
    setSlider('sMusic','sMusicV', s.music);
    setSlider('sSound','sSoundV', s.sound);
    setSlider('sCam',  'sCamV',   s.camSens);
    $('sParticles').checked = s.particles;
    $('sShadows').checked   = s.shadows;
    if(s.muted){ Audio3D.setMuted(true); $('btnMute').textContent='🔇'; }

    // Apply settings
    Cube.setAnimSpeed(1100 - s.speed*100);
    Audio3D.setMusicVol(s.music);
    Audio3D.setSfxVol(s.sound);
    Controls.setCamSensitivity(s.camSens/5);
    Scene3D.setBloom(s.bloom);

    // Stats
    _updateStatsUI(data.stats);

    // Achievements
    const ach = data.achievements;
    if(ach.first)   { $('achFirst').classList.remove('locked'); $('achFirst').classList.add('unlocked'); }
    if(ach.cent)    { $('achCent').classList.remove('locked');  $('achCent').classList.add('unlocked');  }
    if(ach.fast)    { $('achFast').classList.remove('locked');  $('achFast').classList.add('unlocked');  }
    if(ach.perfect) { $('achPerf').classList.remove('locked');  $('achPerf').classList.add('unlocked');  }
  };

  /* ══════════════════════════════════════
     TOAST
  ══════════════════════════════════════ */
  const showToast = (msg, dur=2200) => {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), dur);
  };

  /* ══════════════════════════════════════
     HUD UPDATE (called each frame)
  ══════════════════════════════════════ */
  const updateHUD = () => {
    // Camera angle
    const sph = Controls.getSpherical();
    const deg = Math.round(((sph.theta % (Math.PI*2)) / (Math.PI*2)) * 360);
    $('sbCam').textContent = `${((deg+360)%360)}°`;

    // Cube state
    if(!Cube.getIsAnimating() && !timerRunning && Cube.getMoveCount() === 0){
      $('sbState').textContent = 'SOLVED';
    }
  };

  return {
    init, startTimer, stopTimer, resetTimer, getTimerSeconds,
    addMoveToHistory, showVictory, unlockAchievement,
    showToast, updateHUD,
  };
})();
