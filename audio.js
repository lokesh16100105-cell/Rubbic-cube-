/* ═══════════════════════════════════════════════════════════
   audio.js  ·  Web Audio API — SFX + ambient music
═══════════════════════════════════════════════════════════ */
'use strict';

const Audio3D = (() => {
  let ctx = null;
  let masterGain, musicGain, sfxGain;
  let musicOsc = [], musicNodes = [];
  let muted = false;
  let musicVol = 0.3, sfxVol = 0.7;

  /* ── Init AudioContext on first user gesture ── */
  const init = () => {
    if(ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain(); masterGain.gain.value = 1;
      musicGain  = ctx.createGain(); musicGain.gain.value  = musicVol;
      sfxGain    = ctx.createGain(); sfxGain.gain.value    = sfxVol;
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      _startAmbient();
    } catch(e) {
      console.warn('[Audio] Web Audio not supported', e);
    }
  };

  /* ── Ambient generative music ── */
  const _startAmbient = () => {
    if(!ctx) return;
    // Drone chord: root + fifth + octave
    const freqs = [55, 82.4, 110, 164.8];
    freqs.forEach((f,i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      osc.type = i%2===0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      gain.gain.value = 0.04 / (i+1);
      filt.type = 'lowpass';
      filt.frequency.value = 400;
      osc.connect(filt); filt.connect(gain); gain.connect(musicGain);
      osc.start();
      // Slow LFO on gain for breathing effect
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.1 + i*0.03;
      lfoG.gain.value = 0.015;
      lfo.connect(lfoG); lfoG.connect(gain.gain);
      lfo.start();
      musicOsc.push(osc, lfo);
      musicNodes.push(gain, lfoG, filt);
    });
  };

  /* ── Generic tone burst ── */
  const _tone = (freq, type, dur, vol, detune=0) => {
    if(!ctx || muted) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(sfxGain);
    osc.start(); osc.stop(ctx.currentTime + dur);
  };

  /* ── Noise burst (for click) ── */
  const _noise = (dur, vol) => {
    if(!ctx || muted) return;
    const buf  = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*0.3;
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    src.buffer = buf;
    filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 0.5;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
    src.connect(filt); filt.connect(gain); gain.connect(sfxGain);
    src.start(); src.stop(ctx.currentTime+dur);
  };

  /* ── Public SFX ── */
  const playClick   = () => { _noise(0.04, sfxVol*0.6); _tone(800,'square',0.05,sfxVol*0.3); };
  const playRotate  = () => { _noise(0.08, sfxVol*0.5); _tone(220,'sawtooth',0.12,sfxVol*0.2,Utils.randInt(-20,20)); };
  const playUndo    = () => { _tone(440,'sine',0.15,sfxVol*0.4); _tone(330,'sine',0.15,sfxVol*0.3,0); };
  const playScramble= () => { for(let i=0;i<3;i++) setTimeout(()=>playRotate(), i*60); };
  const playVictory = () => {
    if(!ctx||muted) return;
    const notes = [523,659,784,1047];
    notes.forEach((f,i) => setTimeout(()=>_tone(f,'sine',0.4,sfxVol*0.5),i*120));
  };
  const playAchievement = () => {
    if(!ctx||muted) return;
    [880,1100,1320].forEach((f,i)=>setTimeout(()=>_tone(f,'sine',0.3,sfxVol*0.4),i*80));
  };

  /* ── Volume controls ── */
  const setMusicVol = v => {
    musicVol = v/10;
    if(musicGain) musicGain.gain.value = musicVol;
  };
  const setSfxVol = v => {
    sfxVol = v/10;
    if(sfxGain) sfxGain.gain.value = sfxVol;
  };
  const setMuted = m => {
    muted = m;
    if(masterGain) masterGain.gain.value = m ? 0 : 1;
  };
  const isMuted = () => muted;

  /* ── Resume context after user gesture ── */
  const resume = () => { if(ctx && ctx.state==='suspended') ctx.resume(); };

  return { init, resume, playClick, playRotate, playUndo,
           playScramble, playVictory, playAchievement,
           setMusicVol, setSfxVol, setMuted, isMuted };
})();
