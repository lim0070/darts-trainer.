# Oche — darts practice & record

A free, offline-first darts app for your phone (installable PWA). Built for soft-tip players first, with a steel-tip switch on every game.

## What's in it

- **01 games** (301–1501): soft-tip defaults (open out, fat bull, 15/20-round limit with a bull-off), steel-tip double out, double/master in, legs and sets. Score by visit total (with smart follow-up questions) or dart by dart, with finish routes.
- **Cricket**: standard and cut-throat, round limits, marks-per-round stats.
- **Punishments**: in 01 games a random card (push-ups, squats, plank, your own cards…) comes up after a bust, a missed finish, a low visit or by surprise. Done/skipped cards are tallied.
- **Computer opponent**: bot levels follow the DARTSLIVE rating scale (Rt 1–18), calibrated by simulation, or "match my level".
- **20 training drills**: Count-Up, T20 drill, 100 darts, Scoring challenge, Speed 501, Eagle's Eye, Bullseye drill, Cricket Count-Up, Around the Clock, Bob's 27, Frustration, Finish Trainer, 121 Checkout (with Safehouse), Catch 40, 170 practice, Checkout list, Half-It, Shoot Out, Shanghai, JDC Challenge.
- **Practice plans**: build a routine of steps (once, N games or N minutes) and run it step by step. Three presets included.
- **Stats**: 3-dart average, first 9, 80% stats, checkout %, best leg, ton counts, MPR, drill bests and trends, and an unofficial DARTSLIVE-style rating estimate (1–18, flights C–SA).
- **Your data stays on your phone** (IndexedDB). Back up and restore from Settings.

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # engine and database unit tests (Vitest)
npm run e2e        # browser smoke tests (Playwright)
npm run build      # type-check and production build
npm run calibrate  # re-run the bot calibration (writes src/engine/bot/calibration.ts)
```

## Deploy (GitHub Pages)

Push to `main` on GitHub, then in the repository's **Settings → Pages**, set **Source** to **GitHub Actions** (once). The workflow in `.github/workflows/deploy.yml` tests, builds with the right base path and publishes to `https://<user>.github.io/<repo>/`. Open that address on your phone and choose **Add to Home Screen**.

## Notes

The rating estimate uses DARTSLIVE's publicly listed rating table; it is not an official DARTSLIVE rating. Some drill details that aren't published anywhere are assumptions: Cricket Count-Up has 7 rounds, Shoot Out's Bull Challenge scores bull × 21, Half-It's target order, no JDC grades.
