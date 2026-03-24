(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreValue = document.getElementById('scoreValue');
  const distanceValue = document.getElementById('distanceValue');
  const livesValue = document.getElementById('livesValue');
  const bestValue = document.getElementById('bestValue');
  const finalScore = document.getElementById('finalScore');
  const finalDistance = document.getElementById('finalDistance');
  const finalCoins = document.getElementById('finalCoins');
  const bestScoreValue = document.getElementById('bestScoreValue');
  const newBestBadge = document.getElementById('newBestBadge');

  const startScreen = document.getElementById('startScreen');
  const countdownScreen = document.getElementById('countdownScreen');
  const pauseScreen = document.getElementById('pauseScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const countdownValue = document.getElementById('countdownValue');

  const startBtn = document.getElementById('startBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const muteBtn = document.getElementById('muteBtn');
  const touchControls = document.getElementById('touchControls');

  const laneOffsets = [-0.35, 0, 0.35];
  const COIN_TYPES = {
    heart: { value: 10, chance: 0.68, color: '#ff8ba7', boost: 0, scoreMult: 1, img: '../assets/coins/coin_heart.png' },
    wink: { value: 30, chance: 0.25, color: '#57beb1', boost: 1.2, scoreMult: 2, img: '../assets/coins/coin_wink.png' },
    token: { value: 100, chance: 0.07, color: '#ffd269', boost: 1.5, scoreMult: 3, img: '../assets/coins/coin_token.png' }
  };

  const images = {
    player: makeImage('../assets/sparkie_player.png'),
    heart: makeImage(COIN_TYPES.heart.img),
    wink: makeImage(COIN_TYPES.wink.img),
    token: makeImage(COIN_TYPES.token.img)
  };

  const logoTargets = [
    ['valuLogo', 'valuLogoFallback'],
    ['sparkieLogo', 'sparkieLogoFallback']
  ];
  logoTargets.forEach(([imgId, fallbackId]) => {
    const img = document.getElementById(imgId);
    const fallback = document.getElementById(fallbackId);
    img.addEventListener('error', () => {
      img.classList.add('hidden');
      fallback.classList.remove('hidden');
    });
  });

  const state = {
    screen: 'start',
    score: 0,
    distance: 0,
    lives: 3,
    bestScore: Number(localStorage.getItem('sparkie_rush_best') || 0),
    coinsCollected: 0,
    speed: 24,
    speedBoostUntil: 0,
    invulnerableUntil: 0,
    countdownUntil: 0,
    paused: false,
    muted: false,
    shake: 0
  };

  const player = {
    lane: 1,
    targetLane: 1,
    yVel: 0,
    yPos: 0,
    slidingUntil: 0,
    runPhase: 0
  };

  let world = [];
  let particles = [];
  let lastTime = 0;
  let spawnClock = 0;
  let sideDecorScroll = 0;
  let audioContext;
  let swipeStart = null;

  bestValue.textContent = String(state.bestScore);
  setScreen('start');
  updateHud();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  requestAnimationFrame(loop);

  startBtn.addEventListener('click', startRun);
  playAgainBtn.addEventListener('click', startRun);
  pauseBtn.addEventListener('click', togglePause);
  resumeBtn.addEventListener('click', togglePause);
  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? 'Unmute' : 'Mute';
  });
  initTouch();

  touchControls.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-touch-action]');
    if (!target) return;
    triggerAction(target.dataset.touchAction);
  });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'p'].includes(key)) event.preventDefault();

    if (state.screen === 'playing' || state.screen === 'countdown') {
      if (key === 'arrowleft' || key === 'a') triggerAction('left');
      if (key === 'arrowright' || key === 'd') triggerAction('right');
      if (key === 'arrowup' || key === 'w') triggerAction('jump');
      if (key === 'arrowdown' || key === 's') triggerAction('slide');
      if (key === 'p' && state.screen === 'playing') togglePause();
    } else if (state.screen === 'paused' && key === 'p') {
      togglePause();
    }
  });

  function startRun() {
    state.score = 0;
    state.distance = 0;
    state.lives = 3;
    state.coinsCollected = 0;
    state.speed = 24;
    state.speedBoostUntil = 0;
    state.invulnerableUntil = 0;
    state.shake = 0;

    player.lane = 1;
    player.targetLane = 1;
    player.yVel = 0;
    player.yPos = 0;
    player.slidingUntil = 0;
    player.runPhase = 0;

    world = [];
    particles = [];
    spawnClock = 0;
    sideDecorScroll = 0;
    seedInitialWorld();

    state.countdownUntil = performance.now() + 3000;
    setScreen('countdown');
    updateHud();
  }

  function seedInitialWorld() {
    for (let z = 22; z < 115; z += 11) {
      const lane = Math.floor(Math.random() * 3);
      maybeSpawnEntity(z, lane, true);
    }
  }

  function setScreen(screen) {
    state.screen = screen;
    [startScreen, countdownScreen, pauseScreen, gameOverScreen].forEach((panel) => panel.classList.remove('is-active'));
    if (screen === 'start') startScreen.classList.add('is-active');
    if (screen === 'countdown') countdownScreen.classList.add('is-active');
    if (screen === 'paused') pauseScreen.classList.add('is-active');
    if (screen === 'over') gameOverScreen.classList.add('is-active');
  }

  function shiftLane(delta) {
    player.targetLane = Math.max(0, Math.min(2, player.targetLane + delta));
  }

  function triggerAction(action) {
    if (action === 'left') shiftLane(-1);
    if (action === 'right') shiftLane(1);
    if (action === 'jump') jump();
    if (action === 'slide') slide();
  }

  function jump() {
    if (player.yPos === 0 && performance.now() > player.slidingUntil) {
      player.yVel = 1.06;
      playTone(620, 0.07, 'square');
    }
  }

  function slide() {
    if (player.yPos < 0.06) {
      player.slidingUntil = performance.now() + 540;
      playTone(300, 0.05, 'triangle');
    }
  }

  function togglePause() {
    if (state.screen === 'playing') {
      setScreen('paused');
    } else if (state.screen === 'paused') {
      setScreen('playing');
    }
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(0.033, (ts - lastTime) / 1000);
    lastTime = ts;

    update(dt, ts);
    render(ts);

    requestAnimationFrame(loop);
  }

  function update(dt, now) {
    if (state.screen === 'countdown') {
      const left = Math.max(0, state.countdownUntil - now);
      countdownValue.textContent = left < 700 ? 'Go!' : String(Math.ceil(left / 1000));
      if (left <= 0) setScreen('playing');
    }

    if (state.screen !== 'playing') return;

    const boostFactor = now < state.speedBoostUntil ? 1.22 : 1;
    state.speed = Math.min(52, state.speed + dt * 0.4);
    const runSpeed = state.speed * boostFactor;

    state.distance += runSpeed * dt;
    const scoreMultiplier = now < state.speedBoostUntil ? 2 : 1;
    state.score += (runSpeed * dt * 2.4) * scoreMultiplier;

    player.lane += (player.targetLane - player.lane) * Math.min(1, dt * 16);
    player.yVel -= dt * 2.9;
    player.yPos = Math.max(0, player.yPos + player.yVel);
    if (player.yPos === 0) player.yVel = 0;
    player.runPhase += dt * 17;

    const movingDown = player.yVel < -0.4;
    const isJumpingHigh = player.yPos > 0.23 || movingDown && player.yPos > 0.16;
    const isSliding = now < player.slidingUntil;

    for (const entity of world) entity.z -= runSpeed * dt;

    world = world.filter((entity) => {
      if (entity.type === 'coin' && entity.z < 1.8 && entity.z > -0.2 && laneHit(entity.lane)) {
        collectCoin(entity, now);
        return false;
      }

      if (entity.type !== 'coin' && entity.z < 1.5 && entity.z > -0.3 && laneHit(entity.lane)) {
        const avoidByJump = entity.kind === 'low' && isJumpingHigh;
        const avoidBySlide = entity.kind === 'high' && isSliding;
        if (!avoidByJump && !avoidBySlide) {
          handleHit(now);
          return false;
        }
        return false;
      }

      return entity.z > -2;
    });

    spawnClock += dt * runSpeed;
    if (spawnClock > 8.5) {
      spawnClock = 0;
      spawnPack(false);
    }

    updateParticles(dt);
    sideDecorScroll += runSpeed * dt;
    state.shake *= 0.9;

    if (state.lives <= 0) {
      endRun();
      return;
    }

    updateHud();
  }

  function laneHit(lane) {
    return Math.abs(player.lane - lane) < 0.29;
  }

  function collectCoin(coin, now) {
    const def = COIN_TYPES[coin.coinType];
    state.coinsCollected += 1;
    state.score += def.value * (now < state.speedBoostUntil ? 2 : 1);
    if (def.scoreMult > 1) state.speedBoostUntil = now + 4200;

    emitParticles(coin.lane, coin.z, def.color);
    playTone(780, 0.05, 'sine');
    playTone(980, 0.04, 'triangle');
  }

  function handleHit(now) {
    if (now < state.invulnerableUntil) return;

    state.lives -= 1;
    state.invulnerableUntil = now + 1250;
    state.shake = 16;
    emitParticles(player.lane, 0.6, '#ef5f17');
    playTone(150, 0.14, 'sawtooth');
  }

  function emitParticles(lane, z, color) {
    for (let i = 0; i < 14; i++) {
      particles.push({
        lane,
        z,
        xVel: (Math.random() - 0.5) * 0.44,
        yVel: (Math.random() - 0.5) * 0.62,
        life: 0.6 + Math.random() * 0.28,
        age: 0,
        color
      });
    }
  }

  function updateParticles(dt) {
    particles.forEach((p) => {
      p.age += dt;
      p.z -= state.speed * dt * 0.6;
      p.lane += p.xVel * dt;
      p.yVel += dt * 0.4;
    });
    particles = particles.filter((p) => p.age < p.life && p.z > -1);
  }

  function spawnPack(forceEasy) {
    const baseZ = 110;
    const occupied = new Set();
    const obstacleCount = forceEasy ? 1 : (Math.random() < 0.55 ? 1 : 2);

    for (let i = 0; i < obstacleCount; i++) {
      const lane = Math.floor(Math.random() * 3);
      if (occupied.has(lane)) continue;
      occupied.add(lane);
      maybeSpawnEntity(baseZ + i * 8, lane, forceEasy);
    }

    for (let lane = 0; lane < 3; lane++) {
      if (!occupied.has(lane) && Math.random() < 0.72) {
        const z = baseZ + Math.random() * 6;
        world.push({ type: 'coin', lane, z, coinType: weightedCoin(), pulse: Math.random() * Math.PI * 2 });
      }
    }
  }

  function maybeSpawnEntity(z, lane, forceEasy) {
    if (Math.random() < 0.34 && !forceEasy) {
      world.push({ type: 'coin', lane, z, coinType: weightedCoin(), pulse: Math.random() * Math.PI * 2 });
      return;
    }

    const kinds = ['full', 'low', 'high', 'car'];
    const kind = forceEasy ? kinds[Math.floor(Math.random() * 2)] : kinds[Math.floor(Math.random() * kinds.length)];
    world.push({ type: 'obstacle', kind, lane, z, wiggle: Math.random() * Math.PI * 2 });
  }

  function weightedCoin() {
    const roll = Math.random();
    let edge = 0;
    for (const [key, def] of Object.entries(COIN_TYPES)) {
      edge += def.chance;
      if (roll <= edge) return key;
    }
    return 'heart';
  }

  function endRun() {
    const roundedScore = Math.floor(state.score);
    const roundedDistance = Math.floor(state.distance);
    const isNewBest = roundedScore > state.bestScore;

    if (isNewBest) {
      state.bestScore = roundedScore;
      localStorage.setItem('sparkie_rush_best', String(state.bestScore));
    }

    bestValue.textContent = String(state.bestScore);
    finalScore.textContent = String(roundedScore);
    finalDistance.textContent = `${roundedDistance} m`;
    finalCoins.textContent = String(state.coinsCollected);
    bestScoreValue.textContent = String(state.bestScore);
    newBestBadge.classList.toggle('hidden', !isNewBest);

    setScreen('over');
    updateHud();
    playTone(90, 0.35, 'sawtooth');
  }

  function updateHud() {
    scoreValue.textContent = String(Math.floor(state.score));
    distanceValue.textContent = `${Math.floor(state.distance)} m`;
    livesValue.textContent = String(state.lives);
    bestValue.textContent = String(state.bestScore);
  }

  function render(now) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const shakeX = state.shake * (Math.random() - 0.5);
    const shakeY = state.shake * (Math.random() - 0.5);
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawSky(w, h, now);
    drawStreet(w, h);
    drawDecor(w, h);

    const sorted = [...world].sort((a, b) => b.z - a.z);
    sorted.forEach((entity) => drawEntity(entity, w, h, now));
    drawParticles(w, h);
    drawPlayer(w, h, now);

    if (performance.now() < state.invulnerableUntil) {
      const blink = Math.floor(now / 90) % 2 === 0;
      if (blink) {
        ctx.fillStyle = 'rgba(239,95,23,0.11)';
        ctx.fillRect(0, 0, w, h);
      }
    }

    ctx.restore();
  }

  function drawSky(w, h, now) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#182a2d');
    grad.addColorStop(0.5, '#1b1c1e');
    grad.addColorStop(1, '#111111');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 22; i++) {
      const x = (i * 183 + sideDecorScroll * 16) % (w + 200) - 100;
      const hh = 130 + (i % 4) * 38;
      ctx.fillStyle = 'rgba(87,190,177,0.08)';
      ctx.fillRect(x, h * 0.2 + (i % 5) * 10, 28 + (i % 3) * 18, hh);
    }

    ctx.strokeStyle = 'rgba(239,95,23,0.2)';
    for (let i = 0; i < 7; i++) {
      const y = (i * 110 + now * 0.05) % h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 26);
      ctx.stroke();
    }
  }

  function drawStreet(w, h) {
    const topY = h * 0.23;
    const bottomY = h;
    const leftTop = w * 0.38;
    const rightTop = w * 0.62;

    ctx.fillStyle = '#1f1f1f';
    ctx.beginPath();
    ctx.moveTo(leftTop, topY);
    ctx.lineTo(rightTop, topY);
    ctx.lineTo(w * 0.92, bottomY);
    ctx.lineTo(w * 0.08, bottomY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#252525';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    const laneProgress = (state.distance * 0.38) % 6;
    for (let lane = 1; lane <= 2; lane++) {
      for (let i = 0; i < 20; i++) {
        const z = i * 6 + laneProgress;
        const p = project(laneOffsets[lane], z, w, h);
        const p2 = project(laneOffsets[lane], z + 2.3, w, h);
        ctx.strokeStyle = 'rgba(87,190,177,0.5)';
        ctx.lineWidth = p.scale * 8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 24; i++) {
        const z = (i * 5 + sideDecorScroll * 0.5) % 120;
        const p = project(side * 0.58, z, w, h);
        ctx.fillStyle = 'rgba(87,190,177,0.7)';
        ctx.fillRect(p.x - p.scale * 7, p.y - p.scale * 26, p.scale * 14, p.scale * 26);
      }
    }
  }

  function drawDecor(w, h) {
    for (let i = 0; i < 12; i++) {
      const z = (i * 12 + sideDecorScroll * 0.8) % 115;
      const left = project(-0.82, z, w, h);
      const right = project(0.82, z, w, h);
      ctx.fillStyle = 'rgba(239,95,23,0.34)';
      ctx.fillRect(left.x - left.scale * 8, left.y - left.scale * 12, left.scale * 16, left.scale * 12);
      ctx.fillRect(right.x - right.scale * 8, right.y - right.scale * 12, right.scale * 16, right.scale * 12);
    }
  }

  function drawEntity(entity, w, h, now) {
    const pos = project(laneOffsets[entity.lane], entity.z, w, h);
    if (pos.scale < 0.01) return;

    if (entity.type === 'coin') {
      const def = COIN_TYPES[entity.coinType];
      const bob = Math.sin(now * 0.006 + entity.pulse) * pos.scale * 24;
      const size = pos.scale * 80 * (1 + Math.sin(now * 0.01 + entity.pulse) * 0.05);
      const img = images[entity.coinType];

      if (img.ready) {
        ctx.save();
        ctx.translate(pos.x, pos.y - bob);
        ctx.rotate(now * 0.006 + entity.pulse);
        ctx.drawImage(img.node, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - bob, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const width = pos.scale * 136;
    const height = pos.scale * 140;

    if (entity.kind === 'car') {
      ctx.fillStyle = '#ef5f17';
      roundRect(pos.x - width * 0.48, pos.y - height * 0.43, width * 0.96, height * 0.46, pos.scale * 10, true);
      ctx.fillStyle = '#57beb1';
      roundRect(pos.x - width * 0.28, pos.y - height * 0.38, width * 0.56, height * 0.2, pos.scale * 9, true);
      ctx.fillStyle = '#131313';
      ctx.fillRect(pos.x - width * 0.42, pos.y - height * 0.02, width * 0.84, height * 0.14);
      return;
    }

    if (entity.kind === 'low') {
      ctx.fillStyle = '#57beb1';
      roundRect(pos.x - width * 0.42, pos.y - height * 0.2, width * 0.84, height * 0.2, pos.scale * 8, true);
      return;
    }

    if (entity.kind === 'high') {
      ctx.fillStyle = '#ef5f17';
      roundRect(pos.x - width * 0.4, pos.y - height * 0.75, width * 0.8, height * 0.74, pos.scale * 10, true);
      ctx.fillStyle = '#1e1e1e';
      roundRect(pos.x - width * 0.28, pos.y - height * 0.65, width * 0.56, height * 0.2, pos.scale * 8, true);
      return;
    }

    ctx.fillStyle = '#292929';
    roundRect(pos.x - width * 0.45, pos.y - height * 0.55, width * 0.9, height * 0.52, pos.scale * 10, true);
    ctx.strokeStyle = '#57beb1';
    ctx.lineWidth = Math.max(1, pos.scale * 8);
    ctx.strokeRect(pos.x - width * 0.35, pos.y - height * 0.46, width * 0.7, height * 0.36);
  }

  function drawParticles(w, h) {
    particles.forEach((p) => {
      const pos = project(laneOffsets[1] * 0 + p.lane * 0.34, p.z, w, h);
      const alpha = 1 - (p.age / p.life);
      ctx.fillStyle = rgbaFromHex(p.color, alpha);
      const size = Math.max(2, pos.scale * 20 * alpha);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - p.yVel * 12, size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlayer(w, h, now) {
    const pos = project(laneOffsets[1] + (player.lane - 1) * 0.35, 1.2, w, h);
    const bounce = Math.sin(player.runPhase) * 4;
    const slideScale = performance.now() < player.slidingUntil ? 0.58 : 1;
    const jumpOffset = player.yPos * 200;
    const width = 95;
    const height = 125 * slideScale;

    if (images.player.ready) {
      const tilt = (player.targetLane - player.lane) * 0.22;
      ctx.save();
      ctx.translate(pos.x, pos.y - jumpOffset + bounce);
      ctx.rotate(tilt);
      ctx.drawImage(images.player.node, -width / 2, -height, width, height);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ef5f17';
      roundRect(pos.x - width * 0.4, pos.y - jumpOffset - height, width * 0.8, height, 14, true);
    }
  }

  function project(laneX, z, w, h) {
    const clampedZ = Math.max(0.4, z);
    const t = 1 - Math.min(1, clampedZ / 120);
    const trackWidth = 0.18 + t * 0.68;
    return {
      x: w * 0.5 + laneX * trackWidth * w,
      y: h * (0.27 + t * 0.72),
      scale: 0.1 + t * 1.4
    };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);
    if (targetWidth > 0 && targetHeight > 0 && (canvas.width !== targetWidth || canvas.height !== targetHeight)) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }

  function initTouch() {
    const touchStart = (x, y) => {
      swipeStart = { x, y, t: performance.now(), used: false };
    };
    const touchMove = (x, y) => {
      if (!swipeStart || swipeStart.used) return;
      const dx = x - swipeStart.x;
      const dy = y - swipeStart.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const threshold = 28;
      if (absX < threshold && absY < threshold) return;

      if (absX > absY) triggerAction(dx > 0 ? 'right' : 'left');
      else triggerAction(dy > 0 ? 'slide' : 'jump');
      swipeStart.used = true;
    };
    const touchEnd = () => {
      swipeStart = null;
    };

    canvas.addEventListener('touchstart', (e) => {
      if (!e.touches[0]) return;
      const t = e.touches[0];
      touchStart(t.clientX, t.clientY);
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (!e.touches[0]) return;
      const t = e.touches[0];
      touchMove(t.clientX, t.clientY);
    }, { passive: true });

    canvas.addEventListener('touchend', touchEnd, { passive: true });
    canvas.addEventListener('touchcancel', touchEnd, { passive: true });
  }

  function makeImage(src) {
    const node = new Image();
    const data = { node, ready: false };
    node.onload = () => { data.ready = true; };
    node.onerror = () => { data.ready = false; };
    node.src = src;
    return data;
  }

  function roundRect(x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    if (fill) ctx.fill(); else ctx.stroke();
  }

  function rgbaFromHex(hex, alpha) {
    const parsed = hex.replace('#', '');
    const bigint = parseInt(parsed, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  function playTone(freq, duration, type) {
    if (state.muted) return;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.001;
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    } catch (_err) {
      // audio is optional; ignore failures safely.
    }
  }
})();
