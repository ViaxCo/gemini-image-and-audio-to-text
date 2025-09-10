# Gemini Image Processor

Image → Markdown OCR powered by Google Gemini and the Vercel AI SDK. Upload one or more images (JPEG/PNG), provide an extraction prompt, and stream structured Markdown back with token usage metadata. Mobile‑first UI built with shadcn/ui.

---

## Features

- Streaming OCR to Markdown using `@ai-sdk/google` (`gemini-2.5-flash`).
- Multiple image uploads; client‑side type/size validation.
- Token usage display (input/output/total/reasoning) when provided by the provider.
- Raw vs. rendered Markdown views, copy to clipboard, expand dialog, and retry.
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

Environment

1. Copy `.env.local.example` → `.env.local`
2. Set your key:

```ini
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

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
  - File picker, prompt editor, and request cards.
  - Parses AI SDK data stream (SSE `data:` lines) into text deltas and usage metadata.
- API route: `POST /api/ocr` at `src/app/api/ocr/route.ts`
  - Accepts `form-data` with `prompt` and `files[]` (JPEG/PNG).
  - Streams response via `toUIMessageStreamResponse` and includes usage when available.
  - Runtime: Node.js; `maxDuration = 60` for larger batches.
- Components: `src/components`
  - `ui/` contains shadcn/ui primitives used by higher‑level components.
  - `theme-provider.tsx` and `theme-toggle.tsx` wire up dark mode.

---

## Usage

1. Choose images (drag‑drop or Browse) — JPEG/PNG up to ~10 MB each.
2. Adjust the prompt (a robust OCR→Markdown template is provided by default).
3. Submit and watch streamed Markdown accumulate.
4. Toggle Raw/Preview, Copy, Expand, or Retry a request.

---

## API Reference

Endpoint: `POST /api/ocr`

Request (multipart/form‑data)

- `prompt`: string
- `files`: one or more images (`image/jpeg` or `image/png`)

Response (event stream)

- Server‑Sent Events with AI SDK Data Stream payloads: `text-delta`, `message-metadata`, `finish`, `error`.
- Usage metadata surfaces when available (provider dependent) and is normalized on the client.

Errors

- `400` for missing files; `500` for unexpected errors. JSON body has `{ ok: false, error: string }`.

---

## UI & Conventions

- Mobile‑first: start with base styles; enhance with `sm:`, `md:`, `lg:` breakpoints.
- shadcn/ui: prefer primitives and composed blocks for consistency and a11y.
- Theming: Dark mode via `next-themes`. Toggle is fixed bottom‑right.
- Styling: Tailwind v4 utilities; use `cn()` for conditional classes.

---

## Contributing

- Use the MCP server to fetch shadcn/ui components/blocks. Run the demo tool first to confirm usage.
- Use Context7 to look up docs for any package you touch.
- Do not commit unless explicitly requested. When committing, prefer: `type(scope): subject`.
- Always run `npm run format` after changes; fix lint issues.

Security

- Never expose API keys client‑side. Keep `GOOGLE_GENERATIVE_AI_API_KEY` on the server.
