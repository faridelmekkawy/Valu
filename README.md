# Sparkie Dash: Perfect Stop

A fast timing mini-game built with **HTML, CSS, and vanilla JavaScript**.

## Route

- Main mini-game page: `/stop`
- Static hosting path in this repo: `stop/index.html`

## Run locally

1. Start a static server from repository root:
   ```bash
   python3 -m http.server 8080
   ```
2. Open:
   - `http://localhost:8080/stop/`

## Required assets

Place these assets exactly at:

- `assets/sparkie_player.png`
- `assets/Value-Logo.png`
- `assets/coins/coin_heart.png`
- `assets/coins/coin_wink.png`
- `assets/coins/coin_token.png`
- `assets/sparkie_logo.png` (used on start screen, optional fallback supported)

If an asset is missing, the game shows styled fallback shapes and continues running.

## Tuning gameplay later

Open `stop/game.js` and edit `CONFIG`:

- `roundMs` → base round duration / speed.
- `speedIncreasePerRound` → how much faster each next round gets.
- `goodZoneRatio` / `perfectZoneRatio` → target zone sizes.
- `minGoodRatio` / `minPerfectRatio` → minimum zone sizes at high rounds.
- `scoring` → points for `perfect`, `great`, `good`, `miss`.
