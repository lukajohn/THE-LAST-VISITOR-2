# THE LAST VISITOR

A 2D pixel-noir psychological detective game (TypeScript, Canvas 2D, Vite). Playable vertical slice: bedroom investigation, detective office with an evidence board, interrogation, and two endings.

Inspired by the documented case of William Dale Archerd. Characters, dialogue and scenes are dramatized fiction, not historical record. No real-world methods are depicted.

## Controls
- Mouse / touch: click objects and buttons
- Keyboard: Arrow keys or Tab to move focus, E or Enter to activate, B opens the evidence board, M toggles sound, Esc closes panels

## Run locally
```
npm install
npm run dev
```
Production check: `npm run build` (type-checks, then builds to `dist/`).

## Deploy (free, GitHub Pages)
1. Merge `feature/the-last-visitor2` into `main`.
2. In the repo: Settings > Pages > Source: **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

The site will be at `https://lukajohn.github.io/THE-LAST-VISITOR-2/`.

## Saves
Progress autosaves to LocalStorage (versioned). Corrupted or incompatible saves are ignored safely.
