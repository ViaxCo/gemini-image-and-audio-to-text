# Gemini Image & Audio to Text

Image → Text OCR and Audio → Text in the browser using Google Gemini and the Vercel AI SDK. Drag/drop images (JPEG/PNG) or audio (MP3/M4A/WAV/OGG/FLAC/AIFF), edit the prompt, and stream structured text back with token‑usage metadata. Results can be previewed as Markdown or viewed raw, copied, expanded, or downloaded as `.md`/`.docx`. The UI is responsive, mobile‑first, and built with shadcn/ui.

--------------------------------------------------------------------------------

## Highlights

- Streaming OCR/transcription via `ai` + `@ai-sdk/google` on `gemini-2.5-flash`.
- BYOK in the browser: key stored in `localStorage` (never sent to a server).
- Image mode: JPEG/PNG files (≤ 10 MB each) with automatic batching (10 files per request by default).
- Large batches stream back in original order using capped request waves (configurable via `src/config/batch.ts`).
- Failed or canceled sub-requests stay in-place with inline placeholders and keep any partial text until you retry.
- Audio mode: up to 10 files (≤ 20 MB each), each processed concurrently.
- Token usage panel (input/output/total/reasoning) when the provider returns it.
- Markdown preview or raw view; copy, expand dialog, retry, cancel in‑flight.
- One‑click download to Markdown or Word (`mdast2docx`, with optional plugins).
- Dark mode (`next-themes`) and accessible shadcn/ui building blocks.

--------------------------------------------------------------------------------

## Quick Start

Prerequisites

- Node.js 18+ (recommend 20+)
- A Google Generative AI API key (get one free from Google AI Studio)

Install

```bash
npm install
```

Run (development)

```bash
npm run dev
# Opens on http://localhost:5174
```

Build and start (production)

```bash
npm run build
npm start
```

Format and lint

```bash
npm run format
npm run lint
```

--------------------------------------------------------------------------------

## API Key (BYOK)

- Enter your Gemini API key in the “Gemini API Key” bar at the top.
- The key is stored only in your browser (`localStorage` under `gemini_api_key`).
- The app calls Google directly from the client; there is no server proxy.
- `.env.local` is not required for this app. If present, it is ignored by the
  client‑side code. Prefer entering the key in the UI.

Security tips

- Restrict the key to your site origin in Google AI Studio when deploying.
- Rotate keys periodically; use least‑privilege where available.

--------------------------------------------------------------------------------

## Usage

1) Choose mode

- Image OCR or Audio → Text. Switching modes clears selected files by design.

2) Add files

- Image mode: drag/drop or choose JPEG/PNG files (≤ 10 MB each).
- Audio mode: drag/drop or choose audio files (MP3/M4A/WAV/OGG/FLAC/AIFF, ≤ 20 MB each; first 10 kept).

3) Edit the prompt

- A strong default is provided for each mode. Reset only affects current mode.

4) Submit and monitor

- Streaming text appears in a request card. View as Preview (Markdown-rendered)
  or Raw. Large image batches display a per-request table with statuses,
  countdowns between waves, and one-click retries. Cancel, Retry, Copy, Expand,
  or Download as `.md`/`.docx`.

--------------------------------------------------------------------------------

## Batch Processing & Configuration

- Image submissions exceeding the per-request cap are partitioned into waves.
- Defaults live in `src/config/batch.ts` and can be overridden via environment
  variables (`NEXT_PUBLIC_MAX_FILES_PER_REQUEST`,
  `NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE`).
- `REQUEST_WAVE_COOLDOWN_MS` is derived from the request rate to throttle the
  next wave; each card shows the countdown for transparency.
- Sub-requests stream back in original file order. Completed chunks are stitched
  into the combined output while failed chunks expose dedicated retry controls.

--------------------------------------------------------------------------------

## Limits and Formats

- Images: `image/jpeg`, `image/png`, ≤ 10 MB per file.
- Batching defaults: 10 images per request, 10 request waves per minute (tunable
  via `NEXT_PUBLIC_MAX_FILES_PER_REQUEST` / `NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE`).
- Audio: MP3, M4A, WAV, AAC, OGG, FLAC, AIFF/AIF, ≤ 20 MB per file, ≤ 10 files per submission.
- Large audio: compress or trim before uploading (inline upload limit).

--------------------------------------------------------------------------------

## Tech Stack

- Next.js 15 (App Router), React 19
- Tailwind CSS v4
- Vercel AI SDK v5 (`ai`) + `@ai-sdk/google`
- Radix UI + shadcn/ui, `next-themes`, `lucide-react`
- Biome for lint/format

--------------------------------------------------------------------------------

## How It Works

- Entry point: `src/app/page.tsx`
  - Wires up the API key bar, file picker, prompt editor, and request list.
  - Uses hooks to manage mode, files, toasts, and streaming.

- Submit flow
  - `use-submit-actions` now chunks large image submissions, manages a
    configurable wave scheduler, and dispatches sub-requests while preserving
    order. Partial chunks are buffered so early deltas survive even if the
    provider errors mid-stream, and the UI marks missing sections inline until
    you retry them.
  - `use-stream-runner` emits lifecycle callbacks (`onStart`, `onChunk`,
    `onFinish`, `onError`, `onAbort`) that the scheduler uses to update
    sub-request status, aggregate usage, and stitch contiguous text.
  - Usage is normalized from either `totalUsage` or
    `response.providerMetadata.google.usageMetadata`.

- Request cards: `src/components/request-card.tsx`
  - Shows filenames (with an expandable list for many images), status, token
    breakdown, Markdown preview, copy/expand/download actions, and Retry.
  - Audio requests render an inline custom audio player for the original file.
  - Batch requests add a scrollable sub-request table with status badges,
    wave countdowns, and per-chunk retry controls while keeping the combined
    preview contiguous.

- Downloads: `src/components/download-menu.tsx`
  - Markdown: saved as `.md` directly.
  - Word: dynamically imports `mdast2docx` and optional plugins (`@m2d/table`,
    `@m2d/list`, `@m2d/image`) to produce a `.docx`. Falls back gracefully if
    plugins are unavailable.

Relevant source

- Prompts: `src/lib/default-prompts.ts`
- Storage keys: `src/lib/constants.ts`
- Stream helpers/types: `src/lib/stream-utils.ts`, `src/lib/stream-types.ts`
- UI theming: `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`

--------------------------------------------------------------------------------

## Scripts

- `npm run dev`: start Next dev on port 5174 with Turbopack
- `npm run build`: build with Turbopack
- `npm run start`: start production server
- `npm run format`: format with Biome
- `npm run lint`: lint with Biome
- `npm run type-check`: TypeScript project references build

--------------------------------------------------------------------------------

## Customization

- Default prompts: adjust `DEFAULT_PROMPT` and `DEFAULT_PROMPT_AUDIO` in
  `src/lib/default-prompts.ts`.
- UI: tweak shadcn/ui components in `src/components` and Tailwind tokens in
  `src/app/globals.css`.
- Model: change the model name in `src/hooks/use-stream-runner.ts` if desired.

--------------------------------------------------------------------------------

## Privacy & Security

- The API key never leaves the browser. Requests go directly to Google.
- No app server stores or proxies your data.
- To clear the key, use the UI “Clear” button or run
  `localStorage.removeItem('gemini_api_key')` in DevTools.

--------------------------------------------------------------------------------

## Troubleshooting

- “Invalid API key” or `api_key_invalid`
  - Ensure you pasted a valid key and pressed Save. The app surfaces a helpful
    message via `formatModelError`.

- “Empty response”
  - The provider returned no text. Try another prompt or smaller batch.

- 429 / rate limits
  - Audio mode submits files concurrently; Retry affected cards or reduce
    concurrency.

- `.docx` export fails
  - The dynamic import of `mdast2docx` or its plugins may have failed. Retry or
    download as `.md`.

--------------------------------------------------------------------------------

## Deploy

- Vercel: no special config required. Build command `npm run build`; output is
  the Next.js `.next` output. No server env vars are needed.
- Other hosts: run `npm run build` and `npm start` on Node 18+.

--------------------------------------------------------------------------------

## License

No license file is present. By default, all rights are reserved. If you intend
to open‑source, add a `LICENSE` file.

--------------------------------------------------------------------------------

## Acknowledgements

- Google Gemini via `@ai-sdk/google`
- Vercel AI SDK (`ai`)
- shadcn/ui + Radix UI
- Tailwind CSS v4, `lucide-react`, `unified` ecosystem
