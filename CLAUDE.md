# CLAUDE.md

## Project status

Rapidly built **proof of concept** to explore what MediaPipe Tasks Vision can do in the browser. It will never become a production product. Favor simple, readable, exploratory code. Do not add production scaffolding (extensive error handling, abstraction layers, test infrastructure, i18n, analytics) unless asked. Cutting a corner is fine; say so in a comment if it's non-obvious.

See [README.md](README.md) for what the app does and its "Design decisions" section for the reasoning behind the architecture. Read it before proposing structural changes.

## Stack

Vite + React 19 + TypeScript, `@mediapipe/tasks-vision`, `vite-plugin-pwa`, oxlint. No backend.

## Commands

```bash
npm run dev      # Vite dev server on http://localhost:5173 (preview config in .claude/launch.json)
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview  # serve the production build
```

There is **no test suite**. Verify changes with `npm run lint`, `npm run build`, and by exercising the feature in the browser (webcam required; `localhost` or HTTPS only).

## Layout

- `src/mediapipe/` — MediaPipe setup and pure analysis logic (head pose, eye state, segmentation, cropping)
- `src/hooks/` — React hooks wrapping the live landmarker (`useEyeTracking`, `useFaceLandmarker`)
- `src/components/` — UI (`WebcamView`, `ConsentGate`)
- `src/cache/modelCache.ts` — IndexedDB cache for model bytes

## Constraints and gotchas

- **Two `FaceLandmarker` instances (VIDEO + IMAGE) are intentional.** A task's running mode is fixed at creation. Don't merge them.
- **No backend, nothing uploaded.** All inference runs client-side. Don't add network calls that send images or video anywhere.
- **Background removal runs on the captured still only**, not per-frame (cost).
- **GPU/CPU delegate is an explicit env toggle** (`VITE_MEDIAPIPE_DELEGATE`), not auto-detected.
- **Only model files are cached** (IndexedDB). The WASM runtime is deliberately uncached for now. Cache failures must fall back to a normal network fetch.
- The service worker is enabled under `vite dev` too, so stale caches can cause confusing behavior. Hard-reload or clear site data when something looks stale.
- `VITE_*` env vars are read once at module load. Adding a new one needs a dev-server restart.
- Lint rule `react/rules-of-hooks` is an error; keep it clean.

## Git workflow

1. The user creates the feature branch. Don't create or switch branches.
2. Claude writes the commit message and makes the commit (only when the work is done or the user asks).
3. The user pushes, opens/reviews the PR, and merges. Never push or open PRs.
4. The user refreshes `main` afterward. Don't pull, merge, or rebase onto it unless asked.

Commit messages: succinct, a short imperative subject line describing the core change (add a brief body only if essential). End with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Safety

- Never read, print, or commit `.env*` files. `.env.local` contains a Vercel token.
- Deploys happen from `v*` git tags via GitHub Actions to Vercel. Do not create or push tags, or deploy, unless explicitly asked.
