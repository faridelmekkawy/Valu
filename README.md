# Sparkie Dash

Sparkie Dash is an original maze arcade game built with HTML, CSS, and vanilla JavaScript, with Firebase Firestore session tracking in the `pacmansave` collection.

## Run locally

1. From this folder, run a static server (example):
   ```bash
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080`.
3. Tap **Start Game** on the main page (no keyboard required).
4. Open `http://localhost:8080/registration/` on an usher device to live-edit player name and phone.

## Controls

- Touch: swipe on the game canvas to move in the swipe direction.
- Keyboard controls still work as an optional fallback.
- The player always respawns in the glowing **START** area for clear orientation.

## Replace assets

- Player sprite: `assets/sparkie_player.png`
- Logo: `assets/Value-Logo.png`
- Coins:
  - `assets/coins/coin_heart.png`
  - `assets/coins/coin_wink.png`
  - `assets/coins/coin_card.png`
  - `assets/coins/coin_token.png`

Keep the same file names to avoid code changes. If any image is missing, the game renders fallback placeholder shapes.

## Firestore session setup

1. Create a Firebase project and Firestore database.
2. Firebase is preconfigured for `valu-games`. To override for another project, provide config using one of:
   - `window.__FIREBASE_CONFIG__` (or `window.FIREBASE_CONFIG`) before app scripts run, or
   - `localStorage.setItem('firebase_config', JSON.stringify({ apiKey, authDomain, projectId }))`, or
   - hardcode values in `firebaseClient.js` default config.
3. Ensure Firestore security rules allow writes/reads for your event setup.
4. Sessions are stored only in collection `pacmansave`.
5. The gameplay page queues session writes in `localStorage` if offline, then retries when the browser comes online.

If Firebase is not configured, sessions stay queued locally until connectivity/config is fixed.

## Deploy

Deploy as a static site to any host (Firebase Hosting, Netlify, Vercel, GitHub Pages, or Nginx).

Basic Firebase Hosting path:
1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init hosting` (set public dir to current project root)
4. `firebase deploy`
