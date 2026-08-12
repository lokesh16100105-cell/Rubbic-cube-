/* ═══════════════════════════════════════════════════════════
   controls.js  ·  Mouse / Touch / Keyboard / Orbit camera
═══════════════════════════════════════════════════════════ */
'use strict';

const Controls = (() => {

  /* ── State ── */
  let camera, renderer, cubeGroup;
  let canvas;

  /* Orbit state */
  let orbitEnabled  = true;
  let autoRotate    = false;
  let autoRotSpeed  = 0.004;
  let camSensitivity= 1.0;

  let isDragging    = false;
  let isOrbit       = false;
  let dragStart     = { x:0, y:0 };
  let lastMouse     = { x:0, y:0 };
  let spherical     = { theta: Math.PI/4, phi: Math.PI/3, radius: 7 };
  let targetSpherical = { theta: Math.PI/4, phi: Math.PI/3, radius: 7 };

  /* Face-drag state */
  let hitCubie      = null;
  let hitFaceNormal = null;
  let dragAxis      = null;
  let dragLayer     = null;
  let dragStartPos  = null;
  let dragMoved     = false;

  /* Raycaster */
  let raycaster, mouse;

  /* Double-click reset */
  let lastClickTime = 0;

  /* ── Init ── */
  const init = (cam, rend, group) => {
    camera   = cam;
    renderer = rend;
    cubeGroup= group;
    canvas   = rend.domElement;

    raycaster = new THREE.Raycaster();
    mouse     = new THREE.Vector2();

    _bindEvents();
    _updateCamera();
  };

  /* ══════════════════════════════════════
     CAMERA MATH
  ══════════════════════════════════════ */
  const _updateCamera = () => {
    const { theta, phi, radius } = spherical;
    camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(0,0,0);
  };

  const _lerpCamera = () => {
    const s = 0.1;
    spherical.theta  += (targetSpherical.theta  - spherical.theta)  * s;
    spherical.phi    += (targetSpherical.phi    - spherical.phi)    * s;
    spherical.radius += (targetSpherical.radius - spherical.radius) * s;
    spherical.phi = Utils.clamp(spherical.phi, 0.15, Math.PI - 0.15);
    _updateCamera();
  };

  /* ══════════════════════════════════════
     RAYCASTING
  ══════════════════════════════════════ */
  const _getMouseNDC = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x:  ((clientX - rect.left) / rect.width)  * 2 - 1,
      y: -((clientY - rect.top)  / rect.height) * 2 + 1,
    };
  };

  const _raycast = (clientX, clientY) => {
    const ndc = _getMouseNDC(clientX, clientY);
    mouse.set(ndc.x, ndc.y);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(Cube.getCubies(), true);
    if(hits.length === 0) return null;
    // Find the cubie parent
    let obj = hits[0].object;
    while(obj.parent && !Cube.getCubies().includes(obj)) obj = obj.parent;
    return { cubie: obj, face: hits[0].face, point: hits[0].point, normal: hits[0].face.normal };
  };

  /* ══════════════════════════════════════
     DRAG → MOVE MAPPING
  ══════════════════════════════════════ */
  const _determineMoveFromDrag = (dx, dy, faceNormal, cubie) => {
    // Transform face normal to world space
    const wn = faceNormal.clone().transformDirection(cubie.matrixWorld).normalize();
    const absX = Math.abs(wn.x), absY = Math.abs(wn.y), absZ = Math.abs(wn.z);

    // Dominant face axis
    let faceAxis;
    if(absX > absY && absX > absZ)      faceAxis = 'x';
    else if(absY > absX && absY > absZ) faceAxis = 'y';
    else                                 faceAxis = 'z';

    const gx = cubie.userData.gx;
    const gy = cubie.userData.gy;
    const gz = cubie.userData.gz;

    // Drag direction
    const horizontal = Math.abs(dx) > Math.abs(dy);

    // Map face + drag direction → move
    const map = {
      y: {
        h: dx > 0
          ? (gy===1?'U':gy===0?'E':gy===-1?'Dp':null)
          : (gy===1?'Up':gy===0?'Ep':gy===-1?'D':null),
        v: dy > 0
          ? (gz===1?'Fp':gz===0?'Sp':gz===-1?'B':null)
          : (gz===1?'F':gz===0?'S':gz===-1?'Bp':null),
      },
      x: {
        h: dx > 0
          ? (gz===1?'F':gz===0?'S':gz===-1?'Bp':null)
          : (gz===1?'Fp':gz===0?'Sp':gz===-1?'B':null),
        v: dy > 0
          ? (gx===1?'Rp':gx===0?'Mp':gx===-1?'L':null)
          : (gx===1?'R':gx===0?'M':gx===-1?'Lp':null),
      },
      z: {
        h: dx > 0
          ? (gy===1?'U':gy===0?'E':gy===-1?'Dp':null)
          : (gy===1?'Up':gy===0?'Ep':gy===-1?'D':null),
        v: dy > 0
          ? (gx===1?'Rp':gx===0?'Mp':gx===-1?'L':null)
          : (gx===1?'R':gx===0?'M':gx===-1?'Lp':null),
      },
    };

    const dir = horizontal ? 'h' : 'v';
    return map[faceAxis]?.[dir] ?? null;
  };

  /* ══════════════════════════════════════
     POINTER EVENTS
  ══════════════════════════════════════ */
  const _onPointerDown = (clientX, clientY) => {
    dragStart  = { x:clientX, y:clientY };
    lastMouse  = { x:clientX, y:clientY };
    dragMoved  = false;
    isDragging = true;

    // Double-click → reset camera
    const now = Date.now();
    if(now - lastClickTime < 300){
      _resetCamera();
      lastClickTime = 0;
      return;
    }
    lastClickTime = now;

    // Try to hit a cubie
    const hit = _raycast(clientX, clientY);
    if(hit && !Cube.getIsAnimating()){
      hitCubie      = hit.cubie;
      hitFaceNormal = hit.normal.clone();
      isOrbit       = false;
    } else {
      hitCubie = null;
      isOrbit  = true;
    }
  };

  const _onPointerMove = (clientX, clientY) => {
    if(!isDragging) return;
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if(dist < 8) return; // dead zone
    dragMoved = true;

    if(isOrbit || !hitCubie){
      // Orbit camera
      const ddx = (clientX - lastMouse.x) * 0.008 * camSensitivity;
      const ddy = (clientY - lastMouse.y) * 0.008 * camSensitivity;
      targetSpherical.theta -= ddx;
      targetSpherical.phi   += ddy;
      targetSpherical.phi = Utils.clamp(targetSpherical.phi, 0.15, Math.PI-0.15);
    }

    lastMouse = { x:clientX, y:clientY };
  };

  const _onPointerUp = (clientX, clientY) => {
    if(!isDragging){ isDragging=false; return; }
    isDragging = false;

    if(!dragMoved) return; // was a click, not drag

    if(hitCubie && !isOrbit && !Cube.getIsAnimating()){
      const dx = clientX - dragStart.x;
      const dy = clientY - dragStart.y;
      const moveName = _determineMoveFromDrag(dx, dy, hitFaceNormal, hitCubie);
      if(moveName){
        Cube.move(moveName, true);
        Audio3D.resume();
      }
    }

    hitCubie = null;
  };

  /* ── Wheel zoom ── */
  const _onWheel = e => {
    e.preventDefault();
    targetSpherical.radius = Utils.clamp(
      targetSpherical.radius + e.deltaY * 0.01,
      3.5, 14
    );
  };

  /* ── Reset camera ── */
  const _resetCamera = () => {
    targetSpherical.theta  = Math.PI/4;
    targetSpherical.phi    = Math.PI/3;
    targetSpherical.radius = 7;
    UI.showToast('Camera reset');
  };

  /* ══════════════════════════════════════
     KEYBOARD
  ══════════════════════════════════════ */
  const _onKeyDown = e => {
    if(e.target.tagName === 'INPUT') return;
    const shift = e.shiftKey;
    const key   = e.key.toUpperCase();

    const keyMap = {
      'R': shift ? 'Rp' : 'R',
      'L': shift ? 'Lp' : 'L',
      'U': shift ? 'Up' : 'U',
      'D': shift ? 'Dp' : 'D',
      'F': shift ? 'Fp' : 'F',
      'B': shift ? 'Bp' : 'B',
      'M': shift ? 'Mp' : 'M',
      'E': shift ? 'Ep' : 'E',
      'S': shift ? 'Sp' : 'S',
    };

    if(keyMap[key]){
      e.preventDefault();
      Cube.move(keyMap[key], true);
      Audio3D.resume();
      return;
    }

    if(key === 'Z' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); Cube.undo(); return; }
    if(key === 'Z'){ e.preventDefault(); Cube.undo(); return; }
    if(key === 'Y'){ e.preventDefault(); Cube.redo(); return; }
  };

  /* ══════════════════════════════════════
     TOUCH EVENTS
  ══════════════════════════════════════ */
  const _onTouchStart = e => {
    e.preventDefault();
    const t = e.touches[0];
    _onPointerDown(t.clientX, t.clientY);
  };
  const _onTouchMove = e => {
    e.preventDefault();
    const t = e.touches[0];
    _onPointerMove(t.clientX, t.clientY);
  };
  const _onTouchEnd = e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    _onPointerUp(t.clientX, t.clientY);
  };

  /* ══════════════════════════════════════
     BIND / UNBIND
  ══════════════════════════════════════ */
  const _bindEvents = () => {
    canvas.addEventListener('mousedown',  e => _onPointerDown(e.clientX, e.clientY));
    canvas.addEventListener('mousemove',  e => _onPointerMove(e.clientX, e.clientY));
    canvas.addEventListener('mouseup',    e => _onPointerUp(e.clientX, e.clientY));
    canvas.addEventListener('wheel',      _onWheel, { passive:false });
    canvas.addEventListener('touchstart', _onTouchStart, { passive:false });
    canvas.addEventListener('touchmove',  _onTouchMove,  { passive:false });
    canvas.addEventListener('touchend',   _onTouchEnd,   { passive:false });
    window.addEventListener('keydown',    _onKeyDown);
    window.addEventListener('mouseup',    e => { if(isDragging) _onPointerUp(e.clientX, e.clientY); });
  };

  /* ══════════════════════════════════════
     UPDATE (called each frame)
  ══════════════════════════════════════ */
  const update = () => {
    _lerpCamera();
    if(autoRotate && !isDragging && !Cube.getIsAnimating()){
      targetSpherical.theta += autoRotSpeed;
    }
  };

  /* ── Public API ── */
  const setAutoRotate   = v  => { autoRotate    = v; };
  const getAutoRotate   = () => autoRotate;
  const setCamSensitivity=v  => { camSensitivity = v; };
  const resetCamera     = () => _resetCamera();
  const getSpherical    = () => ({ ...spherical });

  return { init, update, setAutoRotate, getAutoRotate,
           setCamSensitivity, resetCamera, getSpherical };
})();
