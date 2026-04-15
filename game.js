import {
  initFirestore,
  upsertSessionWithQueue,
  flushQueuedSessionOps,
  registerOnlineFlushListener,
  createSessionId
} from './firebaseClient.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreValue = document.getElementById('scoreValue');
const timerValue = document.getElementById('timerValue');
const livesValue = document.getElementById('livesValue');
const levelValue = document.getElementById('levelValue');
const nameValue = document.getElementById('nameValue');
const coinLegend = document.getElementById('coinLegend');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameWrap = document.getElementById('gameWrap');
const playerLabel = document.getElementById('playerLabel');
const finalName = document.getElementById('finalName');
const finalScore = document.getElementById('finalScore');
const submitStatus = document.getElementById('submitStatus');
const levelBanner = document.getElementById('levelBanner');
const mainArea = document.querySelector('main');

const tileSize = 32;
const mazeCols = canvas.width / tileSize;
const mazeRows = canvas.height / tileSize;
const START_TILE = { col: 1, row: 1 };

const PLAYER_COUNTER_KEY = 'pacmansave_player_counter';

const mazeLayout = [
  '111111111111111111111111111111',
  '100000001000000000000100000001',
  '101111101011111011110101111101',
  '101000001000001000010100000101',
  '101011111111101111010111110101',
  '100010000010001000010000010001',
  '111010111010111011101011010111',
  '100000101000100000101000010001',
  '101111101111101111101111110101',
  '100000000000001000000000000001',
  '111011111011101011101111011111',
  '100010001000001000001000010001',
  '101110101111101111101011110101',
  '100000100000100000100010000001',
  '101111111110101011111110111101',
  '100000000000100010000000000001',
  '101111011111101111101111011101',
  '100001000000001000000001000001',
  '101101111011111011111101011101',
  '111111111111111111111111111111'
];

const coinDefs = {
  heart: { value: 10, rate: 0.52, img: 'assets/coins/coin_heart.png', color: '#57beb1' },
  wink: { value: 30, rate: 0.23, speedBoost: 3.5, img: 'assets/coins/coin_wink.png', color: '#7bf0df' },
  card: { value: 50, rate: 0.18, img: 'assets/coins/coin_card.png', color: '#81d8ce' },
  token: { value: 100, rate: 0.07, img: 'assets/coins/coin_token.png', color: '#ef5f17' },
  monster: { value: 75, rate: 0.14, img: 'assets/coins/IMG_0195.jpeg', color: '#ff74d4', eatDuration: 6500 }
};

const assets = {
  player: loadImage('assets/sparkie_player.png'),
  enemyGhost: loadImage('assets/enemy_bat.svg'),
  logo: loadImage('assets/Value-Logo.png'),
  coins: {
    heart: loadImage(coinDefs.heart.img),
    wink: loadImage(coinDefs.wink.img),
    card: loadImage(coinDefs.card.img),
    token: loadImage(coinDefs.token.img),
    monster: loadImage(coinDefs.monster.img)
  }
};

const keys = new Set();
const touchControl = { active: false, dx: 0, dy: 0, startX: 0, startY: 0 };
let gameState = 'menu';
let lastFrame = 0;
let remainingTime = 60;
let level = 1;
let levelStartTime = 0;
let score = 0;
let lives = 3;
let playerName = 'Player';
let playerNumber = 1;
let currentSessionId = '';
let speedBoostUntil = 0;
let monsterEatUntil = 0;
let levelTransitionUntil = 0;
let autoHomeTimeout = 0;
let audioCtx;
let musicGain;
let sfxGain;
let gameplayLoopNodes;
let nextWakaAt = 0;
let wakaFlip = false;

const particles = [];
const coins = [];
const dots = [];
const enemies = [];

const LEVELS = [
  { timeLimit: 30, enemyCount: 5, enemyMinSpeed: 70, enemyRange: 30 },
  { timeLimit: 30, enemyCount: 7, enemyMinSpeed: 95, enemyRange: 40 },
  { timeLimit: 30, enemyCount: 9, enemyMinSpeed: 120, enemyRange: 55 }
];

const player = { x: 0, y: 0, r: tileSize * 0.34, vx: 0, vy: 0, angle: 0, invulnerableUntil: 0 };

function layoutGameArea() {
  if (!mainArea || !gameWrap) return;

  const maxWidth = mainArea.clientWidth;
  const maxHeight = mainArea.clientHeight;
  if (!maxWidth || !maxHeight) return;

  const aspect = canvas.width / canvas.height;
  let targetWidth = maxHeight * aspect;
  let targetHeight = maxHeight;

  if (targetWidth > maxWidth) {
    targetWidth = maxWidth;
    targetHeight = targetWidth / aspect;
  }

  gameWrap.style.width = `${Math.floor(targetWidth)}px`;
  gameWrap.style.height = `${Math.floor(targetHeight)}px`;
}


async function ensureAudioReady() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = new Ctx();
    musicGain = audioCtx.createGain();
    sfxGain = audioCtx.createGain();
    musicGain.gain.value = 0.18;
    sfxGain.gain.value = 0.27;
    musicGain.connect(audioCtx.destination);
    sfxGain.connect(audioCtx.destination);
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  return true;
}

function playSparkieTone({ freq = 330, type = 'sine', dur = 0.12, volume = 0.15, startAt = 0 }) {
  if (!audioCtx || !sfxGain) return;
  const now = audioCtx.currentTime + startAt;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + Math.max(0.01, dur * 0.18));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function playSparkieZap() {
  if (!audioCtx || !sfxGain) return;
  playSparkieTone({ freq: 490, type: 'triangle', dur: 0.08, volume: 0.12 });
  playSparkieTone({ freq: 730, type: 'sawtooth', dur: 0.06, volume: 0.06, startAt: 0.012 });
}

function playWaka(now = performance.now()) {
  if (!audioCtx || !sfxGain || now < nextWakaAt) return;
  nextWakaAt = now + 80;
  wakaFlip = !wakaFlip;
  const freq = wakaFlip ? 560 : 690;
  playSparkieTone({ freq, type: 'triangle', dur: 0.043, volume: 0.038 });
}

function playHitAlarm() {
  if (!audioCtx || !sfxGain) return;
  playSparkieTone({ freq: 190, type: 'square', dur: 0.16, volume: 0.15 });
  playSparkieTone({ freq: 140, type: 'triangle', dur: 0.2, volume: 0.1, startAt: 0.035 });
}

function playLevelUpSting() {
  if (!audioCtx || !sfxGain) return;
  [420, 560, 760].forEach((freq, i) => {
    playSparkieTone({ freq, type: 'triangle', dur: 0.12, volume: 0.13, startAt: i * 0.08 });
  });
}

function playGameOverSting() {
  if (!audioCtx || !sfxGain) return;
  [300, 230, 170].forEach((freq, i) => {
    playSparkieTone({ freq, type: 'sawtooth', dur: 0.19, volume: 0.12, startAt: i * 0.1 });
  });
}

function startGameplayLoop() {
  if (!audioCtx || !musicGain || gameplayLoopNodes) return;
  const now = audioCtx.currentTime;
  musicGain.gain.setValueAtTime(0.11, now);

  const baseOsc = audioCtx.createOscillator();
  const baseGain = audioCtx.createGain();
  baseOsc.type = 'triangle';
  baseOsc.frequency.setValueAtTime(104, now);
  baseGain.gain.setValueAtTime(0.0001, now);
  baseGain.gain.exponentialRampToValueAtTime(0.03, now + 0.8);

  const shimmerOsc = audioCtx.createOscillator();
  const shimmerGain = audioCtx.createGain();
  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.setValueAtTime(208, now);
  shimmerGain.gain.setValueAtTime(0.008, now);

  const shimmerLfo = audioCtx.createOscillator();
  const shimmerLfoGain = audioCtx.createGain();
  shimmerLfo.type = 'sine';
  shimmerLfo.frequency.setValueAtTime(0.33, now);
  shimmerLfoGain.gain.setValueAtTime(2.7, now);
  shimmerLfo.connect(shimmerLfoGain);
  shimmerLfoGain.connect(baseOsc.frequency);

  const pulse = audioCtx.createOscillator();
  const pulseGain = audioCtx.createGain();
  pulse.type = 'sine';
  pulse.frequency.setValueAtTime(0.17, now);
  pulseGain.gain.setValueAtTime(0.0025, now);
  pulse.connect(pulseGain);
  pulseGain.connect(shimmerGain.gain);

  const toneFilter = audioCtx.createBiquadFilter();
  toneFilter.type = 'lowpass';
  toneFilter.frequency.setValueAtTime(780, now);
  toneFilter.Q.setValueAtTime(0.75, now);

  baseOsc.connect(baseGain);
  shimmerOsc.connect(shimmerGain);
  baseGain.connect(toneFilter);
  shimmerGain.connect(toneFilter);
  toneFilter.connect(musicGain);

  baseOsc.start(now);
  shimmerOsc.start(now);
  shimmerLfo.start(now);
  pulse.start(now);

  gameplayLoopNodes = {
    baseOsc,
    baseGain,
    shimmerOsc,
    shimmerGain,
    shimmerLfo,
    pulse,
    pulseGain,
    toneFilter
  };
}

function stopGameplayLoop() {
  if (!audioCtx || !musicGain || !gameplayLoopNodes) return;
  const now = audioCtx.currentTime;
  gameplayLoopNodes.baseGain.gain.cancelScheduledValues(now);
  gameplayLoopNodes.baseGain.gain.setValueAtTime(gameplayLoopNodes.baseGain.gain.value, now);
  gameplayLoopNodes.baseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gameplayLoopNodes.shimmerGain.gain.cancelScheduledValues(now);
  gameplayLoopNodes.shimmerGain.gain.setValueAtTime(gameplayLoopNodes.shimmerGain.gain.value, now);
  gameplayLoopNodes.shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gameplayLoopNodes.pulseGain.gain.cancelScheduledValues(now);
  gameplayLoopNodes.pulseGain.gain.setValueAtTime(gameplayLoopNodes.pulseGain.gain.value, now);
  gameplayLoopNodes.pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  const stopAt = now + 0.4;
  gameplayLoopNodes.baseOsc.stop(stopAt);
  gameplayLoopNodes.shimmerOsc.stop(stopAt);
  gameplayLoopNodes.shimmerLfo.stop(stopAt);
  gameplayLoopNodes.pulse.stop(stopAt);
  gameplayLoopNodes = null;
}

function readPlayerCounter() {
  const raw = Number(localStorage.getItem(PLAYER_COUNTER_KEY));
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

function nextPlayerNumber() {
  const next = readPlayerCounter() + 1;
  localStorage.setItem(PLAYER_COUNTER_KEY, String(next));
  return next;
}

function refreshPlayerPreview() {
  const upcoming = readPlayerCounter() + 1;
  if (playerLabel) playerLabel.textContent = `Player ${upcoming}`;
}

function loadImage(src) {
  const img = new Image();
  let ok = false;
  img.onload = () => { ok = true; };
  img.onerror = () => { ok = false; };
  img.src = src;
  return { img, loaded: () => ok };
}

function buildCoinLegend() {
  const defs = [
    ['heart', '+10'],
    ['wink', '+30 speed'],
    ['card', '+50'],
    ['token', '+100'],
    ['monster', 'L3 eat monsters']
  ];
  defs.forEach(([type, label]) => {
    const chip = document.createElement('div');
    chip.className = 'coin-chip';
    const img = document.createElement('img');
    img.src = assets.coins[type].img.src;
    img.alt = type;
    const dot = document.createElement('span');
    dot.className = 'fallback';
    dot.style.background = coinDefs[type].color;
    img.onerror = () => {
      if (img.parentNode) img.remove();
      chip.prepend(dot);
    };
    chip.appendChild(img);
    const text = document.createElement('span');
    text.textContent = `${type.toUpperCase()} ${label}`;
    chip.appendChild(text);
    coinLegend.appendChild(chip);
  });
}

function isWall(col, row) {
  if (col < 0 || row < 0 || col >= mazeCols || row >= mazeRows) return true;
  return mazeLayout[row][col] === '1';
}

function hitWallCircle(x, y, radius) {
  const left = Math.floor((x - radius) / tileSize);
  const right = Math.floor((x + radius) / tileSize);
  const top = Math.floor((y - radius) / tileSize);
  const bottom = Math.floor((y + radius) / tileSize);
  for (let c = left; c <= right; c++) {
    for (let r = top; r <= bottom; r++) {
      if (isWall(c, r)) return true;
    }
  }
  return false;
}

function startPosition() {
  return { x: START_TILE.col * tileSize + tileSize / 2, y: START_TILE.row * tileSize + tileSize / 2 };
}

function currentLevelConfig() {
  return LEVELS[level - 1];
}

function populateDots() {
  dots.length = 0;
  for (let row = 1; row < mazeRows - 1; row++) {
    for (let col = 1; col < mazeCols - 1; col++) {
      if (isWall(col, row)) continue;
      const nearStart = Math.abs(col - START_TILE.col) <= 1 && Math.abs(row - START_TILE.row) <= 1;
      if (nearStart) continue;
      dots.push({ x: col * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 });
    }
  }
}

function randomOpenPosition() {
  while (true) {
    const col = Math.floor(Math.random() * mazeCols);
    const row = Math.floor(Math.random() * mazeRows);
    if (!isWall(col, row) && (Math.abs(col - START_TILE.col) > 2 || Math.abs(row - START_TILE.row) > 2)) {
      return { x: col * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 };
    }
  }
}

function spawnCoin() {
  if (coins.length > 18) return;
  const availableTypes = level >= 3
    ? ['heart', 'wink', 'card', 'token', 'monster']
    : ['heart', 'wink', 'card', 'token'];
  const rateSum = availableTypes.reduce((sum, key) => sum + coinDefs[key].rate, 0);
  const roll = Math.random() * rateSum;
  let sum = 0;
  let type = availableTypes[0];
  for (const key of availableTypes) {
    sum += coinDefs[key].rate;
    if (roll <= sum) {
      type = key;
      break;
    }
  }
  const pos = randomOpenPosition();
  coins.push({ type, x: pos.x, y: pos.y, t: Math.random() * Math.PI * 2 });
}

function spawnEnemy() {
  const pos = randomOpenPosition();
  const cfg = currentLevelConfig();
  enemies.push({
    x: pos.x,
    y: pos.y,
    r: tileSize * 0.34,
    vx: 0,
    vy: 0,
    speed: cfg.enemyMinSpeed + Math.random() * cfg.enemyRange,
    turnAt: 0,
    useSprite: Math.random() < 0.8
  });
}

function setupLevel(resetTime = true) {
  particles.length = 0;
  coins.length = 0;
  enemies.length = 0;
  populateDots();

  const p = startPosition();
  player.x = p.x;
  player.y = p.y;
  player.vx = 0;
  player.vy = 0;
  player.angle = 0;
  player.invulnerableUntil = performance.now() + 1200;

  for (let i = 0; i < 10; i++) spawnCoin();
  for (let i = 0; i < currentLevelConfig().enemyCount; i++) spawnEnemy();

  if (resetTime) levelStartTime = performance.now();
  updateHud();
}

function resetGame() {
  score = 0;
  lives = 3;
  level = 1;
  speedBoostUntil = 0;
  monsterEatUntil = 0;
  levelTransitionUntil = 0;
  remainingTime = currentLevelConfig().timeLimit;
  nextWakaAt = 0;
  wakaFlip = false;
  setupLevel(true);
}

function advanceLevel(now) {
  if (level >= LEVELS.length) {
    endGame(true);
    return;
  }

  const completedLevel = level;
  level += 1;
  speedBoostUntil = 0;
  monsterEatUntil = 0;
  remainingTime = currentLevelConfig().timeLimit;
  setupLevel(false);

  levelTransitionUntil = now + 1700;
  levelStartTime = levelTransitionUntil;
  levelBanner.textContent = `Level ${completedLevel} Completed!`;
  levelBanner.classList.add('show');
  playLevelUpSting();
}

function updateHud() {
  scoreValue.textContent = String(score);
  timerValue.textContent = String(Math.max(0, Math.ceil(remainingTime)));
  livesValue.textContent = String(lives);
  levelValue.textContent = String(level);
  nameValue.textContent = playerName;
}

function collectCoin(index) {
  const c = coins[index];
  score += coinDefs[c.type].value;
  if (c.type === 'wink') speedBoostUntil = performance.now() + 4500;
  const sparkFreq = {
    heart: 520,
    wink: 700,
    card: 580,
    token: 840
  };
  playSparkieTone({ freq: sparkFreq[c.type], type: 'triangle', dur: 0.09, volume: 0.1 });
  if (c.type === 'token') playSparkieZap();
  if (c.type === 'monster') monsterEatUntil = performance.now() + coinDefs.monster.eatDuration;
  for (let i = 0; i < 13; i++) {
    particles.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, life: 0.65, color: coinDefs[c.type].color });
  }
  coins.splice(index, 1);
  spawnCoin();
}

function getInputDirection() {
  let dx = 0;
  let dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
  if (touchControl.active) {
    dx += touchControl.dx;
    dy += touchControl.dy;
  }
  return { dx, dy };
}

function updatePlayer(dt, now) {
  const speed = now < speedBoostUntil ? 250 : 185;
  const dir = getInputDirection();
  const len = Math.hypot(dir.dx, dir.dy) || 1;
  player.vx = (dir.dx / len) * speed;
  player.vy = (dir.dy / len) * speed;

  const nx = player.x + player.vx * dt;
  const ny = player.y + player.vy * dt;
  if (!hitWallCircle(nx, player.y, player.r)) player.x = nx;
  if (!hitWallCircle(player.x, ny, player.r)) player.y = ny;
  if (dir.dx || dir.dy) player.angle = Math.atan2(dir.dy, dir.dx);

  for (let i = dots.length - 1; i >= 0; i--) {
    if (Math.hypot(player.x - dots[i].x, player.y - dots[i].y) < player.r + 5) {
      score += 1;
      dots.splice(i, 1);
      playWaka(now);
    }
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    if (Math.hypot(player.x - coins[i].x, player.y - coins[i].y) < player.r + tileSize * 0.36) collectCoin(i);
  }

  if (now > player.invulnerableUntil) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r) {
        if (now < monsterEatUntil) {
          score += 120;
          for (let burst = 0; burst < 15; burst++) {
            particles.push({
              x: e.x,
              y: e.y,
              vx: (Math.random() - 0.5) * 160,
              vy: (Math.random() - 0.5) * 160,
              life: 0.55,
              color: coinDefs.monster.color
            });
          }
          enemies.splice(i, 1);
          continue;
        }
        lives -= 1;
        playHitAlarm();
        player.invulnerableUntil = now + 2000;
        const p = startPosition();
        player.x = p.x;
        player.y = p.y;
        break;
      }
    }
  }
}

function updateEnemies(dt, now) {
  for (const e of enemies) {
    if (now > e.turnAt || (Math.abs(e.vx) < 1 && Math.abs(e.vy) < 1)) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
      for (const [dx, dy] of dirs) {
        if (!hitWallCircle(e.x + dx * tileSize * 0.8, e.y + dy * tileSize * 0.8, e.r)) {
          e.vx = dx * e.speed;
          e.vy = dy * e.speed;
          e.turnAt = now + 500 + Math.random() * 1200;
          break;
        }
      }
    }
    const nx = e.x + e.vx * dt;
    const ny = e.y + e.vy * dt;
    if (!hitWallCircle(nx, e.y, e.r)) e.x = nx; else e.vx *= -1;
    if (!hitWallCircle(e.x, ny, e.r)) e.y = ny; else e.vy *= -1;
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawMaze(now) {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < mazeRows; row++) {
    for (let col = 0; col < mazeCols; col++) {
      if (mazeLayout[row][col] === '1') {
        const x = col * tileSize;
        const y = row * tileSize;
        ctx.fillStyle = '#1d3e3a';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = 'rgba(87,190,177,0.65)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1.5, y + 1.5, tileSize - 3, tileSize - 3);
      }
    }
  }

  const sx = START_TILE.col * tileSize;
  const sy = START_TILE.row * tileSize;
  ctx.save();
  ctx.fillStyle = 'rgba(87,190,177,0.16)';
  ctx.fillRect(sx - 2, sy - 2, tileSize * 2 + 4, tileSize * 2 + 4);
  ctx.strokeStyle = '#57beb1';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx - 1, sy - 1, tileSize * 2 + 2, tileSize * 2 + 2);
  ctx.fillStyle = '#d6fff9';
  ctx.font = 'bold 12px Segoe UI';
  ctx.fillText('START', sx + 8, sy + tileSize * 2 + 13 + Math.sin(now / 180) * 1.5);
  ctx.restore();
}

function drawDots() {
  ctx.fillStyle = '#ffe8a3';
  for (const dot of dots) {
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoin(coin, now) {
  const bob = Math.sin(now / 300 + coin.t) * 3.5;
  const pulse = 1 + Math.sin(now / 240 + coin.t) * 0.08;
  const size = tileSize * (coin.type === 'token' ? 0.86 : 0.76) * pulse;
  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
  ctx.rotate(now / 900 + coin.t);
  const image = assets.coins[coin.type];
  if (image.loaded()) {
    ctx.shadowBlur = coin.type === 'token' ? 20 : 11;
    ctx.shadowColor = coinDefs[coin.type].color;
    ctx.drawImage(image.img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = coinDefs[coin.type].color;
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemies(now) {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const size = tileSize * 1.1;
    if (e.useSprite && assets.enemyGhost.loaded()) {
      ctx.shadowColor = 'rgba(239,95,23,0.45)';
      ctx.shadowBlur = 8;
      ctx.drawImage(assets.enemyGhost.img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#ef5f17';
      ctx.beginPath();
      ctx.arc(0, 0, e.r + Math.sin(now / 210) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer(now) {
  const bounce = Math.sin(now / 110) * 2.4;
  const inv = now < player.invulnerableUntil;
  ctx.save();
  ctx.translate(player.x, player.y + bounce);
  ctx.rotate(player.angle * 0.25);
  ctx.globalAlpha = inv ? 0.58 + Math.sin(now / 80) * 0.25 : 1;
  const size = tileSize * 1.02;
  if (assets.player.loaded()) {
    ctx.shadowBlur = 11;
    ctx.shadowColor = '#ef5f17';
    ctx.drawImage(assets.player.img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = '#ef5f17';
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (now < speedBoostUntil) {
    ctx.strokeStyle = 'rgba(87,190,177,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (now < monsterEatUntil) {
    ctx.strokeStyle = 'rgba(255,116,212,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, player.r + 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawTouchIndicator() {
  if (!touchControl.active) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(87,190,177,0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(touchControl.startX, touchControl.startY, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(touchControl.startX, touchControl.startY);
  ctx.lineTo(touchControl.startX + touchControl.dx * 38, touchControl.startY + touchControl.dy * 38);
  ctx.stroke();
  ctx.restore();
}

function tick(ts) {
  if (gameState !== 'playing') return;
  const dt = Math.min(0.033, (ts - lastFrame) / 1000);
  lastFrame = ts;

  const cfg = currentLevelConfig();
  remainingTime = Math.min(cfg.timeLimit, cfg.timeLimit - (ts - levelStartTime) / 1000);

  const inTransition = ts < levelTransitionUntil;
  if (!inTransition) {
    if (levelBanner.classList.contains('show')) levelBanner.classList.remove('show');
    if (remainingTime <= 0) {
      advanceLevel(ts);
      requestAnimationFrame(tick);
      return;
    }

    if (lives <= 0) {
      endGame(false);
      return;
    }

    if (Math.random() < 0.02) spawnCoin();

    updatePlayer(dt, ts);
    updateEnemies(dt, ts);
    updateParticles(dt);
  }

  updateHud();
  drawMaze(ts);
  drawDots();
  coins.forEach((coin) => drawCoin(coin, ts));
  drawEnemies(ts);
  drawPlayer(ts);
  drawParticles();
  drawTouchIndicator();

  if (!inTransition && dots.length === 0) advanceLevel(ts);

  requestAnimationFrame(tick);
}

async function startGame() {
  await ensureAudioReady();

  if (autoHomeTimeout) {
    clearTimeout(autoHomeTimeout);
    autoHomeTimeout = 0;
  }

  playerNumber = nextPlayerNumber();
  playerName = `Player ${playerNumber}`;
  currentSessionId = createSessionId(playerNumber);

  if (playerLabel) playerLabel.textContent = playerName;
  nameValue.textContent = playerName;
  submitStatus.textContent = '';
  resetGame();

  const sessionPayload = {
    startedAt: Date.now(),
    endedAt: 0,
    score: 0,
    status: 'playing',
    level: 1,
    lives: 3,
    won: false,
    name: '',
    phone: '',
    playerNumber
  };

  await upsertSessionWithQueue(currentSessionId, sessionPayload, { merge: false });
  refreshPlayerPreview();
  playSparkieZap();
  startGameplayLoop();

  startScreen.classList.remove('active');
  gameOverScreen.classList.remove('active');
  gameWrap.style.visibility = 'visible';
  layoutGameArea();
  gameState = 'playing';
  levelStartTime = performance.now();
  lastFrame = levelStartTime;
  requestAnimationFrame(tick);
}

function goHome(reset = false) {
  if (autoHomeTimeout) {
    clearTimeout(autoHomeTimeout);
    autoHomeTimeout = 0;
  }

  gameState = 'menu';
  levelBanner.classList.remove('show');
  levelBanner.textContent = '';
  gameOverScreen.classList.remove('active');
  startScreen.classList.add('active');
  gameWrap.style.visibility = 'hidden';
  layoutGameArea();
  submitStatus.textContent = '';
  stopGameplayLoop();
  if (reset) resetGame();
}

async function endGame(won = false) {
  gameState = 'over';
  levelBanner.classList.remove('show');
  gameWrap.style.visibility = 'hidden';
  finalName.textContent = playerName;
  finalScore.textContent = String(score);
  gameOverScreen.classList.add('active');

  const endPayload = {
    endedAt: Date.now(),
    status: 'ended',
    score,
    level,
    lives,
    won
  };

  if (currentSessionId) {
    await upsertSessionWithQueue(currentSessionId, endPayload, { merge: true });
  }
  stopGameplayLoop();
  if (won) playLevelUpSting(); else playGameOverSting();

  submitStatus.textContent = won ? 'You cleared all 3 levels! Returning to home in 5s...' : 'Session saved. Returning to home in 5s...';

  autoHomeTimeout = window.setTimeout(() => {
    goHome(true);
  }, 5000);
}

document.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if ((e.code === 'Space' || key === ' ') && gameState === 'menu') {
    e.preventDefault();
    if (!e.repeat) {
      ensureAudioReady();
      startGame();
    }
    return;
  }

  keys.add(key);
});

document.addEventListener('keyup', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys.delete(key);
});

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  touchControl.active = true;
  touchControl.startX = e.offsetX;
  touchControl.startY = e.offsetY;
  touchControl.dx = 0;
  touchControl.dy = 0;
});

canvas.addEventListener('pointermove', (e) => {
  if (!touchControl.active) return;
  const dx = e.offsetX - touchControl.startX;
  const dy = e.offsetY - touchControl.startY;
  const len = Math.hypot(dx, dy);
  if (len < 8) {
    touchControl.dx = 0;
    touchControl.dy = 0;
    return;
  }
  touchControl.dx = dx / len;
  touchControl.dy = dy / len;
});

const stopTouch = () => {
  touchControl.active = false;
  touchControl.dx = 0;
  touchControl.dy = 0;
};
canvas.addEventListener('pointerup', stopTouch);
canvas.addEventListener('pointercancel', stopTouch);
canvas.addEventListener('pointerleave', stopTouch);

window.addEventListener('resize', layoutGameArea);
layoutGameArea();

document.getElementById('startBtn').addEventListener('click', async () => {
  await ensureAudioReady();
  startGame();
});
document.getElementById('playAgainBtn').addEventListener('click', async () => {
  await ensureAudioReady();
  playSparkieTone({ freq: 360, type: 'triangle', dur: 0.08, volume: 0.1 });
  goHome(true);
});

(async function bootstrap() {
  const fire = await initFirestore();
  registerOnlineFlushListener();
  if (fire.ready) {
    await flushQueuedSessionOps();
  }
  refreshPlayerPreview();
  buildCoinLegend();
})();
