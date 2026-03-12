# Sparkie Rush (`/runner`)

## Local run
1. From repo root: `python3 -m http.server 4173`
2. Open: `http://localhost:4173/runner/`

## Required assets
Place assets in these paths:
- `assets/sparkie_player.png`
- `assets/Value-Logo.png`
- `assets/coins/coin_heart.png`
- `assets/coins/coin_wink.png`
- `assets/coins/coin_token.png`

Start screen logo uses `assets/sparkie_logo.png` if present and falls back safely if missing.

## Replace assets later
Update the `ASSET_PATHS` object in `runner/game.js`.
