(() => {
  const BRAND = {
    orange: '#EF5F17',
    teal: '#57BEB1'
  };

  const SYMBOLS = [
    { id: 'heart', src: 'assets/coins/coin_heart.png', weight: 0.34 },
    { id: 'wink', src: 'assets/coins/coin_wink.png', weight: 0.3 },
    { id: 'token', src: 'assets/coins/coin_token.png', weight: 0.28 },
    { id: 'card', src: 'assets/coins/coin_card.png', weight: 0.08, premium: true }
  ];

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
  const slotMachine = document.getElementById('slotMachine');

  const reelEls = Array.from(document.querySelectorAll('.reel'));
  const symbolHolders = reelEls.map((reel) => reel.querySelector('.symbol-shell'));

  let playerName = '';
  let totalScore = 0;
  let spinCount = 0;
  let spinning = false;
  let currentResult = ['heart', 'wink', 'token'];

  const BEST_SCORE_KEY = 'sparkie-jackpot-best-score';
  const bestStored = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
  bestScoreView.textContent = String(bestStored);

  setupAssetFallback(document.getElementById('startLogo'), 'assets/Value-Logo.png', true);
  setupAssetFallback(document.getElementById('gameLogo'), 'assets/Value-Logo.png', true);
  setupAssetFallback(document.getElementById('sparkieDecor'), '', false);

  startBtn.addEventListener('click', handleStart);
  spinBtn.addEventListener('click', runSpin);
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleStart();
  });

  window.addEventListener('keydown', (event) => {
    if (!gameScreen.classList.contains('active')) return;
    if ((event.code === 'Space' || event.key === 'Enter') && !spinning) {
      event.preventDefault();
      runSpin();
    }
  });

  initializeReels();

  function handleStart() {
    const value = nameInput.value.trim();
    playerName = value || 'Player';
    playerNameView.textContent = playerName;

    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    resultMessage.textContent = 'Press SPIN and chase the jackpot!';
  }

  function initializeReels() {
    reelEls.forEach((_, index) => setReelSymbol(index, weightedSymbol().id));
  }

  async function runSpin() {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    clearWinClasses();
    resultMessage.textContent = 'Spinning...';

    const finalSymbols = [weightedSymbol().id, weightedSymbol().id, weightedSymbol().id];
    currentResult = finalSymbols;

    const spinPromises = reelEls.map((_, index) => spinReel(index, finalSymbols[index], 800 + index * 320));
    await Promise.all(spinPromises);

    const outcome = evaluateResult(finalSymbols);
    totalScore += outcome.points;
    spinCount += 1;
    totalScoreView.textContent = String(totalScore);
    spinCountView.textContent = String(spinCount);

    highlightMatches(outcome, finalSymbols);
    showOutcomeMessage(outcome);
    triggerOverlay(outcome);

    if (totalScore > Number(bestScoreView.textContent)) {
      bestScoreView.textContent = String(totalScore);
      localStorage.setItem(BEST_SCORE_KEY, String(totalScore));
    }

    spinning = false;
    spinBtn.disabled = false;
  }

  function spinReel(reelIndex, finalSymbol, durationMs) {
    const reel = reelEls[reelIndex];
    reel.classList.add('spinning');

    return new Promise((resolve) => {
      const start = performance.now();
      const timer = setInterval(() => {
        setReelSymbol(reelIndex, weightedSymbol().id);
        if (performance.now() - start >= durationMs) {
          clearInterval(timer);
          setReelSymbol(reelIndex, finalSymbol);
          reel.classList.remove('spinning');
          resolve();
        }
      }, 90);
    });
  }

  function setReelSymbol(reelIndex, symbolId) {
    const symbol = SYMBOLS.find((entry) => entry.id === symbolId);
    const holder = symbolHolders[reelIndex];
    holder.innerHTML = '';

    const img = document.createElement('img');
    img.className = 'symbol-img';
    img.src = symbol.src;
    img.alt = symbol.id;
    img.loading = 'eager';

    img.onerror = () => {
      if (img.parentNode) img.remove();
      holder.appendChild(createFallbackSymbol(symbol));
    };

    holder.appendChild(img);

    if (symbol.premium) {
      holder.style.boxShadow = '0 0 22px rgba(255,209,102,0.7)';
    } else {
      holder.style.boxShadow = `0 0 16px ${BRAND.teal}66`;
    }
  }

  function createFallbackSymbol(symbol) {
    const fallback = document.createElement('div');
    fallback.className = 'symbol-fallback';
    fallback.style.background = symbol.premium
      ? 'linear-gradient(180deg,#ffe39f,#d3a83d)'
      : `linear-gradient(180deg,#8af4e6,${BRAND.teal})`;
    return fallback;
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

  // Scoring logic for 3 reels:
  // - JACKPOT(100): all 3 match
  // - BIG MATCH(60): exactly one matching adjacent pair (0-1 or 1-2)
  // - MATCH(20): exactly one non-adjacent pair (0-2)
  // - MISS(0): no matches
  function evaluateResult([a, b, c]) {
    if (a === b && b === c) {
      if (a === 'card') return { label: 'SUPER JACKPOT', points: 100, jackpot: true, super: true };
      return { label: 'JACKPOT', points: 100, jackpot: true };
    }

    if (a === b || b === c) return { label: 'BIG MATCH', points: 60, pair: true, reels: a === b ? [0, 1] : [1, 2] };
    if (a === c) return { label: 'MATCH', points: 20, pair: true, reels: [0, 2] };
    return { label: 'MISS', points: 0 };
  }

  function showOutcomeMessage(outcome) {
    const gained = `+${outcome.points}`;
    resultMessage.textContent = `${outcome.label} ${gained}`;
    resultMessage.style.color = outcome.points > 0 ? '#ffd166' : '#f1f1f1';
  }

  function clearWinClasses() {
    reelEls.forEach((reel) => reel.classList.remove('win', 'super'));
    gameScreen.classList.remove('jackpot');
  }

  function highlightMatches(outcome, symbols) {
    if (outcome.jackpot) {
      reelEls.forEach((reel) => reel.classList.add(outcome.super ? 'super' : 'win'));
      gameScreen.classList.add('jackpot');
      return;
    }

    if (outcome.reels) {
      outcome.reels.forEach((index) => reelEls[index].classList.add('win'));
      return;
    }

    // Tiny premium hint if card appears even on miss.
    symbols.forEach((symbol, idx) => {
      if (symbol === 'card') reelEls[idx].classList.add('super');
    });
  }

  function triggerOverlay(outcome) {
    overlayText.textContent = `${outcome.points > 0 ? `+${outcome.points}` : 'MISS'}${outcome.jackpot ? ` ${outcome.label}` : ''}`;
    resultOverlay.classList.remove('show');
    void resultOverlay.offsetWidth;
    resultOverlay.classList.add('show');
    resultOverlay.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      resultOverlay.setAttribute('aria-hidden', 'true');
    }, 1000);
  }

  function setupAssetFallback(imgEl, secondarySrc, useCircleFallback) {
    if (!imgEl) return;

    let attemptedSecondary = false;
    imgEl.addEventListener('error', () => {
      if (!attemptedSecondary && secondarySrc) {
        attemptedSecondary = true;
        imgEl.src = secondarySrc;
        return;
      }
      const fallback = document.createElement('div');
      fallback.className = useCircleFallback ? 'symbol-fallback' : '';
      fallback.style.width = useCircleFallback ? '74px' : '96px';
      fallback.style.height = useCircleFallback ? '74px' : '96px';
      fallback.style.margin = '0 auto';
      fallback.style.borderRadius = useCircleFallback ? '50%' : '20px';
      fallback.style.background = `linear-gradient(180deg, ${BRAND.teal}, ${BRAND.orange})`;
      fallback.style.boxShadow = '0 0 16px rgba(87,190,177,0.4)';
      fallback.setAttribute('aria-label', 'Image placeholder');
      imgEl.replaceWith(fallback);
    });
  }
})();
