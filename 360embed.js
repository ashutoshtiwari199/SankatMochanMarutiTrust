/* ============================================================
   360° EMBEDDED PLAYER – Sankat Mochan Maruti Trust
   Depends on: THREE (three.js r128, loaded globally in index.html)
   Does NOT modify 360player.html
   ============================================================ */

(function () {
  'use strict';

  // ── Video sources (ordered best → worst quality) ──────────
  const R2 = 'https://pub-dadee806f4a548a0aa824b124fbdaeaa.r2.dev';
  const SOURCES = [
    { label: '4K',    url: R2 + '/village_entry_4k.mp4',   minMbps: 10 },
    { label: '2K',    url: R2 + '/village_entry_2k.mp4',   minMbps:  5 },
    { label: '1080p', url: R2 + '/village_entry_1080.mp4', minMbps:  2 },
    { label: '720p',  url: R2 + '/village_entry_720.mp4',  minMbps:  0 },
  ];

  // ── Ambient audio (place copyright-free file at this path) ─
  const AMBIENT_SRC = './assets/ambient.mp3';

  // ── DOM refs (injected into #tourSceneWrap) ────────────────
  let wrap, canvas;

  // ── THREE state ────────────────────────────────────────────
  let renderer, scene3, camera, sphere, texture, animId;
  let vidEl = null;
  let currentSrc = null;
  let savedTime = 0, wasPlaying = false;

  // ── Ambient audio state ────────────────────────────────────
  let ambEl = null;
  let ambMuted = true;  // starts muted; user opts in

  // ── Look controls ──────────────────────────────────────────
  let isDragging = false, prevX = 0, prevY = 0;
  let yaw = 0, pitch = 0;
  let fov = 80;
  let pinchDist = null;

  // ── FPS ────────────────────────────────────────────────────
  let fpsFrames = 0, fpsLast = performance.now();

  // ── Gyro ──────────────────────────────────────────────────
  let gyroActive = false;
  let gyroTargetQuat = null;
  let gyroSmoothQuat = null;
  let gyroDeltaYaw = 0, gyroDeltaPitch = 0;
  let _gQ1, _gZee, _gEuler, _gQTmp, _gCorrE, _gCorrQ;

  // ── Auto-mode sources: 4K excluded (manual-only) ─────────
  const AUTO_SOURCES = SOURCES.filter(s => s.label !== '4K');

  // ── Manual quality override (null = auto) ─────────────────
  let manualQuality = null;

  // ── CSS fullscreen fallback ────────────────────────────────
  let cssFull = false;

  // ── Loop limiter ───────────────────────────────────────────
  const MAX_AUTO_LOOPS = 2;
  let loopCount = 0;

  // ── Auto-play via IntersectionObserver ────────────────────
  let hasStarted = false;    // first play triggered?
  let inViewport  = false;

  // ── Controls auto-hide ────────────────────────────────────
  let hideTimer = null;

  // ── Is mobile? ────────────────────────────────────────────
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // ══════════════════════════════════════════════════════════
  // BOOT – wait for THREE + DOM
  // ══════════════════════════════════════════════════════════
  function boot() {
    wrap   = document.getElementById('tourSceneWrap');
    canvas = document.getElementById('tour-canvas');
    if (!wrap || !canvas || typeof THREE === 'undefined') return;

    injectOverlays();
    detectQuality().then(src => {
      initThree();
      loadSource(src, false);
      initViewportObserver();
      initNetworkChangeWatcher();
    });
  }

  // ── Run after DOM ready ────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // THREE might not be loaded yet (script tag order) — poll briefly
    if (typeof THREE !== 'undefined') {
      boot();
    } else {
      const t = setInterval(() => {
        if (typeof THREE !== 'undefined') { clearInterval(t); boot(); }
      }, 50);
    }
  }

  // ══════════════════════════════════════════════════════════
  // INJECT OVERLAY HTML INTO #tourSceneWrap
  // ══════════════════════════════════════════════════════════
  function injectOverlays() {
    // Loading overlay
    const loadOv = document.createElement('div');
    loadOv.id = 'tourLoadOverlay';
    loadOv.className = 'tour-load-overlay';
    loadOv.innerHTML = `
      <div class="tour-spinner"></div>
      <div class="tour-load-msg" id="tourLoadMsg">गुणवत्ता जाँच रहे हैं…</div>`;
    wrap.appendChild(loadOv);

    // Quality dropdown menu (sibling of controls, outside pointer-events:none layer)
    const qMenu = document.createElement('div');
    qMenu.id = 'tourQMenu';
    qMenu.className = 'tour-q-menu hidden';
    qMenu.innerHTML = `
      <div class="tour-q-menu-label">Resolution</div>
      <button class="tour-q-opt active" data-q="auto">
        <span>AUTO <span style="color:#555;font-size:0.6em">(Internet Speed)</span></span>
        <span class="q-check">✓</span>
      </button>
      <div class="tour-q-divider"></div>
      <button class="tour-q-opt" data-q="4K"><span>4K</span><span class="q-check">✓</span></button>
      <button class="tour-q-opt" data-q="2K"><span>2K</span><span class="q-check">✓</span></button>
      <button class="tour-q-opt" data-q="1080p"><span>1080p</span><span class="q-check">✓</span></button>
      <button class="tour-q-opt" data-q="720p"><span>720p</span><span class="q-check">✓</span></button>`;
    wrap.appendChild(qMenu);

    // Controls overlay
    const ctrlOv = document.createElement('div');
    ctrlOv.className = 'tour-controls';
    ctrlOv.innerHTML = `
      <button class="tour-q-badge" id="tourQBadge" aria-haspopup="true" aria-expanded="false">
        <span id="tourQText">AUTO · –</span>
        <svg class="tour-q-chevron" viewBox="0 0 10 6" fill="currentColor" width="9" height="9">
          <path d="M0 0l5 6 5-6z"/>
        </svg>
      </button>
      <button class="tour-fs-btn" id="tourFsBtn" title="Fullscreen" aria-label="Fullscreen">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
          <path d="M1 1h4V3H3v2H1V1zm10 0h4v4h-2V3h-2V1zM1 11h2v2h2v2H1v-4zm12 2h-2v2h4v-4h-2v2z"/>
        </svg>
      </button>
      <div class="tour-center-play hidden" id="tourPlayBtn" role="button" aria-label="Play/Pause">
        <svg id="tourPlayIco" viewBox="0 0 24 24" fill="white" width="28" height="28">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
      </div>
      <button class="tour-audio-btn" id="tourAudioBtn" title="Toggle ambient sound" aria-label="Toggle ambient sound">
        <svg id="tourAudioIco" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
          <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      </button>
      <div class="tour-gyro-corner" id="tourGyroCorner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
        </svg>
        Gyro
      </div>
      <div class="tour-cam-btns">
        <button class="tour-cam-btn" id="tourZoomInBtn" title="Zoom In" aria-label="Zoom In">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="11" cy="11" r="7"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
        <button class="tour-cam-btn" id="tourZoomOutBtn" title="Zoom Out" aria-label="Zoom Out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="11" cy="11" r="7"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
        <button class="tour-cam-btn" id="tourResetBtn" title="Reset View" aria-label="Reset View">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8"/><path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>`;
    wrap.appendChild(ctrlOv);

    // Gyro prompt overlay (mobile only)
    if (isMobile && window.DeviceOrientationEvent) {
      const gyroOv = document.createElement('div');
      gyroOv.id = 'tourGyroOverlay';
      gyroOv.className = 'tour-gyro-overlay hidden'; // hidden until video starts
      gyroOv.innerHTML = `
        <div class="tour-gyro-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="2" width="14" height="20" rx="3"/>
            <circle cx="12" cy="17" r="1"/>
            <path d="M7 8h1M16 8h1M7 11h1M16 11h1" stroke-linecap="round"/>
            <path d="M3 10c-1 1.5-1 3.5 0 5M21 10c1 1.5 1 3.5 0 5" stroke-linecap="round"/>
          </svg>
          <p>Gyroscope से 360° वर्चुअल दर्शन करें</p>
          <button class="tour-gyro-enable" id="tourGyroEnableBtn">Gyroscope चालू करें</button>
          <button class="tour-gyro-skip" id="tourGyroSkipBtn">बाद में</button>
        </div>`;
      wrap.appendChild(gyroOv);

      document.getElementById('tourGyroEnableBtn').addEventListener('click', () => {
        requestGyro();
      });
      document.getElementById('tourGyroSkipBtn').addEventListener('click', () => {
        document.getElementById('tourGyroOverlay').classList.add('hidden');
      });
    }

    // Wire controls
    document.getElementById('tourFsBtn').addEventListener('click', toggleFS);
    document.getElementById('tourPlayBtn').addEventListener('click', togglePlay);
    document.getElementById('tourGyroCorner').addEventListener('click', () => {
      gyroActive ? disableGyro() : requestGyro();
    });
    document.getElementById('tourZoomInBtn').addEventListener('click',  () => zoomCam(-10));
    document.getElementById('tourZoomOutBtn').addEventListener('click', () => zoomCam(+10));
    document.getElementById('tourResetBtn').addEventListener('click',   resetView);
    document.getElementById('tourAudioBtn').addEventListener('click',   toggleAmbient);

    // Quality badge → toggle dropdown
    document.getElementById('tourQBadge').addEventListener('click', e => {
      e.stopPropagation();
      toggleQMenu();
    });

    // Quality menu option click
    qMenu.querySelectorAll('.tour-q-opt').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        selectQuality(btn.dataset.q);
        closeQMenu();
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', closeQMenu);
    wrap.addEventListener('click', e => { if (!e.target.closest('#tourQMenu') && !e.target.closest('#tourQBadge')) closeQMenu(); });

    // Show center play button on hover / tap
    wrap.addEventListener('mouseenter', showControls);
    wrap.addEventListener('mousemove', showControls);
    wrap.addEventListener('touchstart', showControls, { passive: true });
  }

  function zoomCam(delta) {
    fov = Math.max(30, Math.min(110, fov + delta));
    if (camera) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function resetView() {
    yaw = 0; pitch = 0; fov = 80;
    gyroDeltaYaw = 0; gyroDeltaPitch = 0;
    if (camera) { camera.fov = fov; camera.updateProjectionMatrix(); updateCamera(); }
  }

  // ── Quality menu helpers ────────────────────────────────────
  function toggleQMenu() {
    const menu  = document.getElementById('tourQMenu');
    const badge = document.getElementById('tourQBadge');
    if (!menu) return;
    const open = !menu.classList.contains('hidden');
    if (open) { menu.classList.add('hidden'); badge.setAttribute('aria-expanded', 'false'); }
    else       { menu.classList.remove('hidden'); badge.setAttribute('aria-expanded', 'true'); }
  }

  function closeQMenu() {
    const menu  = document.getElementById('tourQMenu');
    const badge = document.getElementById('tourQBadge');
    if (!menu) return;
    menu.classList.add('hidden');
    if (badge) badge.setAttribute('aria-expanded', 'false');
  }

  function selectQuality(q) {
    // Update active state in menu
    document.querySelectorAll('#tourQMenu .tour-q-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.q === q);
    });

    if (q === 'auto') {
      manualQuality = null;
      detectQuality().then(src => switchQuality(src));
    } else {
      const src = SOURCES.find(s => s.label === q);
      if (!src) return;
      manualQuality = src;
      switchQuality(src);
    }
  }

  function showControls() {
    const btn = document.getElementById('tourPlayBtn');
    if (!btn) return;
    btn.classList.remove('hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => btn.classList.add('hidden'), 2500);
  }

  // ══════════════════════════════════════════════════════════
  // QUALITY DETECTION
  // ══════════════════════════════════════════════════════════
  function pickSource(mbps) {
    return AUTO_SOURCES.find(s => mbps >= s.minMbps) || AUTO_SOURCES[AUTO_SOURCES.length - 1];
  }

  async function detectQuality() {
    try {
      // 1. Network Information API (Chrome/Android)
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && typeof conn.downlink === 'number' && conn.downlink > 0) {
        return pickSource(conn.downlink);
      }

      // 2. Timing probe — fetch a known asset and measure throughput
      const t0 = performance.now();
      const res = await fetch('./assets/trustPhoto.webp?_=' + Date.now(), { cache: 'no-store' });
      const buf = await res.arrayBuffer();
      const secs = (performance.now() - t0) / 1000;
      if (secs > 0 && buf.byteLength > 0) {
        const mbps = (buf.byteLength * 8) / (secs * 1e6);
        return pickSource(mbps);
      }
    } catch (_) { /* silent fallback */ }

    return SOURCES[SOURCES.length - 1]; // safe fallback: 720p
  }

  // ══════════════════════════════════════════════════════════
  // THREE.JS INIT
  // ══════════════════════════════════════════════════════════
  function initThree() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    resizeRenderer();

    scene3  = new THREE.Scene();
    camera  = new THREE.PerspectiveCamera(fov, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);

    // Inverted sphere — we look from inside
    const geo = new THREE.SphereGeometry(500, isMobile ? 48 : 64, isMobile ? 24 : 32);
    geo.scale(-1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    sphere = new THREE.Mesh(geo, mat);
    scene3.add(sphere);

    // Input events
    wrap.addEventListener('mousedown',  onDown);
    wrap.addEventListener('mousemove',  onMove);
    wrap.addEventListener('mouseup',    onUp);
    wrap.addEventListener('mouseleave', onUp);
    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchmove',  onTouchMove,  { passive: false });
    wrap.addEventListener('touchend',   onTouchEnd);
    wrap.addEventListener('wheel', e => {
      fov = Math.max(30, Math.min(110, fov + e.deltaY * 0.05));
      camera.fov = fov; camera.updateProjectionMatrix();
    }, { passive: true });

    window.addEventListener('resize', resizeRenderer);
    document.addEventListener('fullscreenchange',       resizeRenderer);
    document.addEventListener('webkitfullscreenchange', resizeRenderer);
    document.addEventListener('visibilitychange', () => {
      if (vidEl) { document.hidden ? vidEl.pause() : (inViewport && vidEl.play().catch(() => {})); }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (!vidEl) return;
      // Only activate if tour section is in viewport to avoid conflicting with other page keys
      if (!inViewport) return;
      if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') vidEl.currentTime = Math.min(vidEl.duration, vidEl.currentTime + 5);
      if (e.code === 'ArrowLeft')  vidEl.currentTime = Math.max(0, vidEl.currentTime - 5);
      if (e.code === 'Equal' || e.code === 'NumpadAdd')      zoomCam(-10);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomCam(+10);
      if (e.code === 'KeyR')       resetView();
      if (e.code === 'KeyF')       toggleFS();
      if (e.code === 'KeyG')       requestGyro();
    });

    // Render loop
    (function render(now) {
      animId = requestAnimationFrame(render);

      // Gyro smoothing
      if (gyroActive && gyroTargetQuat) {
        if (!gyroSmoothQuat) gyroSmoothQuat = gyroTargetQuat.clone();
        else gyroSmoothQuat.slerp(gyroTargetQuat, 0.12);
        if (gyroDeltaYaw !== 0 || gyroDeltaPitch !== 0) {
          _gCorrE.set(
            THREE.MathUtils.degToRad(gyroDeltaPitch),
            THREE.MathUtils.degToRad(gyroDeltaYaw),
            0, 'YXZ'
          );
          camera.quaternion.copy(_gCorrQ.setFromEuler(_gCorrE).multiply(gyroSmoothQuat));
        } else {
          camera.quaternion.copy(gyroSmoothQuat);
        }
      }

      if (vidEl && !vidEl.paused && texture) {
        const t = vidEl.currentTime;
        if (t !== render._lastT) { texture.needsUpdate = true; render._lastT = t; }
      }

      renderer.render(scene3, camera);

      // FPS counter
      fpsFrames++;
      if (now - fpsLast >= 1000) {
        const fps = Math.round(fpsFrames / ((now - fpsLast) / 1000));
        fpsFrames = 0; fpsLast = now;
        const t = document.getElementById('tourQText');
        const badge = document.getElementById('tourQBadge');
        if (t && currentSrc) {
          const prefix = manualQuality ? '⬛' : 'AUTO ·';
          t.textContent = `${prefix} ${currentSrc.label} · ${fps} FPS`;
        }
        if (badge) {
          badge.style.color = fps >= 50 ? '#6dffb3' : fps >= 30 ? 'var(--saffron)' : '#ff6b6b';
        }
      }
    })(performance.now());
  }

  function resizeRenderer() {
    if (!wrap || !renderer) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    if (camera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }

  // ══════════════════════════════════════════════════════════
  // LOAD / SWITCH SOURCE
  // ══════════════════════════════════════════════════════════
  function loadSource(src, resume) {
    currentSrc = src;
    updateQBadge();
    showLoad(true, src.label + ' लोड हो रहा है…');

    if (vidEl) { savedTime = vidEl.currentTime; wasPlaying = !vidEl.paused; vidEl.pause(); }

    if (texture) { texture.dispose(); texture = null; }
    if (sphere)  sphere.material.map = null;

    if (vidEl) { vidEl._dead = true; vidEl.src = ''; vidEl.load(); vidEl.remove(); }

    vidEl = document.createElement('video');
    loopCount = 0;
    vidEl.src = src.url;
    vidEl.crossOrigin  = 'anonymous';
    vidEl.loop         = false;  // manual loop so we can count plays
    vidEl.muted        = true;   // must start muted for autoplay policy
    vidEl.playsInline  = true;
    vidEl.preload      = 'auto';
    vidEl.style.display = 'none';
    document.body.appendChild(vidEl);

    vidEl.addEventListener('loadeddata', () => {
      texture = new THREE.VideoTexture(vidEl);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.format    = THREE.RGBAFormat;
      sphere.material   = new THREE.MeshBasicMaterial({ map: texture });
      showLoad(false);
      if (resume && savedTime > 0) vidEl.currentTime = savedTime;
      if (wasPlaying || !resume) {
        vidEl.play().catch(() => {});
        hasStarted = true;
      }
      updatePlayIcon();
      // On mobile: show gyro overlay after first play
      if (isMobile && !resume) {
        const ov = document.getElementById('tourGyroOverlay');
        if (ov) setTimeout(() => ov.classList.remove('hidden'), 1200);
      }
    });

    vidEl.addEventListener('waiting', () => showLoad(true, 'बफर हो रहा है…'));
    vidEl.addEventListener('playing', () => { showLoad(false); updatePlayIcon(); syncAmbient(); });
    vidEl.addEventListener('pause',   () => { updatePlayIcon(); syncAmbient(); });
    vidEl.addEventListener('ended', () => {
      if (vidEl._dead) return;
      loopCount++;
      if (loopCount < MAX_AUTO_LOOPS) {
        vidEl.currentTime = 0;
        vidEl.play().catch(() => {});
      } else {
        // Limit reached — show replay button, stop playing
        updatePlayIcon();
        syncAmbient();
        showControls();
      }
    });
    vidEl.addEventListener('error', e => {
      if (e.currentTarget._dead) return;
      showLoad(true, '✗ वीडियो लोड नहीं हो सका');
    });

    vidEl.load();
  }

  function switchQuality(src) {
    if (src.label === currentSrc?.label) return;
    wasPlaying = vidEl ? !vidEl.paused : false;
    savedTime  = vidEl ? vidEl.currentTime : 0;
    loadSource(src, true);
  }

  function updateQBadge() {
    const t = document.getElementById('tourQText');
    if (!t || !currentSrc) return;
    t.textContent = manualQuality
      ? `⬛ ${currentSrc.label}`
      : `AUTO · ${currentSrc.label}`;
  }

  // ══════════════════════════════════════════════════════════
  // VIEWPORT / AUTOPLAY OBSERVER
  // ══════════════════════════════════════════════════════════
  function initViewportObserver() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        inViewport = entry.isIntersecting;
        if (!vidEl) return;
        if (inViewport && !document.hidden) {
          if (loopCount < MAX_AUTO_LOOPS) {
            vidEl.play().catch(() => {});
            hasStarted = true;
          }
        } else {
          vidEl.pause();
          syncAmbient();
        }
      });
    }, { threshold: 0.3 });
    obs.observe(wrap);
  }

  // ══════════════════════════════════════════════════════════
  // NETWORK CHANGE WATCHER
  // ══════════════════════════════════════════════════════════
  function initNetworkChangeWatcher() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;
    conn.addEventListener('change', () => {
      if (manualQuality) return;  // user has locked a resolution — don't auto-switch
      detectQuality().then(src => {
        if (src.label !== currentSrc?.label) switchQuality(src);
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // DRAG TO LOOK
  // ══════════════════════════════════════════════════════════
  function onDown(e) { isDragging = true; prevX = e.clientX; prevY = e.clientY; }
  function onUp()    { isDragging = false; }

  function onMove(e) {
    if (!isDragging) return;
    applyDrag(e.clientX - prevX, e.clientY - prevY);
    prevX = e.clientX; prevY = e.clientY;
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      isDragging = false;
      return;
    }
    pinchDist = null;
    isDragging = true;
    prevX = e.touches[0].clientX;
    prevY = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (e.touches.length === 2 && pinchDist !== null) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      fov = Math.max(30, Math.min(110, fov - (d - pinchDist) * 0.1));
      camera.fov = fov; camera.updateProjectionMatrix();
      pinchDist = d;
      return;
    }
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    applyDrag(t.clientX - prevX, t.clientY - prevY);
    prevX = t.clientX; prevY = t.clientY;
  }

  function onTouchEnd(e) {
    if (e.touches.length === 0) { isDragging = false; pinchDist = null; }
  }

  function applyDrag(dx, dy) {
    if (gyroActive) {
      gyroDeltaYaw  -= dx * 0.3;
      gyroDeltaPitch -= dy * 0.3;
      gyroDeltaPitch  = Math.max(-85, Math.min(85, gyroDeltaPitch));
    } else {
      yaw   -= dx * 0.3;
      pitch -= dy * 0.3;
      pitch  = Math.max(-85, Math.min(85, pitch));
    }
    updateCamera();
  }

  function updateCamera() {
    if (gyroActive) return; // gyro drives camera in render loop
    const phi   = THREE.MathUtils.degToRad(90 - pitch);
    const theta = THREE.MathUtils.degToRad(yaw);
    camera.position.set(0, 0, 0);
    camera.lookAt(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );
  }

  // ══════════════════════════════════════════════════════════
  // GYROSCOPE
  // ══════════════════════════════════════════════════════════
  function requestGyro() {
    if (gyroActive) { disableGyro(); return; }

    if (!window.isSecureContext) {
      showToast('Gyroscope के लिए HTTPS आवश्यक है।');
      return;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(r => {
          if (r === 'granted') enableGyro();
          else showToast('Gyroscope की अनुमति नहीं मिली।\nSettings → Safari → Motion & Orientation Access → On');
        })
        .catch(err => showToast('Gyro error: ' + (err?.message || err)));
    } else {
      enableGyro();
    }
  }

  function enableGyro() {
    if (!_gQ1) {
      _gQ1    = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
      _gZee   = new THREE.Vector3(0, 0, 1);
      _gEuler = new THREE.Euler();
      _gQTmp  = new THREE.Quaternion();
      _gCorrE = new THREE.Euler();
      _gCorrQ = new THREE.Quaternion();
    }
    gyroActive     = true;
    gyroTargetQuat = null;
    gyroSmoothQuat = null;
    gyroDeltaYaw   = 0;
    gyroDeltaPitch = 0;
    window.addEventListener('deviceorientation', onDeviceOrientation, true);

    const corner = document.getElementById('tourGyroCorner');
    if (corner) { corner.style.display = 'flex'; corner.style.color = 'var(--saffron)'; }
    const ov = document.getElementById('tourGyroOverlay');
    if (ov) ov.classList.add('hidden');
  }

  function disableGyro() {
    gyroActive = false;
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
    const corner = document.getElementById('tourGyroCorner');
    if (corner) corner.style.color = '';
  }

  function onDeviceOrientation(e) {
    if (!gyroActive) return;
    let alphaVal = e.alpha;
    if (alphaVal == null && e.webkitCompassHeading != null) {
      alphaVal = (360 - e.webkitCompassHeading) % 360;
    }
    if (alphaVal == null || e.beta == null) return;

    const alpha  = THREE.MathUtils.degToRad(alphaVal);
    const beta   = THREE.MathUtils.degToRad(e.beta);
    const gamma  = THREE.MathUtils.degToRad(e.gamma || 0);
    const orient = (screen.orientation && screen.orientation.angle != null)
      ? THREE.MathUtils.degToRad(screen.orientation.angle)
      : THREE.MathUtils.degToRad(typeof window.orientation !== 'undefined' ? window.orientation : 0);

    _gEuler.set(beta, alpha, -gamma, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(_gEuler);
    q.multiply(_gQ1);
    q.multiply(_gQTmp.setFromAxisAngle(_gZee, -orient));
    gyroTargetQuat = q;
  }

  // ══════════════════════════════════════════════════════════
  // FULLSCREEN
  // ══════════════════════════════════════════════════════════
  function toggleFS() {
    const section = document.getElementById('tour');
    const isNativeFS = document.fullscreenElement || document.webkitFullscreenElement;

    if (isNativeFS) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (cssFull) { exitCSSFull(section); return; }

    const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    if (req) {
      req.call(wrap).then(() => { setTimeout(resizeRenderer, 50); })
         .catch(() => enterCSSFull(section));
    } else {
      enterCSSFull(section);
    }
  }

  function enterCSSFull(section) {
    cssFull = true;
    section.classList.add('tour-fs-fill');
    screen.orientation?.lock('landscape').catch(() => {});
    setTimeout(resizeRenderer, 50);
  }

  function exitCSSFull(section) {
    cssFull = false;
    section.classList.remove('tour-fs-fill');
    screen.orientation?.unlock?.();
    setTimeout(resizeRenderer, 50);
  }

  // ══════════════════════════════════════════════════════════
  // AMBIENT AUDIO
  // ══════════════════════════════════════════════════════════
  function initAmbient() {
    if (ambEl) return;
    ambEl = document.createElement('audio');
    ambEl.src      = AMBIENT_SRC;
    ambEl.loop     = true;
    ambEl.volume   = 0.55;
    ambEl.muted    = true;   // stays muted until user opts in
    ambEl.preload  = 'none'; // don't waste bandwidth until needed
    document.body.appendChild(ambEl);
  }

  function ambientShouldPlay() {
    return vidEl && !vidEl.paused && loopCount < MAX_AUTO_LOOPS;
  }

  function syncAmbient() {
    if (!ambEl) return;
    if (ambientShouldPlay() && !ambMuted) {
      ambEl.play().catch(() => {});
    } else {
      ambEl.pause();
    }
  }

  function toggleAmbient() {
    if (!ambEl) initAmbient();
    ambMuted = !ambMuted;
    ambEl.muted = false; // always unmute the element; we control via ambMuted flag
    if (ambMuted) {
      ambEl.pause();
    } else {
      ambEl.preload = 'auto'; // trigger load on first opt-in
      if (ambientShouldPlay()) ambEl.play().catch(() => {});
    }
    updateAudioIcon();
    showControls();
  }

  function updateAudioIcon() {
    const ico = document.getElementById('tourAudioIco');
    if (!ico) return;
    if (ambMuted) {
      // Muted: speaker with X
      ico.innerHTML = `
        <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
        <line x1="23" y1="9" x2="17" y2="15"/>
        <line x1="17" y1="9" x2="23" y2="15"/>`;
    } else {
      // Unmuted: speaker with waves
      ico.innerHTML = `
        <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // PLAY / PAUSE
  // ══════════════════════════════════════════════════════════
  function togglePlay() {
    if (!vidEl) return;
    if (vidEl.paused) {
      // If user replays after the auto-loop limit, restart from beginning
      if (loopCount >= MAX_AUTO_LOOPS) {
        loopCount = 0;
        vidEl.currentTime = 0;
      }
      vidEl.play().catch(() => {});
    } else {
      vidEl.pause();
    }
    updatePlayIcon();
    showControls();
  }

  function updatePlayIcon() {
    const ico = document.getElementById('tourPlayIco');
    const btn = document.getElementById('tourPlayBtn');
    if (!ico || !vidEl) return;
    if (loopCount >= MAX_AUTO_LOOPS && vidEl.paused) {
      // Replay icon (circular arrow) + keep button visible
      ico.innerHTML = '<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>';
      if (btn) btn.classList.remove('hidden');
    } else if (vidEl.paused) {
      ico.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    } else {
      ico.innerHTML = '<rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/>';
    }
  }

  // ══════════════════════════════════════════════════════════
  // LOADING OVERLAY
  // ══════════════════════════════════════════════════════════
  function showLoad(on, msg) {
    const el = document.getElementById('tourLoadOverlay');
    if (!el) return;
    el.classList.toggle('hidden', !on);
    if (msg) { const m = document.getElementById('tourLoadMsg'); if (m) m.textContent = msg; }
  }

  // ══════════════════════════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════════════════════════
  let _toastTimer = null;
  function showToast(msg) {
    let el = document.getElementById('embedToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'embedToast';
      el.style.cssText = `position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(16px);
        background:#1e1e1e;color:#efefed;border:1px solid #555;border-radius:10px;
        padding:11px 20px;font-size:0.75rem;z-index:99999;opacity:0;pointer-events:none;
        transition:opacity 0.28s,transform 0.28s;max-width:min(92vw,360px);
        text-align:center;line-height:1.65;font-family:sans-serif;`;
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(16px)';
    }, 5000);
  }

})();
