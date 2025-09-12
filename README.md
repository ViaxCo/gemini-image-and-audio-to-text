# Gemini Image & Audio to Text
Image → Text OCR (and Audio → Text) powered by Google Gemini and the Vercel AI SDK. Upload one or more images (JPEG/PNG) or audio files, provide an extraction prompt, and stream structured text back with token usage metadata. You can download results as Markdown (.md) or Word (.docx), view formatted text (Markdown‑rendered) or the raw Markdown. Mobile‑first UI built with shadcn/ui.

---

## Features

- Streaming OCR/transcription to text using `@ai-sdk/google` (`gemini-2.5-flash`).
- Multiple image uploads; client‑side type/size validation.
- Audio → Text mode: submit up to 10 audio files (≤ 20 MB each), each runs concurrently in its own card.
- Token usage display (input/output/total/reasoning) when provided by the provider.
- View formatted text (Markdown‑rendered) or Raw Markdown; copy, expand, and retry.
- Download as Markdown (.md) or Word (.docx).
- Dark mode with `next-themes`; responsive, mobile‑first layout.
- shadcn/ui primitives for consistent, accessible UI.

---

## Quick Start

Prerequisites

- Node.js 18+ (recommend 20+)
- A Google Generative AI API key

Install

```bash
npm install
```

API Key (BYOK)

- Open the app and enter your Gemini API key in the “Gemini API Key” bar.
- The key is stored in your browser (`localStorage`) under `gemini_api_key` and never sent to any server.
- Requests are made directly from your browser to Google Gemini.

Run (dev)

```bash
npm run dev
# app runs at http://localhost:5174
```

Build & start (prod)

```bash
npm run build
npm start
```

Format & lint

```bash
npm run format
npm run lint
```

---

## Tech Stack

- Next.js 15 (App Router), React 19
- Tailwind CSS v4
- Vercel AI SDK v5 (`ai`) + `@ai-sdk/google`
- shadcn/ui (Radix UI), `next-themes`, `lucide-react`
- Biome for lint/format

---

## Architecture

- UI entry: `src/app/page.tsx`
  - File picker, prompt editor, API key bar, and request cards.
  - Calls Gemini directly from the browser via AI SDK `streamText`; accumulates text deltas and normalizes usage metadata on finish.
- No server proxy:
  - Your key is used only in the browser.
- Components: `src/components`
  - `api-key-bar.tsx` stores/clears the key in `localStorage`.
  - `ui/` contains shadcn/ui primitives used by higher‑level components.
  - `theme-provider.tsx` and `theme-toggle.tsx` wire up dark mode.

---

## Usage

1. Choose images (drag‑drop or Browse) — JPEG/PNG up to ~10 MB each.
2. Adjust the prompt (a robust OCR→Text template is provided by default).
3. Submit and watch streamed text accumulate.
4. Toggle Raw/Preview, Copy, Expand, or Retry a request.

---

## Audio Mode

- Toggle `Mode: Audio` at the top of the left column.
- Select up to 10 audio files. Supported types: MP3, M4A, WAV, OGG, FLAC, AIFF (≤ 20 MB each).
- Each audio file becomes its own request card and streams concurrently. If you hit rate limits (e.g., 429), use Retry on the affected card.
- Prompts are stored per‑mode and the Reset button resets only the current mode’s default.

Notes

- Audio is sent inline to Gemini; the 20 MB per‑file cap reflects the inline request size limit.
- To handle larger files, consider compressing/trimming audio. A server‑side upload path can be added later if needed.

---

## Notes

- Supported images: JPEG/PNG up to ~10 MB each.
- Token usage is displayed when provided by the provider; totals are computed from available fields.
- For added safety, restrict your API key to your site origin in Google AI Studio and rotate keys periodically.

---

## UI & Conventions

- Mobile‑first: start with base styles; enhance with `sm:`, `md:`, `lg:` breakpoints.
- shadcn/ui: prefer primitives and composed blocks for consistency and a11y.
- Theming: Dark mode via `next-themes`. Toggle is fixed bottom‑right.
- Styling: Tailwind v4 utilities; use `cn()` for conditional classes.
