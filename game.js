const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreValue = document.getElementById('scoreValue');
const timerValue = document.getElementById('timerValue');
const livesValue = document.getElementById('livesValue');
const nameValue = document.getElementById('nameValue');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const gameWrap = document.getElementById('gameWrap');
const playerNameInput = document.getElementById('playerName');
const finalName = document.getElementById('finalName');
const finalScore = document.getElementById('finalScore');
const submitStatus = document.getElementById('submitStatus');
const leaderboardEl = document.getElementById('leaderboard');

const tileSize = 32;
const mazeCols = canvas.width / tileSize;
const mazeRows = canvas.height / tileSize;

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
  heart: { value: 10, rate: 0.65, speedBoost: 0, img: 'assets/coins/coin_heart.png' },
  wink: { value: 30, rate: 0.28, speedBoost: 3.5, img: 'assets/coins/coin_wink.png' },
  token: { value: 100, rate: 0.07, speedBoost: 0, img: 'assets/coins/coin_token.png' }
};

const assets = {
  player: loadImage('assets/sparkie_player.png'),
  logo: loadImage('assets/Value-Logo.png'),
  coins: {
    heart: loadImage(coinDefs.heart.img),
    wink: loadImage(coinDefs.wink.img),
    token: loadImage(coinDefs.token.img)
  }
};

const keys = new Set();
let gameState = 'menu';
let gameStartTime = 0;
let lastFrame = 0;
let remainingTime = 90;
let score = 0;
let lives = 3;
let playerName = 'Player';
let speedBoostUntil = 0;

const particles = [];
const coins = [];
const enemies = [];

const player = {
  x: tileSize * 1.5,
  y: tileSize * 1.5,
  r: tileSize * 0.38,
  vx: 0,
  vy: 0,
  angle: 0,
  invulnerableUntil: 0
};

const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME'
};

let db = null;
let firestoreAvailable = false;

async function initFirebase() {
  try {
    if (Object.values(firebaseConfig).includes('REPLACE_ME')) return;
    const [{ initializeApp }, { getFirestore, collection, addDoc, query, orderBy, limit, getDocs }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    const app = initializeApp(firebaseConfig);
    db = {
      ref: getFirestore(app),
      collection,
      addDoc,
      query,
      orderBy,
      limit,
      getDocs
    };
    firestoreAvailable = true;
  } catch (err) {
    console.warn('Firestore unavailable, leaderboard fallback enabled.', err);
  }
}

function loadImage(src) {
  const img = new Image();
  let ok = false;
  img.onload = () => { ok = true; };
  img.onerror = () => { ok = false; };
  img.src = src;
  return {
    img,
    loaded: () => ok
  };
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

function randomOpenPosition() {
  while (true) {
    const col = Math.floor(Math.random() * mazeCols);
    const row = Math.floor(Math.random() * mazeRows);
    if (!isWall(col, row)) {
      return {
        x: col * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2
      };
    }
  }
}

function spawnCoin() {
  if (coins.length > 18) return;
  const pick = Math.random();
  const type = pick < coinDefs.heart.rate ? 'heart' : pick < coinDefs.heart.rate + coinDefs.wink.rate ? 'wink' : 'token';
  const pos = randomOpenPosition();
  coins.push({ type, x: pos.x, y: pos.y, t: Math.random() * Math.PI * 2 });
}

function spawnEnemy() {
  const pos = randomOpenPosition();
  enemies.push({
    x: pos.x,
    y: pos.y,
    r: tileSize * 0.34,
    vx: 0,
    vy: 0,
    speed: 70 + Math.random() * 35,
    turnAt: 0,
    style: Math.random() > 0.5 ? 'blob' : 'spark'
  });
}

function resetGame() {
  score = 0;
  lives = 3;
  remainingTime = 90;
  speedBoostUntil = 0;
  particles.length = 0;
  coins.length = 0;
  enemies.length = 0;

  const startPos = randomOpenPosition();
  player.x = startPos.x;
  player.y = startPos.y;
  player.vx = 0;
  player.vy = 0;
  player.angle = 0;
  player.invulnerableUntil = 0;

  for (let i = 0; i < 12; i++) spawnCoin();
  for (let i = 0; i < 5; i++) spawnEnemy();

  updateHud();
}

function updateHud() {
  scoreValue.textContent = String(score);
  timerValue.textContent = String(Math.max(0, Math.ceil(remainingTime)));
  livesValue.textContent = String(lives);
  nameValue.textContent = playerName;
}

function collectCoin(index) {
  const coin = coins[index];
  score += coinDefs[coin.type].value;
  if (coin.type === 'wink') speedBoostUntil = performance.now() + 4500;
  const color = coin.type === 'token' ? '#ef5f17' : '#57beb1';
  for (let i = 0; i < 12; i++) {
    particles.push({ x: coin.x, y: coin.y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, life: 0.6, color });
  }
  coins.splice(index, 1);
  spawnCoin();
}

function updatePlayer(dt, now) {
  const speed = now < speedBoostUntil ? 220 : 170;
  let dx = 0;
  let dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) dy += 1;

  const len = Math.hypot(dx, dy) || 1;
  player.vx = (dx / len) * speed;
  player.vy = (dy / len) * speed;

  const nextX = player.x + player.vx * dt;
  const nextY = player.y + player.vy * dt;

  if (!hitWallCircle(nextX, player.y, player.r)) player.x = nextX;
  if (!hitWallCircle(player.x, nextY, player.r)) player.y = nextY;

  if (dx || dy) player.angle = Math.atan2(dy, dx);

  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (Math.hypot(player.x - c.x, player.y - c.y) < player.r + tileSize * 0.28) collectCoin(i);
  }

  if (now > player.invulnerableUntil) {
    enemies.forEach((e) => {
      if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r) {
        lives -= 1;
        player.invulnerableUntil = now + 2000;
        const p = randomOpenPosition();
        player.x = p.x;
        player.y = p.y;
      }
    });
  }
}

function updateEnemies(dt, now) {
  for (const e of enemies) {
    if (now > e.turnAt || (Math.abs(e.vx) < 1 && Math.abs(e.vy) < 1)) {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
      for (const [dx, dy] of dirs) {
        if (!hitWallCircle(e.x + dx * tileSize * 0.7, e.y + dy * tileSize * 0.7, e.r)) {
          e.vx = dx * e.speed;
          e.vy = dy * e.speed;
          e.turnAt = now + 600 + Math.random() * 1100;
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

function drawMaze() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < mazeRows; row++) {
    for (let col = 0; col < mazeCols; col++) {
      if (mazeLayout[row][col] === '1') {
        const x = col * tileSize;
        const y = row * tileSize;
        ctx.fillStyle = '#1d3e3a';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = 'rgba(87,190,177,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1.5, y + 1.5, tileSize - 3, tileSize - 3);
      }
    }
  }
}

function drawCoins(now) {
  for (const c of coins) {
    const pulse = 1 + Math.sin(now / 260 + c.t) * 0.06;
    const bob = Math.sin(now / 310 + c.t) * 3;
    const size = tileSize * (c.type === 'token' ? 0.62 : 0.52) * pulse;

    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.rotate(now / 950 + c.t);
    const img = assets.coins[c.type];
    if (img.loaded()) {
      ctx.shadowBlur = c.type === 'token' ? 18 : 9;
      ctx.shadowColor = c.type === 'token' ? '#ef5f17' : '#57beb1';
      ctx.drawImage(img.img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = c.type === 'token' ? '#ef5f17' : '#57beb1';
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawEnemies(now) {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.style === 'blob') {
      ctx.fillStyle = '#2a2a2a';
      ctx.shadowColor = '#57beb1';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + Math.sin(now / 210) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#57beb1';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#57beb1';
      ctx.shadowBlur = 10;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(e.r + 4, 0);
        ctx.stroke();
      }
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer(now) {
  const bounce = Math.sin(now / 120) * 2;
  const invulnerable = now < player.invulnerableUntil;

  ctx.save();
  ctx.translate(player.x, player.y + bounce);
  ctx.rotate(player.angle * 0.2);
  ctx.globalAlpha = invulnerable ? 0.55 + Math.sin(now / 80) * 0.25 : 1;

  const size = tileSize * 0.95;
  if (assets.player.loaded()) {
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
    ctx.arc(0, 0, player.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function tick(ts) {
  if (gameState !== 'playing') return;
  const now = ts;
  const dt = Math.min(0.033, (ts - lastFrame) / 1000);
  lastFrame = ts;

  remainingTime = 90 - (now - gameStartTime) / 1000;
  if (remainingTime <= 0 || lives <= 0) {
    endGame();
    return;
  }

  if (Math.random() < 0.02) spawnCoin();

  updatePlayer(dt, now);
  updateEnemies(dt, now);
  updateParticles(dt);
  updateHud();

  drawMaze();
  drawCoins(now);
  drawEnemies(now);
  drawPlayer(now);
  drawParticles();

  requestAnimationFrame(tick);
}

function startGame() {
  playerName = playerNameInput.value.trim() || 'Player';
  nameValue.textContent = playerName;
  submitStatus.textContent = '';
  leaderboardEl.innerHTML = '';
  resetGame();

  startScreen.classList.remove('active');
  gameOverScreen.classList.remove('active');
  gameWrap.style.visibility = 'visible';

  gameState = 'playing';
  gameStartTime = performance.now();
  lastFrame = gameStartTime;
  requestAnimationFrame(tick);
}

async function submitScore() {
  if (!score) return;
  submitStatus.textContent = 'Submitting...';
  try {
    if (firestoreAvailable) {
      const payload = { name: playerName, score, createdAt: Date.now() };
      await db.addDoc(db.collection(db.ref, 'sparkie_dash_scores'), payload);
    } else {
      const local = JSON.parse(localStorage.getItem('sparkie_dash_scores') || '[]');
      local.push({ name: playerName, score, createdAt: Date.now() });
      localStorage.setItem('sparkie_dash_scores', JSON.stringify(local));
    }
    submitStatus.textContent = 'Score submitted!';
    await loadLeaderboard();
  } catch (err) {
    submitStatus.textContent = 'Could not submit score.';
  }
}

async function loadLeaderboard() {
  let scores = [];
  if (firestoreAvailable) {
    const q = db.query(db.collection(db.ref, 'sparkie_dash_scores'), db.orderBy('score', 'desc'), db.limit(7));
    const snap = await db.getDocs(q);
    scores = snap.docs.map((d) => d.data());
  } else {
    scores = JSON.parse(localStorage.getItem('sparkie_dash_scores') || '[]')
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);
  }

  leaderboardEl.innerHTML = '';
  scores.forEach((s) => {
    const li = document.createElement('li');
    li.textContent = `${s.name} — ${s.score}`;
    leaderboardEl.appendChild(li);
  });
}

function endGame() {
  gameState = 'over';
  gameWrap.style.visibility = 'hidden';
  finalName.textContent = playerName;
  finalScore.textContent = String(score);
  gameOverScreen.classList.add('active');
  loadLeaderboard().catch(() => {});
}

document.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys.add(key);
});

document.addEventListener('keyup', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys.delete(key);
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', () => {
  gameOverScreen.classList.remove('active');
  startScreen.classList.add('active');
  gameWrap.style.visibility = 'hidden';
});
document.getElementById('submitScoreBtn').addEventListener('click', submitScore);

initFirebase();
loadLeaderboard().catch(() => {});
