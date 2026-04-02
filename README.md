# Sparkie Dash

Sparkie Dash is a touch-first maze arcade game built with HTML, CSS, and vanilla JavaScript. It supports Firebase Firestore session tracking for arcade floors and a separate usher registration console.

## Run locally

1. From this folder, run a static server (example):
   ```bash
   python3 -m http.server 8080
   ```
2. Open the game at `http://localhost:8080`.
3. Open usher registration at `http://localhost:8080/registration/`.

## Arcade flow (no keyboard required)

- Players tap **Start Game** and are auto-assigned a sequential number (`Player 1`, `Player 2`, …).
- The counter is persisted in localStorage (`sparkie_dash_next_player_number`).
- Session lifecycle is written to Firestore collection `sparkie_dash_sessions`:
  - on game start: `status: "playing"`, current score, player number
  - on game end: `status: "finished"`, final score

## Registration console (`/registration/`)

- Uses Firestore `onSnapshot` for real-time updates.
- Shows sessions ordered by most recent `createdAtMs`.
- Ushers can tap a session and attach:
  - `realName`
  - `phone`

## Offline queueing

If Firebase is unavailable or the device is offline:

- Session operations are queued in localStorage (`sparkie_dash_session_queue`).
- A local `localSessionId -> Firestore doc id` map is kept in `sparkie_dash_session_doc_map`.
- Queue flush is attempted:
  - on app start
  - whenever the browser `online` event fires

## Firestore setup

1. Create a Firebase project and Firestore database.
2. Update `firebaseConfig` in both:
   - `game.js`
   - `registration/registration.js`
3. Configure Firestore rules appropriate for your event environment.

If Firebase is not configured, the game still runs, and session writes are queued locally until Firebase becomes available.
