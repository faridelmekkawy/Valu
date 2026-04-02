(() => {
  const SYMBOLS = [
    { key: 'heart', path: '../assets/coins/coin_heart.png', weight: 0.33 },
    { key: 'wink', path: '../assets/coins/coin_wink.png', weight: 0.3 },
    { key: 'token', path: '../assets/coins/coin_token.png', weight: 0.29 },
    { key: 'card', path: '../assets/coins/coin_card.png', weight: 0.08 },
  ];

  const SCORING = { MISS: 0, MATCH: 20, BIG_MATCH: 60, JACKPOT: 100 };

  const startScreen = document.getElementById('startScreen');
  const gameScreen = document.getElementById('gameScreen');
  const startBtn = document.getElementById('startBtn');
  const spinBtn = document.getElementById('spinBtn');
  const playerNameInput = document.getElementById('playerName');
  const playerLabel = document.getElementById('playerLabel');
  const scoreLabel = document.getElementById('scoreLabel');
  const bestLabel = document.getElementById('bestLabel');
  const spinsLabel = document.getElementById('spinsLabel');
  const resultMsg = document.getElementById('resultMsg');
  const overlay = document.getElementById('resultOverlay');
  const overlayText = document.getElementById('overlayText');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const machineCabinet = document.getElementById('machineCabinet');
  const winBanner = document.getElementById('winBanner');
  const reels = [...document.querySelectorAll('.reel')];

  const bestStorageKey = 'sparkie_jackpot_best';
  let totalScore = 0;
  let spins = 0;
  let spinning = false;
  let particles = [];

  bestLabel.textContent = String(Number(localStorage.getItem(bestStorageKey) || 0));

  function setImageOrFallback(img, symbolKey) {
    const symbol = SYMBOLS.find((s) => s.key === symbolKey) || SYMBOLS[0];
    img.onerror = () => {
      const holder = document.createElement('div');
      holder.className = 'fallback-symbol';
      img.replaceWith(holder);
    };
    img.src = symbol.path;
    img.alt = `${symbol.key} symbol`;
  }

  function pickWeightedSymbol() {
    const roll = Math.random();
    let sum = 0;
    for (const symbol of SYMBOLS) {
      sum += symbol.weight;
      if (roll <= sum) return symbol;
    }
    return SYMBOLS[0];
  }

  function createReelSymbol(reelEl, key) {
    const oldVisual = reelEl.querySelector('.reel-symbol, .fallback-symbol');
    if (oldVisual) oldVisual.remove();
    const img = document.createElement('img');
    img.className = 'reel-symbol';
    setImageOrFallback(img, key);
    reelEl.appendChild(img);
  }

  function updateHud() {
    scoreLabel.textContent = String(totalScore);
    spinsLabel.textContent = String(spins);
    bestLabel.textContent = String(Math.max(totalScore, Number(localStorage.getItem(bestStorageKey) || 0)));
  }

  function showOverlay(text, color = '#fff') {
    overlayText.textContent = text;
    overlayText.style.color = color;
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 850);
  }

  function clearReelStyles() {
    reels.forEach((reel) => reel.classList.remove('match', 'premium'));
    resultMsg.classList.remove('jackpot');
    winBanner.classList.remove('jackpot');
    machineCabinet.classList.remove('jackpot-pulse');
  }

  function evaluateSpin(keys) {
    const counts = keys.reduce((acc, key) => {
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const maxCount = Math.max(...Object.values(counts));

    if (maxCount === 3) {
      const isSuper = keys.every((k) => k === 'card');
      return {
        points: SCORING.JACKPOT,
        label: isSuper ? 'SUPER JACKPOT +100' : 'JACKPOT +100',
        tone: '#f4c469',
        level: 'jackpot',
      };
    }

    if (maxCount === 2) {
      const pairSymbol = Object.keys(counts).find((k) => counts[k] === 2);
      const middleMatch = keys[1] === pairSymbol;
      return {
        points: middleMatch ? SCORING.BIG_MATCH : SCORING.MATCH,
        label: middleMatch ? 'BIG MATCH +60' : 'MATCH +20',
        tone: middleMatch ? '#57BEB1' : '#ffe7bf',
        level: middleMatch ? 'big' : 'match',
      };
    }

    return { points: SCORING.MISS, label: 'MISS +0', tone: '#f0f0f0', level: 'miss' };
  }

  function markWinningReels(keys, level) {
    if (level === 'miss') return;
    const counts = keys.reduce((acc, key) => {
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const winner = Object.keys(counts).find((k) => counts[k] > 1) || keys[0];
    reels.forEach((reel, index) => {
      if (keys[index] === winner) {
        reel.classList.add('match');
        if (winner === 'card') reel.classList.add('premium');
      }
    });

    if (level === 'jackpot') {
      reels.forEach((reel) => reel.classList.add('match'));
      resultMsg.classList.add('jackpot');
      winBanner.classList.add('jackpot');
      machineCabinet.classList.add('jackpot-pulse');
      setTimeout(() => machineCabinet.classList.remove('jackpot-pulse'), 1800);
    }
  }

  function saveBestScore() {
    const best = Number(localStorage.getItem(bestStorageKey) || 0);
    if (totalScore > best) localStorage.setItem(bestStorageKey, String(totalScore));
  }

  function spawnConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    const colors = ['#EF5F17', '#57BEB1', '#f4c469', '#ffffff'];
    particles = Array.from({ length: 130 }, () => ({
      x: confettiCanvas.width / 2,
      y: confettiCanvas.height * 0.33,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 2,
      life: 70 + Math.random() * 40,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    function frame() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.14;
        p.life -= 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 6, 10);
      });
      particles = particles.filter((p) => p.life > 0);
      if (particles.length) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  async function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    clearReelStyles();
    winBanner.textContent = 'SPINNING...';
    resultMsg.textContent = 'Spinning...';

    const finalSymbols = reels.map(() => pickWeightedSymbol());

    for (let i = 0; i < reels.length; i++) {
      const reel = reels[i];
      reel.classList.add('spinning');
      await new Promise((resolve) => {
        const spinInterval = setInterval(() => {
          const random = pickWeightedSymbol();
          createReelSymbol(reel, random.key);
        }, 80);

        setTimeout(() => {
          clearInterval(spinInterval);
          createReelSymbol(reel, finalSymbols[i].key);
          reel.classList.remove('spinning');
          resolve();
        }, 740 + i * 340);
      });
    }

    const reelResults = finalSymbols.map((s) => s.key);
    const result = evaluateSpin(reelResults);

    totalScore += result.points;
    spins += 1;
    saveBestScore();
    updateHud();
    markWinningReels(reelResults, result.level);

    resultMsg.textContent = result.label;
    winBanner.textContent = result.level === 'miss' ? 'TRY AGAIN' : result.label;
    showOverlay(`+${result.points}`, result.tone);
    if (result.level === 'jackpot') spawnConfetti();

    spinning = false;
    spinBtn.disabled = false;
  }

  function startGame() {
    const typed = playerNameInput.value.trim();
    playerLabel.textContent = typed || 'Player';

    startScreen.classList.remove('active');
    gameScreen.classList.add('active');

    totalScore = 0;
    spins = 0;
    updateHud();
    winBanner.textContent = 'SPARKIE JACKPOT';
    resultMsg.textContent = 'Press SPIN to play!';
    reels.forEach((reel) => createReelSymbol(reel, pickWeightedSymbol().key));
  }

  function enableImageFallback(imgId) {
    const el = document.getElementById(imgId);
    if (!el) return;
    el.onerror = () => {
      const fallback = document.createElement('div');
      fallback.className = 'fallback-symbol';
      fallback.style.width = imgId.includes('Logo') ? '210px' : '120px';
      fallback.style.height = imgId.includes('Logo') ? '68px' : '120px';
      el.replaceWith(fallback);
    };
  }

  ['startLogo', 'gameLogo', 'sparkieMascot'].forEach(enableImageFallback);

  startBtn.addEventListener('click', startGame);
  playerNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') startGame();
  });
  spinBtn.addEventListener('click', spin);

  document.addEventListener('keydown', (event) => {
    if (!gameScreen.classList.contains('active')) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      spin();
    }
  });
})();
