// =============================================================================
// TOLLY POPS - CORE ENGINE & GAMEPLAY
// =============================================================================

(function() {
  'use strict';

  // --- Safe Local Storage ---
  const safeStorage = {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    setItem(key, val) {
      try {
        localStorage.setItem(key, val);
      } catch (e) {}
    }
  };

  // --- Core Game Tuning (Fast Speed + Generous Gaps) ---
  const GAME_SPEED = 2.3;
  const PIPE_GAP = 152;
  const PIPE_INTERVAL = 230;

  // --- Face Avatar Image Preloader ---
  const faceImg = new Image();
  faceImg.src = 'face.png';
  let faceImgLoaded = false;
  faceImg.onload = () => {
    faceImgLoaded = true;
  };

  // --- Bhaai Pillar/Bar Image Preloader ---
  const pillarImg = new Image();
  pillarImg.src = 'pillar.jpg';
  let pillarImgLoaded = false;
  pillarImg.onload = () => {
    pillarImgLoaded = true;
  };

  // --- Allu Hub Background Reel Preloader (25 Standardized Panels) ---
  const BG_COUNT = 25;
  const BG_PANEL_WIDTH = 360;
  const TOTAL_BG_WIDTH = BG_COUNT * BG_PANEL_WIDTH;
  const bgImages = [];
  let bgImagesLoadedCount = 0;
  let bgScrollX = 0;

  // Dynamic shuffled deck for random order on every new turn/retry
  let activeBgDeck = [];

  function shuffleBgDeck() {
    activeBgDeck = [...bgImages];
    for (let i = activeBgDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [activeBgDeck[i], activeBgDeck[j]] = [activeBgDeck[j], activeBgDeck[i]];
    }
    bgScrollX = 0;
  }

  for (let i = 1; i <= BG_COUNT; i++) {
    const num = i < 10 ? '0' + i : i;
    const img = new Image();
    img.src = `bg/bhaai_bg_${num}.jpg`;
    img.onload = () => {
      bgImagesLoadedCount++;
    };
    bgImages.push(img);
  }

  shuffleBgDeck();

  // --- Theme State (Day Mode) ---
  const isNight = false;

  // --- Canvas Setup & High-DPI Support ---
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element #gameCanvas not found!');
    return;
  }
  const ctx = canvas.getContext('2d');

  const VIRTUAL_WIDTH = 360;
  const VIRTUAL_HEIGHT = 640;
  const GROUND_HEIGHT = 110;
  let dpr = 1;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(VIRTUAL_WIDTH * dpr);
    canvas.height = Math.floor(VIRTUAL_HEIGHT * dpr);
    if (ctx.setTransform) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      ctx.scale(dpr, dpr);
    }
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // --- UI Elements ---
  const liveScoreEl = document.getElementById('liveScore');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const playBtn = document.getElementById('playBtn');
  const restartBtn = document.getElementById('restartBtn');
  const menuBtn = document.getElementById('menuBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const soundBtn = document.getElementById('soundBtn');
  const soundIcon = document.getElementById('soundIcon');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');
  const medalIconEl = document.getElementById('medalIcon');
  const newBestBadge = document.getElementById('newBestBadge');

  // --- Game State Constants ---
  const STATES = {
    START: 'START',
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER',
    PAUSED: 'PAUSED'
  };

  let gameState = STATES.START;

  // --- Character: Bhaai Only ---
  const selectedSkin = 'bhaai';

  // --- Scores ---
  let score = 0;
  let bestScore = parseInt(safeStorage.getItem('flappy_best_score') || '0', 10);

  // --- Camera Shake & Flash Effects ---
  let screenShake = 0;
  let flashAlpha = 0;

  // --- Particle System ---
  let particles = [];
  let floatingTexts = [];

  function createFeathers(x, y, count = 4, color = '#fef08a') {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 0.5,
        size: Math.random() * 4 + 3,
        color: color,
        alpha: 1,
        life: 0.025,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.15
      });
    }
  }

  function createScorePopup(x, y, text = '+1') {
    floatingTexts.push({
      x: x,
      y: y,
      text: text,
      alpha: 1,
      vy: -1.2
    });
  }

  let groundOffsetX = 0;

  // --- Bird / Face Entity ---
  const bird = {
    x: 80,
    y: 280,
    radius: 15,
    velocity: 0,
    gravity: 0.25,
    jumpForce: -5.5,
    maxFallSpeed: 8.0,
    rotation: 0,
    wingFrame: 0,
    wingTimer: 0,

    reset() {
      this.x = 80;
      this.y = 280;
      this.velocity = 0;
      this.rotation = 0;
      this.wingFrame = 0;
      this.wingTimer = 0;
    },

    flap() {
      this.velocity = this.jumpForce;
      this.rotation = -0.42;
      if (window.soundController) window.soundController.playFlap();
      createFeathers(this.x - 10, this.y + 4, 3, '#f59e0b');
    },

    update() {
      if (gameState === STATES.START) {
        this.y = 280 + Math.sin(Date.now() / 280) * 8;
        this.rotation = 0;
        this.wingTimer += 0.14;
        this.wingFrame = Math.floor(this.wingTimer) % 3;
        return;
      }

      this.velocity += this.gravity;
      if (this.velocity > this.maxFallSpeed) {
        this.velocity = this.maxFallSpeed;
      }
      this.y += this.velocity;

      if (this.velocity < 0) {
        this.rotation = Math.max(-0.42, this.rotation - 0.08);
      } else {
        this.rotation = Math.min(Math.PI / 2, this.rotation + 0.045);
      }

      this.wingTimer += this.velocity < 0 ? 0.32 : 0.14;
      this.wingFrame = Math.floor(this.wingTimer) % 3;

      if (this.y - this.radius <= 0) {
        this.y = this.radius;
        this.velocity = 0;
      }
    },

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Bhaai Face Character (Transparent Cutout Face)
      const drawHeight = 44;
      const drawWidth = 32.2; // preserves 594:813 aspect ratio

      if (faceImgLoaded && faceImg.complete) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 26, 38, 0.75)';
        ctx.shadowBlur = 10;
        ctx.drawImage(faceImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
      }

      ctx.restore();
    }
  };

  // --- Pipes Engine ---
  const pipes = [];
  const PIPE_WIDTH = 58;

  function createPipePair(startX) {
    const minTop = 50;
    const maxTop = VIRTUAL_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 60;
    const topHeight = Math.floor(minTop + Math.random() * (maxTop - minTop));

    pipes.push({
      x: startX,
      top: topHeight,
      bottom: topHeight + PIPE_GAP,
      passed: false
    });
  }

  function resetPipes() {
    pipes.length = 0;
    createPipePair(VIRTUAL_WIDTH + 60);
    createPipePair(VIRTUAL_WIDTH + 60 + PIPE_INTERVAL);
    createPipePair(VIRTUAL_WIDTH + 60 + PIPE_INTERVAL * 2);
  }

  function updatePipes() {
    if (gameState !== STATES.PLAYING) return;

    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      p.x -= GAME_SPEED;

      if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
        p.passed = true;
        score++;
        if (liveScoreEl) liveScoreEl.textContent = score;
        if (window.soundController) window.soundController.playScore();
        createScorePopup(bird.x + 15, bird.y - 15, '+1');
      }

      if (p.x + PIPE_WIDTH < -10) {
        const lastPipe = pipes[pipes.length - 1];
        const nextX = lastPipe ? Math.max(VIRTUAL_WIDTH, lastPipe.x + PIPE_INTERVAL) : VIRTUAL_WIDTH;
        pipes.splice(i, 1);
        createPipePair(nextX);
        i--;
      }
    }
  }

  function drawPipes() {
    const isBhaai = (selectedSkin === 'bhaai' || selectedSkin === 'tolly');
    if (isBhaai && pillarImgLoaded && pillarImg.complete) {
      drawBhaaiPipes();
      return;
    }

    const collarHeight = 24;
    const collarOverhang = 4;

    for (const p of pipes) {
      drawSinglePipe(p.x, 0, PIPE_WIDTH, p.top - collarHeight);
      drawPipeCollar(p.x - collarOverhang, p.top - collarHeight, PIPE_WIDTH + collarOverhang * 2, collarHeight);

      drawPipeCollar(p.x - collarOverhang, p.bottom, PIPE_WIDTH + collarOverhang * 2, collarHeight);
      const bottomHeight = VIRTUAL_HEIGHT - GROUND_HEIGHT - (p.bottom + collarHeight);
      drawSinglePipe(p.x, p.bottom + collarHeight, PIPE_WIDTH, bottomHeight);
    }
  }

  function drawBhaaiPipes() {
    const groundY = VIRTUAL_HEIGHT - GROUND_HEIGHT;

    for (const p of pipes) {
      const topHeight = p.top;
      const bottomHeight = groundY - p.bottom;

      // Upper Bar: "place it as the same" (upright)
      if (topHeight > 0) {
        ctx.save();
        ctx.drawImage(pillarImg, p.x, 0, PIPE_WIDTH, topHeight);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, 0, PIPE_WIDTH, topHeight);
        ctx.restore();
      }

      // Lower Bar: "place it inverted" (vertically flipped)
      if (bottomHeight > 0) {
        ctx.save();
        ctx.translate(p.x, p.bottom + bottomHeight);
        ctx.scale(1, -1);
        ctx.drawImage(pillarImg, 0, 0, PIPE_WIDTH, bottomHeight);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, PIPE_WIDTH, bottomHeight);
        ctx.restore();
      }
    }
  }

  function drawSinglePipe(x, y, width, height) {
    if (height <= 0) return;

    ctx.save();
    const grad = ctx.createLinearGradient(x, 0, x + width, 0);
    grad.addColorStop(0, '#5eead4');
    grad.addColorStop(0.18, '#22c55e');
    grad.addColorStop(0.5, '#16a34a');
    grad.addColorStop(0.85, '#15803d');
    grad.addColorStop(1, '#14532d');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#052e16';
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x + 5, y, 4, height);
    ctx.restore();
  }

  function drawPipeCollar(x, y, width, height) {
    ctx.save();
    const grad = ctx.createLinearGradient(x, 0, x + width, 0);
    grad.addColorStop(0, '#86efac');
    grad.addColorStop(0.2, '#22c55e');
    grad.addColorStop(0.6, '#16a34a');
    grad.addColorStop(1, '#14532d');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#052e16';
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + 6, y + 2, 4, height - 4);
    ctx.restore();
  }

  // --- Collision Detection ---
  function checkCollision() {
    const groundY = VIRTUAL_HEIGHT - GROUND_HEIGHT;

    if (bird.y + bird.radius >= groundY) {
      bird.y = groundY - bird.radius;
      handleGameOver();
      return true;
    }

    const birdBox = {
      left: bird.x - bird.radius * 0.70,
      right: bird.x + bird.radius * 0.70,
      top: bird.y - bird.radius * 0.70,
      bottom: bird.y + bird.radius * 0.70
    };

    for (const p of pipes) {
      if (birdBox.right > p.x && birdBox.left < p.x + PIPE_WIDTH) {
        if (birdBox.top < p.top || birdBox.bottom > p.bottom) {
          handleGameOver();
          return true;
        }
      }
    }

    return false;
  }

  function handleGameOver() {
    if (gameState === STATES.GAMEOVER) return;

    gameState = STATES.GAMEOVER;
    screenShake = 16;
    flashAlpha = 0.8;

    if (window.soundController) {
      window.soundController.stopVoiceClips();
      window.soundController.playHit();
      setTimeout(() => window.soundController.playDie(), 120);
    }

    if (finalScoreEl) finalScoreEl.textContent = score;
    let isNewBest = false;
    if (score > bestScore) {
      bestScore = score;
      safeStorage.setItem('flappy_best_score', bestScore);
      isNewBest = true;
    }
    if (bestScoreEl) bestScoreEl.textContent = bestScore;

    if (newBestBadge) {
      if (isNewBest && score > 0) {
        newBestBadge.classList.remove('hidden');
      } else {
        newBestBadge.classList.add('hidden');
      }
    }

    if (medalIconEl) {
      medalIconEl.className = 'medal-badge';
      if (score >= 40) {
        medalIconEl.classList.add('platinum');
        medalIconEl.textContent = 'PLAT';
      } else if (score >= 25) {
        medalIconEl.classList.add('gold');
        medalIconEl.textContent = 'GOLD';
      } else if (score >= 15) {
        medalIconEl.classList.add('silver');
        medalIconEl.textContent = 'SILV';
      } else if (score >= 5) {
        medalIconEl.classList.add('bronze');
        medalIconEl.textContent = 'BRNZ';
      } else {
        medalIconEl.classList.add('empty');
        medalIconEl.textContent = 'NONE';
      }
    }

    if (liveScoreEl) liveScoreEl.classList.add('hidden');
    setTimeout(() => {
      if (gameOverScreen) {
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.classList.add('active');
      }
    }, 400);
  }

  // --- Background Rendering (Joined Meme Panels Scrolling Background) ---
  function drawBackground() {
    const groundY = VIRTUAL_HEIGHT - GROUND_HEIGHT;

    if (bgImagesLoadedCount === 0) {
      // Atmospheric fallback while images load
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, groundY);
      return;
    }

    // Determine current panel index and sub-pixel offset
    const baseIdx = Math.floor(bgScrollX / BG_PANEL_WIDTH);
    const offsetInPanel = bgScrollX % BG_PANEL_WIDTH;

    let drawX = -offsetInPanel;
    let panelIdx = baseIdx;

    while (drawX < VIRTUAL_WIDTH) {
      const idx = ((panelIdx % BG_COUNT) + BG_COUNT) % BG_COUNT;
      const img = (activeBgDeck.length > 0 ? activeBgDeck[idx] : bgImages[idx]);
      if (img && img.complete) {
        ctx.drawImage(img, drawX, 0, BG_PANEL_WIDTH, groundY);
      }
      drawX += BG_PANEL_WIDTH;
      panelIdx++;
    }

    // Atmospheric Stranger Things cinematic moody tint
    ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, groundY);
  }

  function drawGround() {
    const groundY = VIRTUAL_HEIGHT - GROUND_HEIGHT;

    if (gameState === STATES.PLAYING) {
      groundOffsetX = (groundOffsetX + GAME_SPEED) % 24;
    }

    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, groundY, VIRTUAL_WIDTH, GROUND_HEIGHT);

    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(0, groundY, VIRTUAL_WIDTH, 14);

    ctx.fillStyle = '#558022';
    ctx.fillRect(0, groundY + 12, VIRTUAL_WIDTH, 4);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, groundY + 16, VIRTUAL_WIDTH, 12);
    ctx.clip();

    ctx.fillStyle = '#996633';
    ctx.fillRect(0, groundY + 16, VIRTUAL_WIDTH, 12);

    ctx.fillStyle = '#73bf2e';
    const stripeWidth = 14;
    for (let x = -groundOffsetX - stripeWidth; x < VIRTUAL_WIDTH + stripeWidth * 2; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 16);
      ctx.lineTo(x + stripeWidth, groundY + 16);
      ctx.lineTo(x, groundY + 28);
      ctx.lineTo(x - stripeWidth, groundY + 28);
      ctx.fill();
    }
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#543847';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(VIRTUAL_WIDTH, groundY);
    ctx.stroke();
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.alpha -= p.life;
      p.rotation += p.vRot;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
      }
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;

      if (ft.alpha <= 0) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 22px "ITC Benguiat", "Cinzel", Georgia, serif';
      ctx.fillStyle = '#fef08a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  function startGame() {
    shuffleBgDeck(); // Shuffles background images randomly on every new turn or retry
    gameState = STATES.PLAYING;
    score = 0;

    if (window.soundController) {
      window.soundController.startVoiceClips();
    }

    if (liveScoreEl) {
      liveScoreEl.textContent = '0';
      liveScoreEl.classList.remove('hidden');
    }

    if (startScreen) {
      startScreen.classList.remove('active');
      startScreen.classList.add('hidden');
    }
    if (gameOverScreen) {
      gameOverScreen.classList.remove('active');
      gameOverScreen.classList.add('hidden');
    }
    if (pauseScreen) {
      pauseScreen.classList.remove('active');
      pauseScreen.classList.add('hidden');
    }

    bird.reset();
    bird.flap();
    resetPipes();
  }

  function togglePause() {
    if (gameState === STATES.PLAYING) {
      gameState = STATES.PAUSED;
      if (window.soundController) window.soundController.pauseVoiceClips();
      if (pauseScreen) {
        pauseScreen.classList.remove('hidden');
        pauseScreen.classList.add('active');
      }
    } else if (gameState === STATES.PAUSED) {
      gameState = STATES.PLAYING;
      if (window.soundController) window.soundController.resumeVoiceClips();
      if (pauseScreen) {
        pauseScreen.classList.remove('active');
        pauseScreen.classList.add('hidden');
      }
    }
  }

  function handleAction() {
    if (gameState === STATES.START) {
      startGame();
    } else if (gameState === STATES.PLAYING) {
      bird.flap();
    } else if (gameState === STATES.PAUSED) {
      togglePause();
    }
  }

  // --- Attach Controls ---
  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.soundController) window.soundController.stopVoiceClips();
      shuffleBgDeck();
      gameState = STATES.START;
      if (gameOverScreen) {
        gameOverScreen.classList.remove('active');
        gameOverScreen.classList.add('hidden');
      }
      if (startScreen) {
        startScreen.classList.remove('hidden');
        startScreen.classList.add('active');
      }
      if (liveScoreEl) liveScoreEl.classList.add('hidden');
      bird.reset();
      resetPipes();
    });
  }

  if (resumeBtn) {
    resumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePause();
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePause();
    });
  }

  function updateSoundUI() {
    if (!soundIcon) return;
    const isMuted = window.soundController ? window.soundController.muted : false;
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
  }

  if (soundBtn) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.soundController) {
        window.soundController.toggleMute();
        updateSoundUI();
      }
    });
  }
  updateSoundUI();

  // Mobile & Desktop Unified Tap with debouncing
  let lastTapTime = 0;
  function handleInputGesture(e) {
    if (e && e.cancelable) {
      e.preventDefault();
    }
    const now = performance.now();
    if (now - lastTapTime < 80) return;
    lastTapTime = now;
    handleAction();
  }

  canvas.addEventListener('pointerdown', handleInputGesture);
  canvas.addEventListener('touchstart', handleInputGesture, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      handleAction();
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      if (window.soundController) {
        window.soundController.toggleMute();
        updateSoundUI();
      }
    }
  });

  // --- Physics Update Function (called at fixed 60FPS) ---
  function updatePhysics() {
    // Update background scrolling
    if (gameState === STATES.PLAYING) {
      bgScrollX = (bgScrollX + 0.85) % TOTAL_BG_WIDTH;
    } else if (gameState === STATES.START || gameState === STATES.GAMEOVER) {
      bgScrollX = (bgScrollX + 0.25) % TOTAL_BG_WIDTH;
    }

    if (gameState !== STATES.PAUSED) {
      bird.update();
    }
    if (gameState === STATES.PLAYING) {
      updatePipes();
      checkCollision();
    }
    updateParticles();
  }

  // --- Render Function ---
  function render() {
    if (ctx.setTransform) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake;
      const shakeY = (Math.random() - 0.5) * screenShake;
      ctx.translate(shakeX, shakeY);
      screenShake = Math.max(0, screenShake - 0.8);
    }

    drawBackground();
    drawPipes();
    bird.draw();
    drawGround();
    drawParticles();

    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      flashAlpha = Math.max(0, flashAlpha - 0.05);
    }
  }

  // --- Fixed 60FPS Timestep Game Loop ---
  const FIXED_STEP = 1000 / 60;
  let lastTimestamp = performance.now();
  let accumulator = 0;

  function gameLoop(now) {
    requestAnimationFrame(gameLoop);
    if (!now) now = performance.now();

    let delta = now - lastTimestamp;
    lastTimestamp = now;
    if (delta > 200) delta = 200;

    accumulator += delta;
    while (accumulator >= FIXED_STEP) {
      updatePhysics();
      accumulator -= FIXED_STEP;
    }

    render();
  }

  resetPipes();
  requestAnimationFrame(gameLoop);

})();
