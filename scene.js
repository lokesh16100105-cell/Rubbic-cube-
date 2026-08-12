/* ═══════════════════════════════════════════════════════════
   scene.js  ·  Three.js scene, lighting, particles, glow
═══════════════════════════════════════════════════════════ */
'use strict';

const Scene3D = (() => {

  let renderer, scene, camera;
  let particleSystem, particlePositions, particleVelocities;
  let gridHelper, ambientLight, dirLight, pointLights = [];
  let frameCount = 0, lastFpsTime = 0, fps = 60, lastTime = 0;
  let particlesEnabled = true;

  let fallbackContainer = null;
  let fallbackCube = null;
  let fallbackAngle = { x: 22, y: 45 };
  let fallbackDrag = { active:false, startX:0, startY:0, lastX:45, lastY:22 };
  let canvasElement = null;

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  const init = () => {
    const canvas = document.getElementById('c');

    /* ── Renderer ── */
    const context = canvas.getContext('webgl2', { antialias:true, powerPreference:'high-performance' })
                 || canvas.getContext('webgl',  { antialias:true, powerPreference:'high-performance' });
    if(!context){
      _showWebGLError();
      return null;
    }

    try {
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias:true, powerPreference:'high-performance' });
    } catch(error){
      console.error('WebGLRenderer initialization failed:', error);
      _showWebGLError();
      return null;
    }

    canvasElement = canvas;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled  = true;
    renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding      = THREE.sRGBEncoding;

    _showCanvas();

    /* ── Scene ── */
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070f);
    scene.fog = new THREE.FogExp2(0x07070f, 0.035);

    /* ── Camera ── */
    camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
    camera.position.set(5, 4, 7);
    camera.lookAt(0, 0, 0);

    _setupLights();
    _setupEnvironment();
    _setupParticles();

    window.addEventListener('resize', _onResize);
    return { renderer, scene, camera };
  };

  /* ══════════════════════════════════════
     LIGHTING
  ══════════════════════════════════════ */
  const _setupLights = () => {
    ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Key light — warm overhead
    dirLight = new THREE.DirectionalLight(0xfffaf0, 2.2);
    dirLight.position.set(5, 10, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near  = 0.5;
    dirLight.shadow.camera.far   = 50;
    dirLight.shadow.camera.left  = dirLight.shadow.camera.bottom = -6;
    dirLight.shadow.camera.right = dirLight.shadow.camera.top    =  6;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Fill light — cool left side
    const fill = new THREE.DirectionalLight(0xddeeff, 0.8);
    fill.position.set(-8, 3, -3);
    scene.add(fill);

    // Rim light — back right to separate cube from background
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(4, -2, -8);
    scene.add(rim);

    // Soft bounce from below
    const bounce = new THREE.DirectionalLight(0xffffff, 0.2);
    bounce.position.set(0, -6, 4);
    scene.add(bounce);
  };

  /* ══════════════════════════════════════
     ENVIRONMENT
  ══════════════════════════════════════ */
  const _setupEnvironment = () => {
    gridHelper = new THREE.GridHelper(30, 30, 0x222244, 0x111133);
    gridHelper.position.y = -3.5;
    gridHelper.material.opacity    = 0.4;
    gridHelper.material.transparent= true;
    scene.add(gridHelper);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color:0x050510, roughness:0.1, metalness:0.8 })
    );
    floor.rotation.x = -Math.PI/2;
    floor.position.y = -3.6;
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.02, 8, 80),
      new THREE.MeshBasicMaterial({ color:0x6c63ff, transparent:true, opacity:0.25 })
    );
    ring.rotation.x = Math.PI/2;
    ring.position.y = -3.4;
    scene.add(ring);
  };

  /* ══════════════════════════════════════
     PARTICLES
  ══════════════════════════════════════ */
  const _setupParticles = () => {
    const COUNT = 280;
    const pos   = new Float32Array(COUNT * 3);
    const col   = new Float32Array(COUNT * 3);
    particleVelocities = [];

    const colors = [
      new THREE.Color(0x6c63ff), new THREE.Color(0xff6584),
      new THREE.Color(0x43e97b), new THREE.Color(0x00ffff), new THREE.Color(0xffd700),
    ];

    for(let i=0; i<COUNT; i++){
      pos[i*3]   = (Math.random()-0.5)*24;
      pos[i*3+1] = (Math.random()-0.5)*16;
      pos[i*3+2] = (Math.random()-0.5)*24;
      const c = colors[Math.floor(Math.random()*colors.length)];
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
      particleVelocities.push({
        x:(Math.random()-0.5)*0.008,
        y:(Math.random()-0.5)*0.006+0.002,
        z:(Math.random()-0.5)*0.008,
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    particlePositions = pos;

    particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({
      size:0.07, vertexColors:true, transparent:true, opacity:0.75, sizeAttenuation:true,
    }));
    scene.add(particleSystem);
  };

  /* remove unused glow functions — fully deleted */
  /* ══════════════════════════════════════
     UPDATE HELPERS
  ══════════════════════════════════════ */
  const _updateParticles = () => {
    if(!particlesEnabled || !particleSystem) return;
    const pos = particlePositions, n = pos.length/3;
    for(let i=0; i<n; i++){
      pos[i*3]   += particleVelocities[i].x;
      pos[i*3+1] += particleVelocities[i].y;
      pos[i*3+2] += particleVelocities[i].z;
      if(pos[i*3]   >  12) pos[i*3]   = -12;
      if(pos[i*3]   < -12) pos[i*3]   =  12;
      if(pos[i*3+1] >   8) pos[i*3+1] = -8;
      if(pos[i*3+1] <  -8) pos[i*3+1] =  8;
      if(pos[i*3+2] >  12) pos[i*3+2] = -12;
      if(pos[i*3+2] < -12) pos[i*3+2] =  12;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.rotation.y += 0.0003;
  };

  const _updateLights = () => {};

  /* ══════════════════════════════════════
     RENDER LOOP
  ══════════════════════════════════════ */
  const render = (timestamp) => {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    frameCount++;
    if(timestamp - lastFpsTime >= 1000){
      fps = frameCount; frameCount = 0; lastFpsTime = timestamp;
      document.getElementById('sbFps').textContent = fps;
    }

    const t = timestamp * 0.001;
    Animations.update(dt * 1000);
    Controls.update();
    _updateParticles();
    _updateLights(t);

    if(gridHelper) gridHelper.material.opacity = 0.3 + Math.sin(t*0.5)*0.08;

    renderer.render(scene, camera);
  };

  /* ══════════════════════════════════════
     RESIZE
  ══════════════════════════════════════ */
  const _hideCanvas = () => {
    if(!canvasElement) canvasElement = document.getElementById('c');
    if(canvasElement) canvasElement.style.display = 'none';
  };

  const _showCanvas = () => {
    if(!canvasElement) canvasElement = document.getElementById('c');
    if(canvasElement) canvasElement.style.display = 'block';
  };

  const _onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    if(camera){
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    }
    if(renderer){
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  };

  const _bindFallbackEvents = () => {
    if(!fallbackContainer) return;
    const container = fallbackContainer.querySelector('#fallbackCubeContainer');
    if(!container) return;

    container.addEventListener('pointerdown', e => {
      fallbackDrag.active = true;
      fallbackDrag.startX = e.clientX;
      fallbackDrag.startY = e.clientY;
      container.setPointerCapture(e.pointerId);
    });

    container.addEventListener('pointermove', e => {
      if(!fallbackDrag.active) return;
      const dx = e.clientX - fallbackDrag.startX;
      const dy = e.clientY - fallbackDrag.startY;
      fallbackAngle.y = fallbackDrag.lastX + dx * 0.4;
      fallbackAngle.x = Math.min(80, Math.max(-80, fallbackDrag.lastY + dy * 0.4));
      _updateFallback();
    });

    container.addEventListener('pointerup', () => {
      fallbackDrag.active = false;
      fallbackDrag.lastX = fallbackAngle.y;
      fallbackDrag.lastY = fallbackAngle.x;
    });
    container.addEventListener('pointercancel', () => {
      fallbackDrag.active = false;
      fallbackDrag.lastX = fallbackAngle.y;
      fallbackDrag.lastY = fallbackAngle.x;
    });
  };

  const _updateFallback = () => {
    if(!fallbackCube) return;
    fallbackCube.style.transform = `rotateX(${fallbackAngle.x}deg) rotateY(${fallbackAngle.y}deg)`;
  };

  const _createFallback = () => {
    if(fallbackContainer) return;
    fallbackContainer = document.createElement('div');
    fallbackContainer.id = 'fallbackScene';
    fallbackContainer.innerHTML = `
      <div id="fallbackContent">
        <div id="fallbackCubeContainer">
          <div id="fallbackCube">
            <div class="fallbackFace front"></div>
            <div class="fallbackFace back"></div>
            <div class="fallbackFace left"></div>
            <div class="fallbackFace right"></div>
            <div class="fallbackFace top"></div>
            <div class="fallbackFace bottom"></div>
          </div>
        </div>
        <div id="fallbackText">
          <h1>WebGL unavailable</h1>
          <p>Your browser does not support WebGL, but you can still rotate the cube with touch or drag gestures.</p>
          <p>Use a modern browser on desktop or mobile for the full 3D experience.</p>
        </div>
      </div>
    `;
    document.body.appendChild(fallbackContainer);
    fallbackCube = fallbackContainer.querySelector('#fallbackCube');
    _updateFallback();
    _bindFallbackEvents();
  };

  const _showWebGLError = () => {
    _hideCanvas();
    _createFallback();
    const loading = document.getElementById('loading');
    if(loading) loading.classList.add('out');
  };

  const setThemeColors = (accent) => {
    if(ambientLight) ambientLight.color.set(0xffffff);
  };

  const setBloom = v => {};

  const setParticles = v => {
    particlesEnabled = v;
    if(particleSystem) particleSystem.visible = v;
  };

  const setShadows = v => {
    renderer.shadowMap.enabled = v;
    dirLight.castShadow = v;
  };

  const getScene    = () => scene;
  const getCamera   = () => camera;
  const getRenderer = () => renderer;
  const getFPS      = () => fps;

  return { init, render, setThemeColors, setBloom, setParticles,
           setShadows, getScene, getCamera, getRenderer, getFPS };
})();
