(() => {
  const SYMBOLS = [
    { id: 'heart', src: '../assets/coins/coin_heart.png', weight: 0.34 },
    { id: 'wink', src: '../assets/coins/coin_wink.png', weight: 0.3 },
    { id: 'token', src: '../assets/coins/coin_token.png', weight: 0.28 },
    { id: 'card', src: '../assets/coins/coin_card.png', weight: 0.08, premium: true }
  ];

  const BEST_SCORE_KEY = 'sparkie-jackpot-best-score';
  const CELL_HEIGHT = 110;

  const startScreen = document.getElementById('startScreen');
  const gameScreen = document.getElementById('gameScreen');
  const startBtn = document.getElementById('startBtn');
  const spinBtn = document.getElementById('spinBtn');
  const nameInput = document.getElementById('playerNameInput');
  const playerNameView = document.getElementById('playerNameView');
  const totalScoreView = document.getElementById('totalScoreView');
  const bestScoreView = document.getElementById('bestScoreView');
  const spinCountView = document.getElementById('spinCountView');
  const resultMessage = document.getElementById('resultMessage');
  const resultOverlay = document.getElementById('resultOverlay');
  const overlayText = document.getElementById('overlayText');

  const reels = Array.from(document.querySelectorAll('.reel'));
  const tracks = reels.map((reel) => reel.querySelector('.reel-track'));

  let totalScore = 0;
  let spinCount = 0;
  let spinning = false;

  bestScoreView.textContent = String(Number(localStorage.getItem(BEST_SCORE_KEY) || 0));

  setupAssetFallback(document.getElementById('startLogo'));
  setupAssetFallback(document.getElementById('gameLogo'));
  setupAssetFallback(document.getElementById('sparkieDecor'));
  setupAssetFallback(document.getElementById('startSparkie'));

  initializeReels();

  startBtn.addEventListener('click', startGame);
  spinBtn.addEventListener('click', spin);

  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') startGame();
  });

  window.addEventListener('keydown', (event) => {
    if (!gameScreen.classList.contains('active')) return;
    if ((event.code === 'Space' || event.key === 'Enter') && !spinning) {
      event.preventDefault();
      spin();
    }
  });

  function startGame() {
    const player = nameInput.value.trim() || 'Player';
    playerNameView.textContent = player;
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    resultMessage.textContent = 'SPIN to test your luck!';
  }

  function initializeReels() {
    reels.forEach((_, i) => setReelStatic(i, weightedSymbol().id));
  }

  async function spin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    clearHighlights();
    resultMessage.textContent = 'Rolling...';

    const finalIds = [weightedSymbol().id, weightedSymbol().id, weightedSymbol().id];
    await Promise.all(reels.map((_, i) => rollReel(i, finalIds[i], 1200 + i * 450)));

    const result = evaluate(finalIds);
    totalScore += result.points;
    spinCount += 1;

    totalScoreView.textContent = String(totalScore);
    spinCountView.textContent = String(spinCount);

    highlight(result, finalIds);
    showResult(result);
    showOverlay(result);

    if (totalScore > Number(bestScoreView.textContent)) {
      bestScoreView.textContent = String(totalScore);
      localStorage.setItem(BEST_SCORE_KEY, String(totalScore));
    }

    spinning = false;
    spinBtn.disabled = false;
  }

  function rollReel(index, finalId, duration) {
    const reel = reels[index];
    const track = tracks[index];
    reel.classList.add('rolling');

    const cycle = 14;
    const queue = Array.from({ length: cycle }, () => weightedSymbol().id);
    queue.push(finalId);
    queue.push(weightedSymbol().id);

    fillTrack(track, queue);

    const targetOffset = -CELL_HEIGHT * (queue.length - 2);

    return new Promise((resolve) => {
      const start = performance.now();
      function animate(now) {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / duration);
        const easeOut = 1 - Math.pow(1 - t, 3);
        track.style.transform = `translateY(${targetOffset * easeOut}px)`;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          reel.classList.remove('rolling');
          setReelStatic(index, finalId);
          resolve();
        }
      }
      requestAnimationFrame(animate);
    });
  }

  function setReelStatic(index, symbolId) {
    const track = tracks[index];
    fillTrack(track, [weightedSymbol().id, symbolId, weightedSymbol().id]);
    track.style.transform = `translateY(${-CELL_HEIGHT}px)`;
  }

  function fillTrack(track, symbolIds) {
    track.innerHTML = '';
    symbolIds.forEach((id) => {
      const symbol = SYMBOLS.find((s) => s.id === id) || SYMBOLS[0];
      const cell = document.createElement('div');
      cell.className = 'symbol-cell';

      const badge = document.createElement('div');
      badge.className = `symbol-badge ${symbol.premium ? 'premium' : ''}`;
      const img = document.createElement('img');
      img.src = symbol.src;
      img.alt = symbol.id;
      img.onerror = () => {
        if (img.parentNode) img.remove();
        const fallback = document.createElement('div');
        fallback.className = 'symbol-fallback';
        fallback.style.background = symbol.premium
          ? 'linear-gradient(180deg,#ffe39f,#d3a83d)'
          : 'linear-gradient(180deg,#89f7e6,#57BEB1)';
        badge.appendChild(fallback);
      };

      badge.appendChild(img);
      cell.appendChild(badge);
      track.appendChild(cell);
    });
  }

  function weightedSymbol() {
    const roll = Math.random();
    let sum = 0;
    for (const symbol of SYMBOLS) {
      sum += symbol.weight;
      if (roll <= sum) return symbol;
    }
    return SYMBOLS[0];
  }

  function evaluate([a, b, c]) {
    if (a === b && b === c) {
      if (a === 'card') return { label: 'SUPER JACKPOT', points: 100, jackpot: true, super: true };
      return { label: 'JACKPOT', points: 100, jackpot: true };
    }

    if (a === b || b === c) return { label: 'BIG MATCH', points: 60, reels: a === b ? [0, 1] : [1, 2] };
    if (a === c) return { label: 'MATCH', points: 20, reels: [0, 2] };
    return { label: 'MISS', points: 0 };
  }

  function clearHighlights() {
    reels.forEach((reel) => reel.classList.remove('win', 'super'));
    gameScreen.classList.remove('jackpot');
  }

  function highlight(result, symbols) {
    if (result.jackpot) {
      reels.forEach((reel) => reel.classList.add(result.super ? 'super' : 'win'));
      gameScreen.classList.add('jackpot');
      return;
    }

    if (result.reels) {
      result.reels.forEach((i) => reels[i].classList.add('win'));
      return;
    }

    symbols.forEach((symbol, index) => {
      if (symbol === 'card') reels[index].classList.add('super');
    });
  }

  function showResult(result) {
    resultMessage.textContent = `${result.label} +${result.points}`;
    resultMessage.style.color = result.points ? '#FFD166' : '#f0f0f0';
  }

  function showOverlay(result) {
    overlayText.textContent = result.points > 0 ? `+${result.points} ${result.label}` : 'MISS';
    resultOverlay.classList.remove('show');
    void resultOverlay.offsetWidth;
    resultOverlay.classList.add('show');
    resultOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => resultOverlay.setAttribute('aria-hidden', 'true'), 1000);
  }

  function setupAssetFallback(img) {
    if (!img) return;
    img.addEventListener('error', () => {
      const fallback = document.createElement('div');
      fallback.style.width = '96px';
      fallback.style.height = '96px';
      fallback.style.margin = '0 auto';
      fallback.style.borderRadius = '20px';
      fallback.style.background = 'linear-gradient(180deg,#57BEB1,#EF5F17)';
      fallback.style.boxShadow = '0 0 14px rgba(87,190,177,.45)';
      fallback.setAttribute('aria-label', 'Image placeholder');
      img.replaceWith(fallback);
    });
  }
})();
