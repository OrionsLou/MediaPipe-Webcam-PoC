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
