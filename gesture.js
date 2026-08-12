/* ═══════════════════════════════════════════════════════════
   gesture.js  ·  Finger position → Row / Column cube control
   
   HOW IT WORKS:
   - Point your index finger at the camera
   - Screen is divided into a 3×3 zone grid
   - Swipe LEFT/RIGHT  → moves that horizontal ROW (U / E / D layer)
   - Swipe UP/DOWN     → moves that vertical COLUMN (L / M / R layer)
   - Zone Y position   → which row  (top=U, mid=E, bot=D)
   - Zone X position   → which col  (left=L, mid=M, right=R)
═══════════════════════════════════════════════════════════ */
'use strict';

const GestureControl = (() => {

  let model         = null;
  let video         = null;
  let overlayCanvas = null;
  let ctx           = null;
  let running       = false;
  let enabled       = false;
  let statusEl      = null;

  const COOLDOWN    = 750;   // ms between moves
  const SWIPE_MIN   = 40;    // px finger must travel to fire a move
  const DEAD_ZONE   = 12;    // px — ignore tiny jitter

  let lastMoveTime  = 0;
  let swipeLocked   = false;
  let prevTip       = null;  // previous index fingertip position
  let startTip      = null;  // fingertip position when swipe started
  let tipZone       = { col: 1, row: 1 }; // 0=left/top, 1=mid, 2=right/bot

  /* ══════════════════════════════════════
     ZONE → MOVE TABLE
     col: 0=left, 1=mid, 2=right
     row: 0=top,  1=mid, 2=bot
  ══════════════════════════════════════ */
  //  swipe horizontal (left/right) → row move
  //  row 0 (top)    → U / Up
  //  row 1 (middle) → E / Ep
  //  row 2 (bottom) → D / Dp
  const ROW_MOVES = [
    { right: 'Up', left: 'U'  },   // top row    — swipe right = U', left = U
    { right: 'Ep', left: 'E'  },   // middle row — swipe right = E', left = E
    { right: 'D',  left: 'Dp' },   // bottom row — swipe right = D,  left = D'
  ];

  //  swipe vertical (up/down) → column move
  //  col 0 (left)   → L / Lp
  //  col 1 (middle) → M / Mp
  //  col 2 (right)  → R / Rp
  const COL_MOVES = [
    { up: 'Lp', down: 'L'  },   // left col
    { up: 'Mp', down: 'M'  },   // middle col
    { up: 'R',  down: 'Rp' },   // right col
  ];

  /* ══════════════════════════════════════
     BUILD UI
  ══════════════════════════════════════ */
  const _buildUI = () => {
    const panel = document.createElement('div');
    panel.id = 'gesturePanel';
    panel.innerHTML = `
      <div id="gesturePanelHeader">
        <span id="gestureTitle">☝️ Finger Control</span>
        <button id="gestureToggle" class="abtn sm">Enable</button>
      </div>
      <div id="gestureFeed" class="hidden">
        <div id="gestureCamWrap">
          <video id="gestureVideo" autoplay playsinline muted></video>
          <canvas id="gestureCanvas"></canvas>
          <div id="gestureZoneOverlay"></div>
        </div>
        <div id="gestureStatus">Initializing…</div>
        <div id="gestureGuide">
          <div class="gg-title">☝️ Point finger at camera</div>
          <div class="gg-row"><span class="gg-ico">↔️</span><span>Swipe L/R → Row moves</span></div>
          <div class="gg-row"><span class="gg-ico">↕️</span><span>Swipe U/D → Col moves</span></div>
          <div class="gg-row"><span class="gg-ico">📍</span><span>Position = which row/col</span></div>
          <div class="gg-grid-label">
            <div>Top row → U layer</div>
            <div>Mid row → E layer</div>
            <div>Bot row → D layer</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    video         = document.getElementById('gestureVideo');
    overlayCanvas = document.getElementById('gestureCanvas');
    ctx           = overlayCanvas.getContext('2d');
    statusEl      = document.getElementById('gestureStatus');

    document.getElementById('gestureToggle').addEventListener('click', toggle);
  };

  /* ══════════════════════════════════════
     INIT / TOGGLE / START / STOP
  ══════════════════════════════════════ */
  const init = () => { _buildUI(); };

  const toggle = async () => { enabled ? _stop() : await _start(); };

  const _start = async () => {
    document.getElementById('gestureFeed').classList.remove('hidden');
    document.getElementById('gestureToggle').textContent = 'Disable';
    _setStatus('📷 Requesting camera…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      });
      video.srcObject = stream;
      await new Promise(r => { video.onloadedmetadata = r; });
      video.play();
      overlayCanvas.width  = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      _setStatus('🧠 Loading model…');
      if (!model) model = await handpose.load({ detectionConfidence: 0.85 });

      _setStatus('☝️ Point your finger!');
      enabled = true;
      running = true;
      _loop();
    } catch (e) {
      _setStatus('❌ ' + e.message);
      document.getElementById('gestureToggle').textContent = 'Enable';
      document.getElementById('gestureFeed').classList.add('hidden');
    }
  };

  const _stop = () => {
    running = false;
    enabled = false;
    document.getElementById('gestureToggle').textContent = 'Enable';
    document.getElementById('gestureFeed').classList.add('hidden');
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    prevTip = null; startTip = null; swipeLocked = false;
  };

  /* ══════════════════════════════════════
     MAIN DETECTION LOOP
  ══════════════════════════════════════ */
  const _loop = async () => {
    if (!running) return;
    try {
      const preds = await model.estimateHands(video);

      // Draw mirrored video
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -overlayCanvas.width, 0, overlayCanvas.width, overlayCanvas.height);
      ctx.restore();

      // Draw zone grid
      _drawGrid();

      if (preds.length > 0) {
        const lm = preds[0].landmarks;
        // Mirror X for display (camera is mirrored)
        const mirror = lm.map(p => [overlayCanvas.width - p[0], p[1], p[2]]);

        _drawSkeleton(mirror);

        // Index fingertip = landmark 8 (mirrored)
        const tip = mirror[8];
        _highlightTip(tip);
        _updateZone(tip);
        _detectSwipe(tip);
      } else {
        prevTip  = null;
        startTip = null;
        swipeLocked = false;
        _setStatus('☝️ Show your hand…');
      }
    } catch (_) {}
    requestAnimationFrame(_loop);
  };

  /* ══════════════════════════════════════
     DRAW HELPERS
  ══════════════════════════════════════ */
  const _drawGrid = () => {
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;
    const c = tipZone.col;
    const r = tipZone.row;

    // Shade active zone
    ctx.fillStyle = 'rgba(0,255,136,0.12)';
    ctx.fillRect(c * (w/3), r * (h/3), w/3, h/3);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i*w/3, 0); ctx.lineTo(i*w/3, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*h/3); ctx.lineTo(w, i*h/3); ctx.stroke();
    }

    // Zone labels
    const labels = [['U','E','D'],['U','E','D'],['U','E','D']];
    const colLabels = ['L','M','R'];
    ctx.font      = 'bold 10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'center';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillText(
          colLabels[col] + '/' + labels[row][col],
          col * (w/3) + w/6,
          row * (h/3) + h/6
        );
      }
    }
  };

  const _drawSkeleton = (kp) => {
    const bones = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],
      [0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20],
      [5,9],[9,13],[13,17],
    ];
    ctx.strokeStyle = 'rgba(0,255,136,0.7)';
    ctx.lineWidth   = 1.5;
    bones.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(kp[a][0], kp[a][1]);
      ctx.lineTo(kp[b][0], kp[b][1]);
      ctx.stroke();
    });
  };

  const _highlightTip = (tip) => {
    // Outer ring
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 12, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth   = 2;
    ctx.stroke();
    // Inner dot
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffff00';
    ctx.fill();

    // Draw swipe trail if swiping
    if (startTip) {
      ctx.beginPath();
      ctx.moveTo(startTip[0], startTip[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.strokeStyle = 'rgba(255,255,0,0.6)';
      ctx.lineWidth   = 3;
      ctx.stroke();
    }
  };

  /* ══════════════════════════════════════
     ZONE TRACKING
     Divides camera view into 3×3 grid
  ══════════════════════════════════════ */
  const _updateZone = (tip) => {
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;
    tipZone.col = Math.min(2, Math.floor(tip[0] / (w / 3)));
    tipZone.row = Math.min(2, Math.floor(tip[1] / (h / 3)));
  };

  /* ══════════════════════════════════════
     SWIPE DETECTION
  ══════════════════════════════════════ */
  const _detectSwipe = (tip) => {
    const now = Date.now();

    if (swipeLocked) {
      // Unlock when finger returns near start or stops moving
      if (prevTip) {
        const d = Math.hypot(tip[0]-prevTip[0], tip[1]-prevTip[1]);
        if (d < DEAD_ZONE) swipeLocked = false;
      }
      prevTip = tip;
      return;
    }

    if (!startTip) {
      startTip = tip;
      prevTip  = tip;
      return;
    }

    const dx   = tip[0] - startTip[0];
    const dy   = tip[1] - startTip[1];
    const dist = Math.hypot(dx, dy);

    if (dist >= SWIPE_MIN && now - lastMoveTime > COOLDOWN) {
      // Determine swipe direction
      const isHorizontal = Math.abs(dx) >= Math.abs(dy);

      let moveName, label;

      if (isHorizontal) {
        // Horizontal swipe → row move based on tipZone.row
        const entry = ROW_MOVES[tipZone.row];
        moveName = dx > 0 ? entry.right : entry.left;
        const rowName = ['Top (U)', 'Mid (E)', 'Bot (D)'][tipZone.row];
        label = (dx > 0 ? '→ ' : '← ') + rowName + ' → ' + moveName;
      } else {
        // Vertical swipe → column move based on tipZone.col
        const entry = COL_MOVES[tipZone.col];
        moveName = dy < 0 ? entry.up : entry.down;
        const colName = ['Left (L)', 'Mid (M)', 'Right (R)'][tipZone.col];
        label = (dy < 0 ? '↑ ' : '↓ ') + colName + ' → ' + moveName;
      }

      _fireMove(moveName, label);
      lastMoveTime = now;
      startTip     = null;
      prevTip      = null;
      swipeLocked  = true;
      return;
    }

    // Reset start if finger has been still too long
    if (dist < DEAD_ZONE) {
      startTip = tip;
    }

    prevTip = tip;
  };

  /* ══════════════════════════════════════
     FIRE MOVE
  ══════════════════════════════════════ */
  const _fireMove = (moveName, label) => {
    _setStatus('✅ ' + label);

    // Flash title green
    const title = document.getElementById('gestureTitle');
    title.style.color = '#00ff88';
    setTimeout(() => { title.style.color = ''; }, 500);

    if (typeof Cube !== 'undefined') Cube.move(moveName, true);
  };

  const _setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  return { init, toggle };
})();
