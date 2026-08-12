/* ═══════════════════════════════════════════════════════════
   animations.js  ·  Tween engine + special effects
═══════════════════════════════════════════════════════════ */
'use strict';

const Animations = (() => {
  /* ── Active tweens list ── */
  const tweens = [];

  /* ── Core tween ── */
  const tween = (opts) => {
    // opts: { from, to, dur, ease, onUpdate, onComplete, delay }
    const t = {
      from:       opts.from       ?? 0,
      to:         opts.to         ?? 1,
      dur:        opts.dur        ?? 500,
      ease:       opts.ease       ?? Utils.Ease.inOut,
      onUpdate:   opts.onUpdate   ?? null,
      onComplete: opts.onComplete ?? null,
      delay:      opts.delay      ?? 0,
      elapsed:    0,
      done:       false,
    };
    tweens.push(t);
    return t;
  };

  /* ── Update all tweens (called from render loop) ── */
  const update = dt => {
    for(let i = tweens.length-1; i >= 0; i--){
      const t = tweens[i];
      if(t.done){ tweens.splice(i,1); continue; }
      t.elapsed += dt;
      if(t.elapsed < t.delay) continue;
      const elapsed = t.elapsed - t.delay;
      const progress = Utils.clamp(elapsed / t.dur, 0, 1);
      const eased    = t.ease(progress);
      const value    = Utils.lerp(t.from, t.to, eased);
      if(t.onUpdate) t.onUpdate(value, eased, progress);
      if(progress >= 1){
        t.done = true;
        if(t.onComplete) t.onComplete();
      }
    }
  };

  /* ── Cancel a tween ── */
  const cancel = t => { if(t) t.done = true; };

  /* ── Animate a THREE.Object3D rotation around an axis ── */
  const rotateObject = (obj, axis, angle, dur, ease, onComplete) => {
    const startQ = obj.quaternion.clone();
    const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const endQ   = deltaQ.multiply(startQ);
    return tween({
      from:0, to:1, dur, ease: ease ?? Utils.Ease.inOut,
      onUpdate: v => obj.quaternion.slerpQuaternions(startQ, endQ, v),
      onComplete,
    });
  };

  /* ── Camera smooth transition ── */
  const cameraTo = (camera, targetPos, targetLookAt, dur, onComplete) => {
    const startPos = camera.position.clone();
    return tween({
      from:0, to:1, dur: dur ?? 800, ease: Utils.Ease.outCubic,
      onUpdate: v => {
        camera.position.lerpVectors(startPos, targetPos, v);
        camera.lookAt(targetLookAt);
      },
      onComplete,
    });
  };

  /* ── Explosion: scatter cubies outward ── */
  const explode = (cubies, center, radius, dur, onComplete) => {
    const starts = cubies.map(c => c.position.clone());
    const ends   = cubies.map(c => {
      const dir = c.position.clone().sub(center).normalize();
      return c.position.clone().add(dir.multiplyScalar(radius));
    });
    return tween({
      from:0, to:1, dur: dur ?? 600, ease: Utils.Ease.outBack,
      onUpdate: v => cubies.forEach((c,i) => c.position.lerpVectors(starts[i], ends[i], v)),
      onComplete,
    });
  };

  /* ── Implode: gather cubies back ── */
  const implode = (cubies, starts, ends, dur, onComplete) => {
    return tween({
      from:0, to:1, dur: dur ?? 500, ease: Utils.Ease.elastic,
      onUpdate: v => cubies.forEach((c,i) => c.position.lerpVectors(starts[i], ends[i], v)),
      onComplete,
    });
  };

  /* ── Pulse scale on an object ── */
  const pulse = (obj, scale, dur) => {
    const orig = obj.scale.clone();
    tween({
      from:1, to:scale, dur:dur/2, ease:Utils.Ease.outCubic,
      onUpdate: v => obj.scale.setScalar(v),
      onComplete: () => tween({
        from:scale, to:1, dur:dur/2, ease:Utils.Ease.inCubic,
        onUpdate: v => obj.scale.setScalar(v),
      }),
    });
  };

  /* ── Float particles for victory ── */
  const victoryParticles = (container) => {
    container.innerHTML = '';
    const colors = ['#6c63ff','#ff6584','#43e97b','#ffd700','#00ffff','#ff4500'];
    for(let i=0;i<40;i++){
      const p = document.createElement('div');
      p.className = 'vp';
      p.style.cssText = `
        left:${Utils.randInt(10,90)}%;
        top:${Utils.randInt(20,80)}%;
        background:${colors[Utils.randInt(0,colors.length-1)]};
        --tx:${Utils.randInt(-120,120)}px;
        --ty:${Utils.randInt(-150,-30)}px;
        animation-delay:${Utils.randInt(0,600)}ms;
        width:${Utils.randInt(5,12)}px;
        height:${Utils.randInt(5,12)}px;
      `;
      container.appendChild(p);
    }
  };

  /* ── Shake camera ── */
  const shakeCamera = (camera, intensity, dur) => {
    const orig = camera.position.clone();
    let elapsed = 0;
    const step = 16;
    const id = setInterval(() => {
      elapsed += step;
      if(elapsed >= dur){ camera.position.copy(orig); clearInterval(id); return; }
      const decay = 1 - elapsed/dur;
      camera.position.set(
        orig.x + (Math.random()-0.5)*intensity*decay,
        orig.y + (Math.random()-0.5)*intensity*decay,
        orig.z + (Math.random()-0.5)*intensity*decay,
      );
    }, step);
  };

  return { tween, update, cancel, rotateObject, cameraTo,
           explode, implode, pulse, victoryParticles, shakeCamera };
})();
