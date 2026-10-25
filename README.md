# Salon Turn

A fast, installable (PWA) nail salon turn tracker. Viktor's own copy, independent from any other project:
own code, own GitHub repo, own data.

## What changed vs. the page it was copied from
- Pre-built with Vite: no in-browser Babel or Tailwind compiling, so it opens much faster.
- Installable on iPhone (Share → Add to Home Screen): full screen, own icon, works offline, opens instantly.
- Changes show on screen immediately (no waiting for the server).
- Its own data: runs on this device only until you add your own Firebase project in `src/firebaseConfig.js`.

## Run locally
    npm install
    npm run dev

## Publish on GitHub Pages
1. Push this folder to your own repo (branch `main`).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Each push to `main` builds and publishes to `https://<your-username>.github.io/<repo-name>/`.

## Sync between staff phones (optional)
1. Create a free project at https://console.firebase.google.com and add a Web app.
2. Build → Firestore Database → Create database.
3. Paste the config into `src/firebaseConfig.js` and push.
