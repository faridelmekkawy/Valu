# Sparkie Jackpot (`/runner` route)

Frontend-only mini-game built with HTML, CSS, and vanilla JavaScript.

## Project structure

- Route page: `runner/index.html`
- Styles: `runner/style.css`
- Logic: `runner/game.js`
- Assets folder (provided): `assets/...`

## Run locally

1. From repo root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open:
   - `http://localhost:8080/runner/` (route page)

## Required assets

Keep these exact files/paths:

- `assets/sparkie_player.png`
- `assets/Value-Logo.png`
- `assets/coins/coin_heart.png`
- `assets/coins/coin_wink.png`
- `assets/coins/coin_token.png`
- `assets/coins/coin_card.png`

If any image is missing, the game auto-renders fallback placeholder shapes.

## Integration notes

To integrate in an existing routed app:

- Mount this page at `/runner`.
- Keep the relative asset paths or update symbol/logo path constants in `runner/game.js`.
- Copy `runner/index.html`, `runner/style.css`, and `runner/game.js` into your route/page component structure.

## Tuning gameplay later

In `runner/game.js`:

- **Scoring rules**: edit `SCORING` and `evaluateSpin()`.
- **Symbol odds**: edit each symbol `weight` in `SYMBOLS` (lower `card` keeps it rarer).
- **Reel speed/timing**: edit spin intervals and stop delays in `spin()` (`85`, `760`, `340`).
- **Jackpot feedback**: edit `spawnConfetti()` and messages in `evaluateSpin()`.

## Replace assets later

Replace files in `assets/` with the same names to avoid code changes, or update paths in `runner/game.js` and `runner/index.html`.
