# Sparkie Rush (`/runner`)

A frontend-only endless runner built with **HTML + CSS + vanilla JavaScript**.

## Run locally

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/runner/`

## Controls

- `Left Arrow` / `A`: move lane left
- `Right Arrow` / `D`: move lane right
- `Up Arrow` / `W`: jump
- `Down Arrow` / `S`: slide
- `P`: pause / resume

## Assets expected

The runner page uses these paths:

- `assets/sparkie_player.png`
- `assets/Value-Logo.png`
- `assets/sparkie_logo.png` (start screen)
- `assets/coins/coin_heart.png`
- `assets/coins/coin_wink.png`
- `assets/coins/coin_token.png`

If any image is missing, the game uses safe placeholder shapes/UI so gameplay keeps running.

## Replace assets later

Keep file names and paths unchanged for a drop-in replacement. PNG transparency is preserved and logos are rendered with `object-fit: contain` to maintain aspect ratio.
