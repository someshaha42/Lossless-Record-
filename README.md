# FrameCut

Browser-based screen, window, and region recorder with an integrated photo & video crop tool built with React, TypeScript, Vite, Tailwind CSS v4, Web `MediaDevices`, Canvas 2D, `MediaRecorder`, and IndexedDB.

## Core Features

- **Full Screen & Region Capture**: Record an entire display, window, or browser tab via `navigator.mediaDevices.getDisplayMedia`, or crop live in real time using an offscreen HTML5 Canvas (`captureStream`) bounded by your selected pixel region.
- **Interactive Region Selector Overlay**: Drag handles, move the bounding frame, or snap to aspect-ratio presets (`Free`, `16:9`, `9:16`, `4:3`, `1:1`) with an optional animated red border preview.
- **Configurable Video & Audio Pipeline**: Choose bitrate presets (`100` to `350 Mbps` or custom), `Portrait` / `Landscape` orientation modes, `30` / `60 FPS` (or custom), GOP interval, color depth/range metadata preferences, and `Internal Audio` (shared tab/system audio) or `Microphone` (`getUserMedia`) capture.
- **Recorded Videos Library**: Captured recordings are persisted locally in browser IndexedDB (`framecut_recordings_db`) for instant in-app playback, downloading, or deletion.
- **Media Crop Tool**: Inspect local photos (JPEG, PNG, WebP, GIF, BMP) and videos (MP4, MOV, MKV, WebM), drag a normalized crop box with aspect presets, export 1:1 full-frame stream copies without re-encoding, or confirm (`CANCEL` / `CONTINUE`) to customize output resolution, FPS, bitrate, quality, and format before Canvas/MediaRecorder export.
- **Studio Dark & Studio Light Themes**: Toggle between Studio Dark and Studio Light palettes backed by `Space Grotesk`, `Plus Jakarta Sans`, and `JetBrains Mono` typography.

## Tech Stack & Scripts

- React `19`, TypeScript `5.7`, Vite `6`, Tailwind CSS `4`, `lucide-react`
- Browser APIs: `getDisplayMedia`, `getUserMedia`, `MediaRecorder`, HTML5 `<canvas>` (`captureStream`, `toBlob`), `IndexedDB`, `localStorage`
- Development server (port `3000`, host `0.0.0.0`): `npm run dev`
- Type-check & lint: `npm run lint`
- Production build: `npm run build`

## Browser Limitations

- Screen capture (`getDisplayMedia`) requires a secure context (`https://` or `localhost`) and user permission per session.
- Browser `MediaRecorder` codec support depends on the host browser (prefers `MP4` when supported, falling back to `WebM` VP9/VP8) and practical encoder bitrates are clamped for browser stability.
- System-wide Android floating overlays (`SYSTEM_ALERT_WINDOW`) are not available in standard web browsers; region preview is rendered inside the app workspace and overlay editor.
