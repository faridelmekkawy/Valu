const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  startScreen: document.getElementById('startScreen'),
  gameOverScreen: document.getElementById('gameOverScreen'),
  startBtn: document.getElementById('startBtn'),
  playAgainBtn: document.getElementById('playAgainBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  score: document.getElementById('score'),
  distance: document.getElementById('distance'),
  lives: document.getElementById('lives'),
  finalScore: document.getElementById('finalScore'),
  finalDistance: document.getElementById('finalDistance'),
  bestScoreStart: document.getElementById('bestScoreStart'),
  bestScoreEnd: document.getElementById('bestScoreEnd'),
  startLogo: document.getElementById('startLogo'),
  hudLogo: document.getElementById('hudLogo')
};

const ASSET_PATHS = {
  player: '../assets/sparkie_player.png',
  logo: '../assets/Value-Logo.png',
  coinHeart: '../assets/coins/coin_heart.png',
  coinWink: '../assets/coins/coin_wink.png',
  coinToken: '../assets/coins/coin_token.png'
};

const coinDefs = {
  heart: { value: 10, chance: 0.72, effect: 'none', glow: 'rgba(87,190,177,0.4)', sprite: null, path: ASSET_PATHS.coinHeart },
  wink: { value: 30, chance: 0.22, effect: 'multiplier', glow: 'rgba(239,95,23,0.6)', sprite: null, path: ASSET_PATHS.coinWink },
  token: { value: 100, chance: 0.06, effect: 'boost', glow: 'rgba(255,216,94,0.7)', sprite: null, path: ASSET_PATHS.coinToken }
};

const state = {
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  distance: 0,
  lives: 3,
  speed: 360,
  speedMax: 860,
  obstacleTimer: 0,
  coinTimer: 0,
  laneCooldown: 0,
  time: 0,
  multiplierUntil: 0,
  boostUntil: 0,
  invulnerableUntil: 0,
  bestScore: Number(localStorage.getItem('sparkieRushBest') || 0)
};

const world = {
  lanes: [canvas.width * 0.3, canvas.width * 0.5, canvas.width * 0.7],
  groundY: canvas.height * 0.82,
  obstacles: [],
  coins: [],
  particles: [],
  stars: Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    z: 0.35 + Math.random() * 0.9
  }))
};

const player = {
  lane: 1,
  targetLane: 1,
  x: world.lanes[1],
  y: world.groundY,
  vy: 0,
  width: 92,
  height: 118,
  jumpPower: 760,
  gravity: 1900,
  slidingUntil: 0,
  sprite: null,
  missingSprite: false,
  bounceTime: 0
};

const keys = new Set();


const touch = { active: false, startX: 0, startY: 0, moved: false };

canvas.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  touch.active = true;
  touch.startX = t.clientX;
  touch.startY = t.clientY;
  touch.moved = false;
}, { passive: true });

canvas.addEventListener('touchmove', () => {
  touch.moved = true;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (!state.running || state.paused || !touch.active) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.startX;
  const dy = t.clientY - touch.startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const threshold = 24;
  if (Math.max(absX, absY) < threshold) {
    touch.active = false;
    return;
  }
  if (absX > absY) {
    moveLane(dx > 0 ? 1 : -1);
  } else if (dy < 0) {
    jump();
  } else {
    slide();
  }
  touch.active = false;
}, { passive: true });



ui.startLogo.addEventListener('error', () => {
  if (ui.startLogo.dataset.fallbackApplied) {
    ui.startLogo.style.display = 'none';
    return;
  }
  ui.startLogo.dataset.fallbackApplied = '1';
  ui.startLogo.src = ASSET_PATHS.logo;
});
ui.hudLogo.addEventListener('error', () => {
  if (ui.hudLogo.dataset.fallbackApplied) {
    ui.hudLogo.style.display = 'none';
    return;
  }
  ui.hudLogo.dataset.fallbackApplied = '1';
  ui.hudLogo.src = ASSET_PATHS.logo;
});


function loadImage(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

async function loadAssets() {
  player.sprite = await loadImage(ASSET_PATHS.player);
  if (!player.sprite) player.missingSprite = true;

  const logo = await loadImage(ASSET_PATHS.logo);
  if (!logo) {
    ui.hudLogo.style.display = 'none';
    if (ui.startLogo.getAttribute('src') === ASSET_PATHS.logo) {
      ui.startLogo.style.display = 'none';
    }
  }

  for (const key of Object.keys(coinDefs)) {
    coinDefs[key].sprite = await loadImage(coinDefs[key].path);
  }
}

function showOverlay(name) {
  ui.startScreen.classList.remove('active');
  ui.gameOverScreen.classList.remove('active');
  if (name === 'start') ui.startScreen.classList.add('active');
  if (name === 'gameover') ui.gameOverScreen.classList.add('active');
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.distance = 0;
  state.lives = 3;
  state.speed = 360;
  state.obstacleTimer = 0;
  state.coinTimer = 0;
  state.multiplierUntil = 0;
  state.boostUntil = 0;
  state.invulnerableUntil = 0;
  world.obstacles.length = 0;
  world.coins.length = 0;
  world.particles.length = 0;
  player.lane = 1;
  player.targetLane = 1;
  player.x = world.lanes[1];
  player.y = world.groundY;
  player.vy = 0;
  updateHud();
  showOverlay('none');
  ui.pauseBtn.textContent = 'Pause';
}

function updateHud() {
  ui.score.textContent = String(Math.floor(state.score));
  ui.distance.textContent = `${Math.floor(state.distance)}m`;
  ui.lives.textContent = String(state.lives);
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const roll = Math.random();
  let kind = 'block';
  if (roll < 0.34) kind = 'low';
  else if (roll < 0.67) kind = 'high';
  else if (roll < 0.86) kind = 'barrier';

  world.obstacles.push({ lane, kind, y: -120, width: 126, height: 72, hit: false });
}

function spawnCoin() {
  const lane = Math.floor(Math.random() * 3);
  const pick = Math.random();
  let sum = 0;
  let type = 'heart';
  for (const key of Object.keys(coinDefs)) {
    sum += coinDefs[key].chance;
    if (pick <= sum) {
      type = key;
      break;
    }
  }
  world.coins.push({ lane, type, y: -80, t: Math.random() * Math.PI * 2, collected: false });
}

function moveLane(direction) {
  if (state.laneCooldown > 0) return;
  player.targetLane = Math.max(0, Math.min(2, player.targetLane + direction));
  state.laneCooldown = 0.12;
}

function jump() {
  if (Math.abs(player.y - world.groundY) < 4) player.vy = -player.jumpPower;
}

function slide() {
  if (Math.abs(player.y - world.groundY) < 4) player.slidingUntil = state.time + 0.6;
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  keys.add(key);
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) e.preventDefault();
  if (!state.running || state.paused) return;
  if (key === 'arrowleft' || key === 'a') moveLane(-1);
  if (key === 'arrowright' || key === 'd') moveLane(1);
  if (key === 'arrowup' || key === 'w') jump();
  if (key === 'arrowdown' || key === 's') slide();
  if (key === 'p') togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function obstacleRect(obstacle) {
  const x = world.lanes[obstacle.lane] - obstacle.width / 2;
  const y = obstacle.y;
  let h = obstacle.height;
  if (obstacle.kind === 'high') h = 134;
  if (obstacle.kind === 'barrier') h = 106;
  return { x, y, w: obstacle.width, h };
}

function playerRect() {
  const sliding = state.time < player.slidingUntil;
  const h = sliding ? player.height * 0.55 : player.height;
  return { x: player.x - player.width * 0.38, y: player.y - h, w: player.width * 0.76, h };
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function onHit() {
  if (state.time < state.invulnerableUntil) return;
  state.lives -= 1;
  state.invulnerableUntil = state.time + 1.2;
  for (let i = 0; i < 18; i++) {
    world.particles.push({
      x: player.x,
      y: player.y - 60,
      vx: (Math.random() - 0.5) * 240,
      vy: -80 - Math.random() * 160,
      life: 0.45,
      color: '#EF5F17'
    });
  }
  if (state.lives <= 0) finishGame();
}

function collectCoin(coin) {
  if (coin.collected) return;
  coin.collected = true;
  const def = coinDefs[coin.type];
  const mult = state.time < state.multiplierUntil ? 2 : 1;
  state.score += def.value * mult;
  if (def.effect === 'multiplier') state.multiplierUntil = state.time + 5;
  if (def.effect === 'boost') state.boostUntil = state.time + 3.5;
  for (let i = 0; i < 14; i++) {
    world.particles.push({
      x: world.lanes[coin.lane],
      y: coin.y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160,
      life: 0.5,
      color: def.effect === 'boost' ? '#ffd85e' : '#57BEB1'
    });
  }
}

function update(dt) {
  if (!state.running || state.paused || state.gameOver) return;

  state.time += dt;
  state.laneCooldown = Math.max(0, state.laneCooldown - dt);
  state.speed = Math.min(state.speedMax, state.speed + dt * 5.2);
  const activeSpeed = state.time < state.boostUntil ? state.speed * 1.22 : state.speed;

  player.x += (world.lanes[player.targetLane] - player.x) * Math.min(1, dt * 12);
  player.vy += player.gravity * dt;
  player.y += player.vy * dt;
  if (player.y > world.groundY) {
    player.y = world.groundY;
    player.vy = 0;
  }
  player.bounceTime += dt * 9;

  state.distance += activeSpeed * dt * 0.05;
  state.score += dt * 5 + activeSpeed * dt * 0.02;

  state.obstacleTimer -= dt;
  if (state.obstacleTimer <= 0) {
    spawnObstacle();
    state.obstacleTimer = Math.max(0.38, 1.05 - Math.min(0.68, state.distance / 1400));
  }

  state.coinTimer -= dt;
  if (state.coinTimer <= 0) {
    spawnCoin();
    state.coinTimer = 0.52 + Math.random() * 0.4;
  }

  const pRect = playerRect();

  for (const obstacle of world.obstacles) {
    obstacle.y += activeSpeed * dt;
    const oRect = obstacleRect(obstacle);
    if (!obstacle.hit && intersects(pRect, oRect)) {
      const sliding = state.time < player.slidingUntil;
      const jumped = player.y < world.groundY - 48;
      const blocked = (
        obstacle.kind === 'block' ||
        (obstacle.kind === 'low' && !jumped) ||
        (obstacle.kind === 'high' && !sliding) ||
        obstacle.kind === 'barrier'
      );
      if (blocked) {
        obstacle.hit = true;
        onHit();
      }
    }
  }

  for (const coin of world.coins) {
    coin.y += activeSpeed * dt;
    coin.t += dt * 5;
    const cSize = 44;
    const cRect = { x: world.lanes[coin.lane] - cSize / 2, y: coin.y - cSize / 2, w: cSize, h: cSize };
    if (!coin.collected && intersects(pRect, cRect)) collectCoin(coin);
  }

  world.obstacles = world.obstacles.filter((o) => o.y < canvas.height + 160);
  world.coins = world.coins.filter((c) => c.y < canvas.height + 120 && !c.collected);

  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }

  updateHud();
}

function drawBackground(activeSpeed) {
  ctx.fillStyle = '#111318';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of world.stars) {
    star.y += activeSpeed * 0.05 * star.z;
    if (star.y > canvas.height) {
      star.y = -4;
      star.x = Math.random() * canvas.width;
    }
    ctx.fillStyle = `rgba(87,190,177,${0.25 * star.z})`;
    ctx.fillRect(star.x, star.y, star.z * 2.2, star.z * 5.2);
  }

  const laneW = canvas.width * 0.17;
  for (let i = 0; i < 3; i++) {
    const x = world.lanes[i] - laneW / 2;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(87,190,177,0.08)');
    grad.addColorStop(1, 'rgba(87,190,177,0.21)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, laneW, canvas.height);

    ctx.strokeStyle = 'rgba(87,190,177,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, 0, laneW - 4, canvas.height);
  }

  const stripeSpeed = (state.distance * 9) % 80;
  for (let y = -80 + stripeSpeed; y < canvas.height + 80; y += 80) {
    ctx.fillStyle = 'rgba(239,95,23,0.3)';
    ctx.fillRect(canvas.width * 0.16, y, canvas.width * 0.68, 8);
  }
}

function drawCoin(coin) {
  const x = world.lanes[coin.lane];
  const y = coin.y + Math.sin(coin.t) * 6;
  const def = coinDefs[coin.type];
  ctx.save();
  ctx.shadowColor = def.glow;
  ctx.shadowBlur = coin.type === 'token' ? 26 : 14;
  if (def.sprite) {
    const scaleX = 0.72 + Math.sin(coin.t) * 0.2;
    ctx.translate(x, y);
    ctx.scale(scaleX, 1);
    ctx.drawImage(def.sprite, -24, -24, 48, 48);
  } else {
    ctx.fillStyle = coin.type === 'token' ? '#ffd85e' : coin.type === 'wink' ? '#ff9d62' : '#57BEB1';
    ctx.beginPath();
    ctx.arc(x, y, coin.type === 'token' ? 17 : 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawObstacle(obstacle) {
  const r = obstacleRect(obstacle);
  ctx.save();
  if (obstacle.kind === 'low') {
    ctx.fillStyle = '#3b3b3b';
    ctx.fillRect(r.x, r.y + r.h * 0.35, r.w, r.h * 0.65);
    ctx.strokeStyle = '#57BEB1';
    ctx.strokeRect(r.x + 2, r.y + r.h * 0.35 + 2, r.w - 4, r.h * 0.65 - 4);
  } else if (obstacle.kind === 'high') {
    ctx.fillStyle = '#2b4f4a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#57BEB1';
    ctx.fillRect(r.x + 12, r.y + 16, r.w - 24, 15);
  } else if (obstacle.kind === 'barrier') {
    ctx.fillStyle = '#364040';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#EF5F17';
    ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, 14);
  } else {
    ctx.fillStyle = '#252525';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#57BEB1';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  }
  ctx.restore();
}

function drawPlayer() {
  const sliding = state.time < player.slidingUntil;
  const h = sliding ? player.height * 0.6 : player.height;
  const w = player.width;
  const bob = Math.sin(player.bounceTime) * 3;
  const invuln = state.time < state.invulnerableUntil;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.rotate((world.lanes[player.targetLane] - player.x) * 0.0014);
  ctx.globalAlpha = invuln && Math.floor(state.time * 18) % 2 ? 0.45 : 1;

  if (player.sprite) {
    ctx.drawImage(player.sprite, -w / 2, -h, w, h);
  } else {
    ctx.fillStyle = '#EF5F17';
    roundRect(ctx, -w / 2, -h, w, h, 20);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-16, -h + 26, 10, 10);
    ctx.fillRect(6, -h + 26, 10, 10);
  }
  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawParticles() {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawStatus() {
  if (state.time < state.multiplierUntil) {
    ctx.fillStyle = 'rgba(239,95,23,0.9)';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('x2 SCORE', 20, 90);
  }
  if (state.time < state.boostUntil) {
    ctx.fillStyle = 'rgba(255,216,94,0.95)';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('BOOST!', 20, 122);
  }
}

function render() {
  const activeSpeed = state.time < state.boostUntil ? state.speed * 1.22 : state.speed;
  drawBackground(activeSpeed);
  for (const obstacle of world.obstacles) drawObstacle(obstacle);
  for (const coin of world.coins) drawCoin(coin);
  drawPlayer();
  drawParticles();
  drawStatus();

  if (state.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
  }
}

function finishGame() {
  state.running = false;
  state.gameOver = true;
  const final = Math.floor(state.score);
  if (final > state.bestScore) {
    state.bestScore = final;
    localStorage.setItem('sparkieRushBest', String(final));
  }
  ui.finalScore.textContent = String(final);
  ui.finalDistance.textContent = `${Math.floor(state.distance)}m`;
  ui.bestScoreEnd.textContent = String(state.bestScore);
  ui.bestScoreStart.textContent = String(state.bestScore);
  showOverlay('gameover');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

ui.startBtn.addEventListener('click', resetGame);
ui.playAgainBtn.addEventListener('click', resetGame);
ui.pauseBtn.addEventListener('click', togglePause);

loadAssets().then(() => {
  ui.bestScoreStart.textContent = String(state.bestScore);
  requestAnimationFrame(loop);
});
