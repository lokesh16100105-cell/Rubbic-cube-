/* ═══════════════════════════════════════════════════════════
   utils.js  ·  Math helpers, easing, shared utilities
═══════════════════════════════════════════════════════════ */
'use strict';

const Utils = (() => {

  /* ── Easing functions ── */
  const Ease = {
    inOut:    t => t < .5 ? 2*t*t : -1+(4-2*t)*t,
    outCubic: t => 1 - Math.pow(1-t, 3),
    inCubic:  t => t * t * t,
    elastic:  t => {
      const c4 = (2*Math.PI)/3;
      return t===0 ? 0 : t===1 ? 1
        : Math.pow(2,-10*t)*Math.sin((t*10-0.75)*c4)+1;
    },
    bounce: t => {
      const n1=7.5625, d1=2.75;
      if(t<1/d1)      return n1*t*t;
      if(t<2/d1)      return n1*(t-=1.5/d1)*t+.75;
      if(t<2.5/d1)    return n1*(t-=2.25/d1)*t+.9375;
      return n1*(t-=2.625/d1)*t+.984375;
    },
    outBack: t => {
      const c1=1.70158, c3=c1+1;
      return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);
    }
  };

  /* ── Clamp ── */
  const clamp = (v,mn,mx) => Math.max(mn, Math.min(mx, v));

  /* ── Linear interpolation ── */
  const lerp = (a,b,t) => a + (b-a)*t;

  /* ── Format seconds → MM:SS ── */
  const fmtTime = s => {
    const m = Math.floor(s/60);
    const sec = Math.floor(s%60);
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  /* ── Random integer [min, max] ── */
  const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;

  /* ── Shuffle array (Fisher-Yates) ── */
  const shuffle = arr => {
    const a = [...arr];
    for(let i=a.length-1;i>0;i--){
      const j=randInt(0,i);
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  };

  /* ── Deep clone ── */
  const clone = obj => JSON.parse(JSON.stringify(obj));

  /* ── Round to nearest 90° (in radians) ── */
  const snapRot = r => Math.round(r/(Math.PI/2))*(Math.PI/2);

  /* ── Debounce ── */
  const debounce = (fn,ms) => {
    let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a),ms); };
  };

  /* ── Generate unique ID ── */
  let _uid = 0;
  const uid = () => ++_uid;

  /* ── Detect mobile ── */
  const isMobile = () => /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    || window.innerWidth < 720;

  /* ── Throttle ── */
  const throttle = (fn,ms) => {
    let last=0;
    return (...a) => {
      const now=Date.now();
      if(now-last>=ms){ last=now; fn(...a); }
    };
  };

  /* ── Color hex → THREE.Color ── */
  const hex2three = hex => new THREE.Color(hex);

  /* ── Axis-angle to quaternion ── */
  const axisAngleQuat = (axis, angle) => {
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(axis, angle);
    return q;
  };

  /* ── Normalize angle to [-PI, PI] ── */
  const normAngle = a => {
    while(a > Math.PI)  a -= 2*Math.PI;
    while(a < -Math.PI) a += 2*Math.PI;
    return a;
  };

  return { Ease, clamp, lerp, fmtTime, randInt, shuffle, clone,
           snapRot, debounce, uid, isMobile, throttle,
           hex2three, axisAngleQuat, normAngle };
})();
