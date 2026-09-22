# Webcam MediaPipe PoC

A proof-of-concept React + TypeScript app that streams a webcam feed and runs
[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/overview)
against it in the browser — live eye tracking and head-tilt estimation on the
video feed, plus face/eye-state analysis and background removal on a
captured still image.

## MediaPipe Tasks Vision

MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) is Google's JS/WASM library
for running pretrained vision models — face landmarks, hand landmarks, object
detection, image segmentation, and more — directly in the browser, with no
server round-trip. Everything runs client-side: the library loads a WASM
runtime plus a model asset (a `.task`/`.tflite` file), then exposes a simple
`detect()` / `segment()` (single image) or `detectForVideo()` /
`segmentForVideo()` (continuous stream) API per task. This app uses two of
those tasks: **Face Landmarker** and **Image Segmenter**.

Shared setup for both tasks lives in
[`src/mediapipe/visionRuntime.ts`](src/mediapipe/visionRuntime.ts) — the WASM
base URL and the CPU/GPU delegate (see [Environment variables](#environment-variables)).

## Face Landmarker

[Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
detects a face and returns 478 3D landmark points, blendshape scores (facial
expression coefficients like `eyeBlinkLeft`), and a facial transformation
matrix (head orientation).

In this app, [`src/mediapipe/faceLandmarker.ts`](src/mediapipe/faceLandmarker.ts)
creates two separate instances, since a running mode is fixed at creation:

- A **`VIDEO`**-mode instance, driving live eye tracking on the webcam feed
  ([`useEyeTracking`](src/hooks/useEyeTracking.ts)): each frame, the two iris
  landmarks are read out and drawn as dots, and the angle between them gives a
  live head-tilt (roll) readout.
- An **`IMAGE`**-mode instance, run once against the captured still: its
  output feeds two independent eye-open/closed detectors — one reading the
  `eyeBlinkLeft`/`eyeBlinkRight` blendshape scores, the other computing the
  eye-aspect-ratio (EAR) from eyelid landmark geometry (toggle between them
  with the slider) — plus a full pitch/yaw/roll head-pose reading from the
  transformation matrix, reduced to a "Head is tilted" / "Head is not tilted"
  call ([`src/mediapipe/eyeState.ts`](src/mediapipe/eyeState.ts),
  [`src/mediapipe/headPose.ts`](src/mediapipe/headPose.ts)).

## Image Segmenter

[Image Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter)
classifies each pixel of an image into categories (e.g. "person" vs.
"background"), returned as either a **category mask** (one integer label per
pixel) or a **confidence mask** (a continuous per-pixel score per category).

This app uses it for background removal on the captured still only
([`src/mediapipe/imageSegmenter.ts`](src/mediapipe/imageSegmenter.ts),
[`src/mediapipe/backgroundReplace.ts`](src/mediapipe/backgroundReplace.ts)),
with three selectable methods, backed by two different models:

- **Category Mask** / **Confidence Mask** — both use Google's `selfie_segmenter`
  model (background vs. person), just reading its two different output types.
- **Multiclass** — uses the `selfie_multiclass` model instead, which segments
  into finer-grained categories (hair, body-skin, face-skin, clothes, others)
  rather than a single "person" class, useful for comparing edge quality
  against the binary model.

All three ultimately paint background pixels white on a copy of the captured
frame.

## Running in a dev environment

Requires [Node.js](https://nodejs.org/) (with npm).

```bash
npm install
npm run dev
```

This starts Vite's dev server (default `http://localhost:5173`) with hot
module reloading. Other scripts:

```bash
npm run build    # type-check (tsc -b) and produce a production build
npm run preview  # serve the production build locally
npm run lint     # run oxlint
```

Camera access requires either `localhost` or HTTPS — the dev server's
`localhost` origin satisfies this without extra setup.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and adjust as needed —
all are optional and fall back to sensible defaults if unset. Vite only
exposes variables prefixed `VITE_` to client code, and picks up `.env.local`
automatically without restarting the dev server for most changes (a restart
is needed for new variables).

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_MEDIAPIPE_DELEGATE` | `GPU` | Inference backend for both MediaPipe tasks: `GPU` or `CPU`. |
| `VITE_TILT_THRESHOLD_DEGREES` | `15` | Degrees of pitch/yaw/roll beyond which a captured image's head pose counts as "tilted". |
| `VITE_SEGMENTATION_CONFIDENCE_THRESHOLD` | `0.5` | Confidence-mask cutoff (0–1) below which a pixel is treated as background for the Confidence Mask method. |

All three are read once at module load and are otherwise unvalidated beyond a
basic range/type check — see the comments next to each threshold's definition
in [`src/mediapipe/headPose.ts`](src/mediapipe/headPose.ts) and
[`src/mediapipe/backgroundReplace.ts`](src/mediapipe/backgroundReplace.ts)
for how they were chosen (mostly first-guess defaults meant to be tuned
against a real camera).

## Design decisions

A few notable tradeoffs made along the way:

- **Two `FaceLandmarker` instances instead of one.** MediaPipe fixes a task's
  running mode (`VIDEO` vs `IMAGE`) at creation time, so live eye tracking and
  still-image analysis can't share a single instance. The cost is a second
  WASM/model load, but it keeps each mode's API (`detectForVideo` vs
  `detect`) simple rather than routing one instance through both.

- **Two independent eye-open detectors, togglable.** Blendshape scores
  (`eyeBlinkLeft`/`eyeBlinkRight`) and eye-aspect-ratio (EAR) from landmark
  geometry solve the same problem differently — one is a model output, the
  other a geometric heuristic. Rather than picking one, both are wired up
  with a slider to compare them directly, since neither is obviously more
  reliable across lighting/angle conditions.

- **Background removal runs on the captured still, not the live feed.**
  `ImageSegmenter` could run per-frame like the eye tracker does, but
  continuous segmentation is meaningfully more expensive than continuous
  landmark detection. Since background replacement isn't the live-tracking
  feature, it's scoped to the single captured frame to keep the video loop
  responsive.

- **Three segmentation methods across two models.** Category mask and
  confidence mask both use `selfie_segmenter` (binary person/background) —
  they exist side by side mainly to compare threshold-based vs hard-labeled
  output. Multiclass uses `selfie_multiclass` instead, which trades speed for
  finer-grained categories (hair, skin, clothes), useful for eyeballing edge
  quality against the binary model.

- **GPU delegate by default, CPU as a fallback via env var.** GPU delegate is
  faster but not universally supported/stable across browsers and hardware.
  Rather than auto-detecting, it's an explicit `VITE_MEDIAPIPE_DELEGATE`
  toggle so behavior is predictable and debuggable rather than silently
  switching paths.

- **No backend, by design.** Every model runs client-side via WASM; nothing
  is uploaded. This was a constraint from the start rather than an
  optimization — see [Privacy](#privacy) — which also ruled out easier
  server-side approaches (e.g. running a heavier segmentation model remotely)
  in favor of what's feasible in-browser.

- **Model bytes cached in IndexedDB, deliberately scoped narrow.**
  [`src/cache/modelCache.ts`](src/cache/modelCache.ts) caches the fetched
  MediaPipe model assets (`.task`/`.tflite` files) so repeat and offline
  loads skip the CDN round-trip, using the official `modelAssetBuffer` API to
  hand MediaPipe pre-fetched bytes instead of a URL. This only covers the
  model files — the WASM runtime files served alongside them are a separate,
  less well-defined caching problem and were left uncached for now. Revisiting
  after more research and tinkering.

- **App shell precached via `vite-plugin-pwa`, cache failures degrade to a
  network fetch.** [`vite.config.ts`](vite.config.ts) precaches the built
  HTML/JS/CSS so a page refresh works offline, and both the IndexedDB read
  and write in the model cache are wrapped to fall back to (or continue past
  failure to) a normal network fetch rather than erroring out — offline
  support degrades gracefully instead of being all-or-nothing.

## Privacy

There is no backend. Your webcam feed and any captured images are processed
entirely on-device by MediaPipe and never uploaded anywhere by this app.

Per [MediaPipe's own disclosure](https://www.npmjs.com/package/@mediapipe/tasks-vision),
the Tasks Vision APIs used here do send Google metrics about performance and
API usage (not your images or video) — see the linked page for details. If
you deploy this app for others to use, you're responsible for obtaining
whatever informed consent applicable law requires for that metrics
collection.

## License

[MIT](LICENSE). Note that `@mediapipe/tasks-vision` itself is licensed under
Apache-2.0 — see its [package on npm](https://www.npmjs.com/package/@mediapipe/tasks-vision)
for its own terms.
