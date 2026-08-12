/* ═══════════════════════════════════════════════════════════
   storage.js  ·  LocalStorage persistence layer
═══════════════════════════════════════════════════════════ */
'use strict';

const Storage = (() => {
  const KEY = 'rubiks3d_v1';

  /* ── Default state ── */
  const defaults = () => ({
    theme:    'dark',
    settings: {
      speed:    5,
      bloom:    3,
      music:    3,
      sound:    7,
      camSens:  5,
      particles:true,
      shadows:  true,
      muted:    false,
    },
    stats: {
      played:   0,
      won:      0,
      totalTime:0,
      totalMoves:0,
      bestTime: Infinity,
      bestMoves:Infinity,
    },
    achievements: {
      first:  false,
      cent:   false,
      fast:   false,
      perfect:false,
    }
  });

  /* ── Load from localStorage ── */
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if(!raw) return defaults();
      const saved = JSON.parse(raw);
      // Deep merge with defaults so new keys always exist
      const def = defaults();
      return {
        theme:    saved.theme    ?? def.theme,
        settings: { ...def.settings,  ...(saved.settings  || {}) },
        stats:    { ...def.stats,      ...(saved.stats     || {}) },
        achievements: { ...def.achievements, ...(saved.achievements || {}) },
      };
    } catch(e) {
      console.warn('[Storage] load error', e);
      return defaults();
    }
  };

  /* ── Save to localStorage ── */
  const save = data => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch(e) {
      console.warn('[Storage] save error', e);
    }
  };

  /* ── Convenience: update a nested key ── */
  const set = (path, value) => {
    const data = load();
    const keys = path.split('.');
    let obj = data;
    for(let i=0;i<keys.length-1;i++) obj = obj[keys[i]];
    obj[keys[keys.length-1]] = value;
    save(data);
    return data;
  };

  /* ── Get a nested key ── */
  const get = path => {
    const data = load();
    return path.split('.').reduce((o,k) => o?.[k], data);
  };

  /* ── Record a completed game ── */
  const recordGame = (timeSec, moves, solved) => {
    const data = load();
    data.stats.played++;
    data.stats.totalMoves += moves;
    if(solved){
      data.stats.won++;
      data.stats.totalTime += timeSec;
      if(timeSec < data.stats.bestTime)  data.stats.bestTime  = timeSec;
      if(moves   < data.stats.bestMoves) data.stats.bestMoves = moves;
    }
    save(data);
    return data.stats;
  };

  /* ── Unlock achievement ── */
  const unlockAch = key => {
    const data = load();
    if(!data.achievements[key]){
      data.achievements[key] = true;
      save(data);
      return true; // newly unlocked
    }
    return false;
  };

  /* ── Reset all data ── */
  const reset = () => { localStorage.removeItem(KEY); return defaults(); };

  return { load, save, set, get, recordGame, unlockAch, reset };
})();
