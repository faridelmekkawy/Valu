const config = {
  baseDurationMs: 3200,
  minDurationMs: 2100,
  durationStepMs: 120,
  goodZoneWidthPct: 0.18,
  perfectZoneWidthPct: 0.06,
  minPerfectZoneWidthPct: 0.03,
  perfectZoneShrinkPerRound: 0.002,
  scoreBands: {
    perfect: 100,
    great: 70,
    good: 40,
    miss: 0
  }
};

const ui = {
  startScreen: document.getElementById('startScreen'),
  gameScreen: document.getElementById('gameScreen'),
  resultOverlay: document.getElementById('resultOverlay'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  nextBtn: document.getElementById('nextBtn'),
  restartBtn: document.getElementById('restartBtn'),
  track: document.getElementById('track'),
  sparkie: document.getElementById('sparkie'),
  sparkieImg: document.getElementById('sparkieImg'),
  goodZone: document.getElementById('goodZone'),
  perfectZone: document.getElementById('perfectZone'),
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  round: document.getElementById('round'),
  streak: document.getElementById('streak'),
  resultText: document.getElementById('resultText'),
  resultPoints: document.getElementById('resultPoints'),
  rewardIcon: document.getElementById('rewardIcon'),
  rewardFallback: document.getElementById('rewardFallback'),
  topLogo: document.getElementById('topLogo'),
  sparkieLogo: document.getElementById('sparkieLogo')
};

const rewardMap = {
  perfect: '../assets/coins/coin_token.png',
  great: '../assets/coins/coin_wink.png',
  good: '../assets/coins/coin_heart.png',
  miss: ''
};

const state = {
  score: 0,
  best: Number(localStorage.getItem('sparkieDashBest') || 0),
  round: 1,
  streak: 0,
  running: false,
  ended: false,
  animationId: null,
  runStartTs: 0,
  runDurationMs: 0,
  sparkieX: 0,
  targetCenterPct: 0.5,
  perfectWidthPct: config.perfectZoneWidthPct,
  goodWidthPct: config.goodZoneWidthPct
};

setupImageFallback(ui.sparkieImg, () => ui.sparkie.classList.add('fallback'));
setupImageFallback(ui.topLogo, () => ui.topLogo.classList.add('img-fallback'));
setupImageFallback(ui.sparkieLogo, () => ui.sparkieLogo.classList.add('img-fallback'));
setupImageFallback(ui.rewardIcon, () => showRewardFallback(true));

ui.best.textContent = state.best;
wireEvents();

function wireEvents() {
  ui.startBtn.addEventListener('click', () => {
    ui.startScreen.classList.remove('active');
    ui.gameScreen.classList.add('active');
    resetGame();
    startRound();
  });

  ui.stopBtn.addEventListener('click', tryStop);
  ui.nextBtn.addEventListener('click', startRound);
  ui.restartBtn.addEventListener('click', resetAndStart);

  ui.track.addEventListener('pointerdown', () => {
    if (state.running) tryStop();
  });

  window.addEventListener('keydown', (event) => {
    if (!state.running) return;
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      tryStop();
    }
  });
}

function resetAndStart() {
  resetGame();
  startRound();
}

function resetGame() {
  state.score = 0;
  state.round = 1;
  state.streak = 0;
  updateHud();
}

function startRound() {
  if (state.animationId) cancelAnimationFrame(state.animationId);
  state.ended = false;
  state.running = true;
  ui.resultOverlay.classList.remove('active');

  const difficultyLevel = state.round - 1;
  state.runDurationMs = Math.max(
    config.minDurationMs,
    config.baseDurationMs - difficultyLevel * config.durationStepMs
  );

  state.perfectWidthPct = Math.max(
    config.minPerfectZoneWidthPct,
    config.perfectZoneWidthPct - difficultyLevel * config.perfectZoneShrinkPerRound
  );
  state.goodWidthPct = Math.max(state.perfectWidthPct * 2.6, config.goodZoneWidthPct - difficultyLevel * 0.004);

  // Target center is randomly positioned away from edges.
  state.targetCenterPct = 0.2 + Math.random() * 0.6;

  positionTargetZones();

  state.sparkieX = 0;
  state.runStartTs = performance.now();
  ui.sparkie.classList.remove('stopped');
  ui.sparkie.classList.add('running');
  moveSparkie();

  state.animationId = requestAnimationFrame(gameLoop);
}

function gameLoop(ts) {
  if (!state.running) return;

  const elapsed = ts - state.runStartTs;
  const progress = Math.min(elapsed / state.runDurationMs, 1);
  const eased = easeInOut(progress);

  state.sparkieX = eased;
  moveSparkie();

  if (progress >= 1) {
    resolveStop();
    return;
  }

  state.animationId = requestAnimationFrame(gameLoop);
}

function tryStop() {
  if (!state.running || state.ended) return;
  resolveStop();
}

function resolveStop() {
  state.running = false;
  state.ended = true;
  if (state.animationId) cancelAnimationFrame(state.animationId);

  ui.sparkie.classList.remove('running');
  ui.sparkie.classList.add('stopped');

  const { rank, points } = calculateResult();
  state.score += points;
  state.streak = rank === 'perfect' ? state.streak + 1 : 0;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem('sparkieDashBest', String(state.best));

  showResult(rank, points);
  updateHud();
  state.round += 1;
}

function calculateResult() {
  const distance = Math.abs(state.sparkieX - state.targetCenterPct);
  const perfectHalf = state.perfectWidthPct / 2;
  const goodHalf = state.goodWidthPct / 2;

  if (distance <= perfectHalf * 0.45) {
    return { rank: 'perfect', points: config.scoreBands.perfect };
  }

  if (distance <= perfectHalf) {
    return { rank: 'great', points: config.scoreBands.great };
  }

  if (distance <= goodHalf) {
    return { rank: 'good', points: config.scoreBands.good };
  }

  return { rank: 'miss', points: config.scoreBands.miss };
}

function showResult(rank, points) {
  const labels = {
    perfect: 'PERFECT',
    great: 'GREAT',
    good: 'GOOD',
    miss: 'MISS'
  };

  const colors = {
    perfect: '#EF5F17',
    great: '#57BEB1',
    good: '#80dbc0',
    miss: '#f5f5f5'
  };

  ui.resultText.textContent = labels[rank];
  ui.resultText.style.color = colors[rank];
  ui.resultPoints.textContent = `+${points} points`;

  if (rank === 'miss') {
    showRewardFallback(true);
  } else {
    showRewardFallback(false);
    ui.rewardIcon.src = rewardMap[rank];
    ui.rewardIcon.alt = `${rank} reward icon`;
  }

  ui.resultOverlay.classList.add('active');
}

function positionTargetZones() {
  ui.goodZone.style.left = `${state.targetCenterPct * 100}%`;
  ui.goodZone.style.width = `${state.goodWidthPct * 100}%`;

  ui.perfectZone.style.left = `${state.targetCenterPct * 100}%`;
  ui.perfectZone.style.width = `${state.perfectWidthPct * 100}%`;
}

function moveSparkie() {
  const width = ui.track.clientWidth;
  const x = state.sparkieX * width;
  ui.sparkie.style.left = `${x}px`;
  ui.sparkie.style.filter = `blur(${Math.max(0, (state.running ? 1.8 : 0) - Math.abs(state.sparkieX - state.targetCenterPct) * 2)}px)`;
}

function updateHud() {
  ui.score.textContent = state.score;
  ui.best.textContent = state.best;
  ui.round.textContent = state.round;
  ui.streak.textContent = state.streak;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function setupImageFallback(imgElement, onError) {
  imgElement.addEventListener('error', onError);
}

function showRewardFallback(show) {
  ui.rewardFallback.hidden = !show;
  ui.rewardIcon.hidden = show;
}
