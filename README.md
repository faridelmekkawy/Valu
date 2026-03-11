# Sparkie Jackpot

Frontend-only slot mini-game built with HTML, CSS, and vanilla JavaScript.

## Routes

- `/` → simple router page
- `/runner/` → **Sparkie Jackpot** game

## Run locally

```bash
python3 -m http.server 8080
```

Open:
- `http://localhost:8080/`
- `http://localhost:8080/runner/`

## Required assets

- `assets/sparkie_player.png`
- `assets/Value-Logo.png`
- `assets/coins/coin_heart.png`
- `assets/coins/coin_wink.png`
- `assets/coins/coin_token.png`
- `assets/coins/coin_card.png`

If assets fail to load, fallback placeholders are rendered so the game keeps running.

## Customization

- Symbol odds: `runner/game.js` → `SYMBOLS` weights.
- Scoring logic: `runner/game.js` → `evaluate()`.
- Reel speed/feel: `runner/game.js` → `rollReel()` duration and easing.
- UI look: `runner/style.css`.
