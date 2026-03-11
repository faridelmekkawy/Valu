# Sparkie Dash

Sparkie Dash is an original maze arcade game built with HTML, CSS, and vanilla JavaScript, using provided image assets and optional Firebase Firestore leaderboard support.

## Run locally

1. From this folder, run a static server (example):
   ```bash
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080`.
3. Enter a gamer tag and press **Start Game**.

## Replace assets

- Player sprite: `assets/sparkie_player.png`
- Logo: `assets/Value-Logo.png`
- Coins:
  - `assets/coins/coin_heart.png`
  - `assets/coins/coin_wink.png`
  - `assets/coins/coin_token.png`

Keep the same file names to avoid code changes. If any image is missing, the game renders fallback placeholder shapes.

## Firestore leaderboard setup

1. Create a Firebase project and Firestore database.
2. In `game.js`, update `firebaseConfig` values (`apiKey`, `authDomain`, `projectId`).
3. Ensure Firestore security rules allow writes/reads for your event setup.
4. Scores are stored in collection `sparkie_dash_scores`.

If Firebase is not configured, leaderboard automatically falls back to local browser storage.

## Deploy

Deploy as a static site to any host (Firebase Hosting, Netlify, Vercel, GitHub Pages, or Nginx).

Basic Firebase Hosting path:
1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init hosting` (set public dir to current project root)
4. `firebase deploy`
