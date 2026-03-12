(() => {
  const CONFIG = {
    roundMs: 2300,
    speedIncreasePerRound: 0.12,
    targetPadding: 0.1,
    goodZoneRatio: 0.18,
    perfectZoneRatio: 0.08,
    minGoodRatio: 0.12,
    minPerfectRatio: 0.045,
    shrinkPerRound: 0.009,
    scoring: {
      perfect: 100,
      great: 70,
      good: 40,
      miss: 0
    }
  };

  const els = {
    startScreen: document.getElementById('startScreen'),
    gameScreen: document.getElementById('gameScreen'),
    resultOverlay: document.getElementById('resultOverlay'),
    track: document.getElementById('track'),
    sparkie: document.getElementById('sparkie'),
    sparkiePlayer: document.getElementById('sparkiePlayer'),
    goodZone: document.getElementById('goodZone'),
    perfectZone: document.getElementById('perfectZone'),
    startBtn: document.getElementById('startBtn'),
    nextRoundBtn: document.getElementById('nextRoundBtn'),
    restartBtn: document.getElementById('restartBtn'),
    scoreValue: document.getElementById('scoreValue'),
    bestScoreValue: document.getElementById('bestScoreValue'),
    roundValue: document.getElementById('roundValue'),
    streakValue: document.getElementById('streakValue'),
    resultLabel: document.getElementById('resultLabel'),
    roundPoints: document.getElementById('roundPoints'),
    accuracyText: document.getElementById('accuracyText'),
    resultIcon: document.getElementById('resultIcon')
  };

  const state = {
    score: 0,
    best: 0,
    round: 1,
    streak: 0,
    running: false,
    gameStarted: false,
    startTs: 0,
    rafId: 0,
    sparkieX: 0,
    stopX: 0,
    stopLocked: false,
    perfectCenter: 0,
    goodStart: 0,
    goodWidth: 0,
    perfectStart: 0,
    perfectWidth: 0
  };


  function readBestScore() {
    try {
      return Number(window.localStorage.getItem('sparkie-stop-best') || 0);
    } catch {
      return 0;
    }
  }

  function writeBestScore(value) {
    try {
      window.localStorage.setItem('sparkie-stop-best', String(value));
    } catch {
      // Ignore storage failures (private mode / blocked storage).
    }
  }

  const resultIconMap = {
    perfect: '../assets/coins/coin_token.png',
    great: '../assets/coins/coin_wink.png',
    good: '../assets/coins/coin_heart.png',
    miss: '../assets/coins/coin_heart.png'
  };

  function safeImage(img, fallbackClass, fallbackText) {
    if (!img) return;
    img.addEventListener('error', () => {
      const fallback = document.createElement('div');
      fallback.className = fallbackClass;
      fallback.textContent = fallbackText;
      if (img.parentElement) img.parentElement.replaceChild(fallback, img);
    }, { once: true });
  }

  function setupFallbacks() {
    safeImage(document.getElementById('topLogo'), 'logo-fallback', 'VALU');
    safeImage(document.getElementById('sparkieLogo'), 'logo-fallback', 'SPARKIE DASH');
    safeImage(els.sparkiePlayer, 'sparkie-fallback', 'S');
    safeImage(els.resultIcon, 'icon-fallback', '★');
  }

  function updateHud() {
    els.scoreValue.textContent = String(state.score);
    els.bestScoreValue.textContent = String(state.best);
    els.roundValue.textContent = String(state.round);
    els.streakValue.textContent = String(state.streak);
  }

  function showScreen(screenName) {
    els.startScreen.classList.toggle('active', screenName === 'start');
    els.gameScreen.classList.toggle('active', screenName === 'game');
  }

  function calcZones(trackWidth) {
    const progressPenalty = (state.round - 1) * CONFIG.shrinkPerRound;
    const goodRatio = Math.max(CONFIG.minGoodRatio, CONFIG.goodZoneRatio - progressPenalty);
    const perfectRatio = Math.max(CONFIG.minPerfectRatio, CONFIG.perfectZoneRatio - progressPenalty * 0.6);

    const available = trackWidth * (1 - CONFIG.targetPadding * 2);
    const minX = trackWidth * CONFIG.targetPadding;
    const center = minX + Math.random() * available;

    state.goodWidth = trackWidth * goodRatio;
    state.goodStart = Math.max(0, Math.min(trackWidth - state.goodWidth, center - state.goodWidth / 2));

    state.perfectWidth = trackWidth * perfectRatio;
    state.perfectStart = Math.max(0, Math.min(trackWidth - state.perfectWidth, center - state.perfectWidth / 2));
    state.perfectCenter = state.perfectStart + state.perfectWidth / 2;
  }

  function layoutZones() {
    els.goodZone.style.left = `${state.goodStart}px`;
    els.goodZone.style.width = `${state.goodWidth}px`;
    els.perfectZone.style.left = `${state.perfectStart}px`;
    els.perfectZone.style.width = `${state.perfectWidth}px`;
  }

  function startRound() {
    const trackRect = els.track.getBoundingClientRect();
    calcZones(trackRect.width);
    layoutZones();

    state.running = true;
    state.stopLocked = false;
    state.startTs = performance.now();
    state.sparkieX = -46;
    state.stopX = state.sparkieX;

    if (state.rafId) cancelAnimationFrame(state.rafId);
    loop();
  }

  function loop() {
    if (!state.running) return;
    const now = performance.now();
    const elapsed = now - state.startTs;
    const roundSpeed = 1 + (state.round - 1) * CONFIG.speedIncreasePerRound;
    const duration = CONFIG.roundMs / roundSpeed;
    const progress = Math.min(1, elapsed / duration);

    const trackRect = els.track.getBoundingClientRect();
    const travelWidth = trackRect.width + 92;
    state.sparkieX = -46 + travelWidth * progress;

    const bounce = Math.sin(elapsed / 95) * 5;
    const tilt = Math.sin(elapsed / 120) * 4;
    els.sparkie.style.transform = `translateX(${state.sparkieX}px) translateY(${bounce}px) rotate(${tilt}deg)`;
    els.sparkie.style.filter = `drop-shadow(0 0 14px rgba(239,95,23,.55)) blur(${Math.max(0, (1 - progress) * 0.5)}px)`;

    if (progress >= 1) {
      triggerStop(true);
      return;
    }

    state.rafId = requestAnimationFrame(loop);
  }

  function classify(distance) {
    if (distance <= state.perfectWidth * 0.2) return 'perfect';
    if (distance <= state.perfectWidth * 0.55) return 'great';
    if (state.stopX >= state.goodStart && state.stopX <= state.goodStart + state.goodWidth) return 'good';
    return 'miss';
  }

  function triggerStop(autoMiss = false) {
    if (!state.running || state.stopLocked) return;
    state.stopLocked = true;
    state.running = false;
    cancelAnimationFrame(state.rafId);

    state.stopX = state.sparkieX + 47;
    const distance = Math.abs(state.stopX - state.perfectCenter);
    const resultKey = autoMiss ? 'miss' : classify(distance);
    const points = CONFIG.scoring[resultKey];

    if (resultKey === 'perfect') state.streak += 1;
    else state.streak = 0;

    state.score += points;
    if (state.score > state.best) {
      state.best = state.score;
      writeBestScore(state.best);
    }

    updateHud();
    showResult(resultKey, points, distance);
  }

  function showResult(resultKey, points, distance) {
    const labels = {
      perfect: 'PERFECT',
      great: 'GREAT',
      good: 'GOOD',
      miss: 'MISS'
    };

    els.resultLabel.textContent = labels[resultKey];
    els.roundPoints.textContent = String(points);
    els.accuracyText.textContent = `${Math.round(distance)} px from center`;
    els.resultIcon.src = resultIconMap[resultKey];

    els.sparkie.style.transform += ' scale(0.95)';
    els.resultOverlay.classList.add('show');
    els.resultOverlay.setAttribute('aria-hidden', 'false');
  }

  function resetRun(fullReset) {
    els.resultOverlay.classList.remove('show');
    els.resultOverlay.setAttribute('aria-hidden', 'true');

    if (fullReset) {
      state.score = 0;
      state.round = 1;
      state.streak = 0;
    } else {
      state.round += 1;
    }

    updateHud();
    startRound();
  }

  function startGame() {
    state.gameStarted = true;
    state.score = 0;
    state.round = 1;
    state.streak = 0;
    updateHud();
    showScreen('game');
    startRound();
  }

  function inputHandler(evt) {
    if (!state.gameStarted) return;
    if (evt.type === 'keydown') {
      if (evt.code !== 'Space' && evt.code !== 'Enter') return;
      evt.preventDefault();
    }
    triggerStop(false);
  }

  function bindEvents() {
    els.startBtn.addEventListener('click', startGame);
    els.nextRoundBtn.addEventListener('click', () => resetRun(false));
    els.restartBtn.addEventListener('click', () => resetRun(true));

    document.addEventListener('keydown', inputHandler);
    document.addEventListener('pointerdown', (evt) => {
      if (!state.gameStarted || !els.gameScreen.classList.contains('active')) return;
      if (evt.target.closest('button')) return;
      inputHandler(evt);
    });

    window.addEventListener('resize', () => {
      if (!state.gameStarted) return;
      layoutZones();
    });
  }

  state.best = readBestScore();
  setupFallbacks();
  updateHud();
  bindEvents();
})();
