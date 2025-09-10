# Implementation Plan — Gemini Image-to-Text OCR App (Next.js + AI SDK 5)

Last updated: September 10, 2025

This plan synthesizes the brainstorming outcomes (brainstorm.md), the product brief (project-brief.md), and key documentation from Context7 for Next.js (Route Handlers, streaming, form-data), Vercel AI SDK v5 (Google provider), and Google Gen AI JavaScript SDK. It provides a concrete, end-to-end path to deliver the MVP and a clear runway for Phase 2.

---

## 1) Goals & Non-Goals

- Core goal: Convert book page images (JPEG/PNG) into accurate, well-structured Markdown using Gemini with explicit prompt instructions (extract all text, paragraphs, include page number, remove irrelevant metadata).
- UX goal: Two-column layout. Left = input (upload + prompt). Right = request cards showing status and results with Copy, Expand, and Retry.
- Performance/UX: Support initiating multiple requests in parallel with responsive feedback. MVP may complete requests synchronously per card, then evolve to true async with streaming or polling.
- Non-goals (MVP): Auth, video/GIF, long-term storage, advanced editor.

Success criteria (MVP):
- Single-page images reliably return Markdown matching prompt instructions.
- Multiple requests can be initiated; each becomes a “card” with Processing → Complete/Failed.
- Copy-to-clipboard works from card and expanded modal.
- Retry resubmits same inputs.

---

## 2) Architecture Overview

- Frontend: Next.js 15 App Router (React 19, Tailwind v4). Two-column dashboard in a single route (e.g., `/`).
- Backend: Route Handler at `app/api/ocr/route.ts` (Node runtime) receives multipart form-data, calls Gemini via AI SDK v5 with the Google provider.
- AI: Vercel AI SDK v5 (`ai` + `@ai-sdk/google`) using a vision-capable Gemini model (e.g., `gemini-2.5-flash`).
- State: Local client state for request cards (id, status, inputs metadata, result, error). Future: promote to a light store if needed.
- Streaming (optional in MVP): Route can return a streamed response for progressive UI; start with non-streamed response for simplicity, then upgrade.

Notes from Context7 docs:
- Next.js Route Handlers live in `app/**/route.ts` and can parse `FormData` via `request.formData()` (Next docs). They support streaming via `ReadableStream` and can opt into `runtime = 'nodejs'` for Node APIs.
- AI SDK v5 supports Google Gemini via `@ai-sdk/google`, with API key defaulting to `GOOGLE_GENERATIVE_AI_API_KEY` and multimodal inputs via `messages` contents including `{ type: 'file', data, mediaType }` (AI SDK docs).

---

## 3) Dependencies & Configuration

Add AI SDK v5 and Google provider:
- `npm i ai @ai-sdk/google` (or `pnpm add ai @ai-sdk/google`).

Environment variables:
- `.env.local`: `GOOGLE_GENERATIVE_AI_API_KEY="<your-key>"` (AI SDK Google provider reads this by default).
- Keep all Gemini calls server-side (Route Handler) to avoid exposing keys.

Tailwind v4 is already configured; keep using PostCSS plugin config.

---

## 4) Data Model (Client-side only)

RequestCard (in-memory):
- `id: string` — `crypto.randomUUID()` when enqueuing.
- `prompt: string`
- `files: { name: string; size: number; type: string; previewUrl?: string; title: string }[]`  // title defaults to `Page {index+1}` but is editable
- `status: 'queued' | 'processing' | 'complete' | 'failed'`
- `resultMarkdown?: string`
- `error?: string`
- `createdAt: number` (ms)

No database for MVP. Results live in memory; user copies or discards.

---

## 5) API Contract

Endpoint: `POST /api/ocr`

Request (multipart/form-data):
- `prompt`: string
- `files`: one or more `File` parts (accept `image/jpeg`, `image/png`)
- `titles` (optional): JSON string array mapping to files order, e.g., `["Page 1","Page 2"]`

Response (JSON, MVP non-streaming):
- `ok: true`
- `markdown: string`
- `model: string` (e.g., `gemini-2.5-flash`)
- `usage?: { inputTokens?: number; outputTokens?: number }` (if available)

On error: `{ ok: false, error: string }` with appropriate HTTP status.

---

## 6) Prompt Design (User-Visible & Editable)

The app ships with a default prompt that is visible and editable in the left-column textarea. We send it verbatim to the server (no hidden template concatenation). Users may edit or replace it per request. The UI also provides a "Reset to default" action.

Default prompt used in the UI:

```
Extract all text from the provided sources, in the numerical order of the sources.

For each source:
	1.	Extract the full text.
	2.	Reconstruct the text into readable paragraphs. A new paragraph should begin where there is a clear break in the original text, such as a new line, indentation, or topic change. Do not merge paragraphs that are clearly separate in the source.
	3.	Ensure each distinct scripture passage is separated from the surrounding text by a blank line. For example, if the text contains "John 3:16" followed by commentary, the scripture should be a separate paragraph.
	4.	After the extracted and formatted text for the source, insert a blank line.
	5.	On the new line, append the page number. The number should correspond to the source title (e.g., source titled 'Page 1' should use '1').
	6.	Format the page number as: **Page [number]**

Example formatting:
[Extracted and formatted text of the source, with paragraphs and scripture passages separated correctly.]

**Page 1**
```

Source titles and ordering:
- The client shows a per-file "Source title" input next to each selected file, defaulting to `Page {index+1}` in the order selected. Users can edit these.
- Titles are sent to the server as a JSON array (`titles`) aligned with file order.
- The server interleaves a short text marker before each file to preserve title/source mapping for the model (see §7).

---

## 7) Backend Implementation (Route Handler)

File: `app/api/ocr/route.ts`

Key points (per Next & AI SDK docs):
- Export `export const runtime = 'nodejs'` to ensure Node APIs are available.
- Parse `FormData` with `await request.formData()` and gather images via `formData.getAll('files') as File[]`.
- Convert each `File` to `Uint8Array` via `await file.arrayBuffer()`.
- Call `generateText` from `ai` with `model: google('gemini-2.5-flash')` and a single user message that includes the (verbatim) user prompt plus interleaved source titles and file parts:

Pseudo-code:
```ts
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const form = await req.formData();
  const prompt = String(form.get('prompt') || '');
  const files = form.getAll('files') as File[];
  if (!files.length) return Response.json({ ok: false, error: 'No files' }, { status: 400 });
  const titlesRaw = form.get('titles');
  const titles = Array.isArray(titlesRaw)
    ? titlesRaw
    : (typeof titlesRaw === 'string' ? JSON.parse(titlesRaw) : []);

  const content: any[] = [{ type: 'text', text: prompt }]; // send verbatim
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const title = titles[i] || `Page ${i + 1}`;
    content.push({ type: 'text', text: `Source title: ${title}` });
    content.push({
      type: 'file',
      data: new Uint8Array(await f.arrayBuffer()),
      mediaType: f.type || 'image/jpeg',
    });
  }

  const { text /*, usage*/ } = await generateText({
    model: google('gemini-2.5-flash'),
    messages: [{ role: 'user', content }],
  });

  return Response.json({ ok: true, markdown: text, model: 'gemini-2.5-flash' });
}
```

Optional streaming upgrade:
- Swap to `streamText({ model, messages })` and return `result.toTextStreamResponse()` so the client can progressively render. (Next + AI SDK support streaming with native `ReadableStream`.)

---

## 8) Frontend Implementation

Route: `app/page.tsx`

Layout:
- Left column: drag-and-drop uploader + files list (with editable "Source title" per file, defaulting to `Page {n}`), prompt textarea prefilled with the default prompt, Submit button, and "Reset to default" for the prompt.
- Right column: request cards list.

Flow:
1) User selects images; each file gets a default source title (`Page {n}`) which the user may edit. Prompt textarea is prefilled with the default prompt but remains editable.
2) On submit, create a new RequestCard with `processing` status and immediately `POST` a `FormData` with images + prompt to `/api/ocr`.
3) On success, update card to `complete` with `resultMarkdown`.
4) On failure, set `failed` with `error`.
5) `Copy` button writes `resultMarkdown` to clipboard; `Expand` opens modal; `Retry` resubmits same inputs as a new card.

Parallelism:
- Each submit call is independent; React state holds multiple cards concurrently.

UX details:
- Drag zone shows file count and per-file size/type; basic validation (type, size limit like 10MB/image).
- Card skeleton/loader for processing.
- Use `tailwind-merge` and `clsx` (already installed) for conditional styles.
- Persist last-used prompt and per-file titles in `localStorage` for convenience; add a clear "Reset to default".

---

## 9) Error Handling & Edge Cases

- Empty prompt: allow, since the server template still guides OCR.
- No files: return 400 with helpful message.
- Unsupported MIME type: reject early client-side; validate server-side too.
- Large images: document recommended size; consider downscaling client-side in future.
- Gemini errors: surface concise error on card; enable `Retry`.

---

## 10) Security & Privacy

- API key only on server; no client exposure.
- Do not persist images or outputs (MVP). Memory-only processing.
- Limit response and body sizes reasonably; avoid logging PII.

---

## 11) Testing & Verification

- Manual tests:
  - One image happy-path with clear page number.
  - Multiple images in parallel submissions.
  - Failure path with bad MIME or missing file.
  - Copy, Expand, Retry flows on cards.
- Dev ergonomics:
  - Add simple mock route that returns fixed markdown for local UI testing.
  - Feature-flag streaming to validate progressive rendering later.

---

## 12) Phased Delivery Plan

Phase A — Foundation (MVP)
1) Install deps: `ai`, `@ai-sdk/google`.
2) Add `/api/ocr` POST route (non-streaming) with Node runtime.
3) Implement two-column UI with basic uploader, prompt, and cards.
4) Wire Copy, Expand (modal), Retry.
5) Happy-path manual tests; document `.env.local`.

Phase B — Fit & Finish
1) Input validation (MIME/size), empty prompt handling.
2) Error states with retry hints; toasts for copy success/failure.
3) Card polish: timestamps, file badges, compact/expanded styles.

Phase C — Async & Scale
1) Switch to streaming (`streamText` + `toTextStreamResponse`) and incremental UI updates.
2) Optional: polling or WebSocket status if offloaded to background jobs.
3) Optional: transient persistence (e.g., in-memory cache) for resume-on-refresh.

Phase D — Post-MVP Ideas
- Batch upload and merged outputs.
- Basic in-app Markdown edits.
- Optional export (MD/EPUB/PDF) and cloud integrations.

---

## 13) Acceptance Checklist (MVP)

- [ ] `/api/ocr` accepts images + prompt and returns Markdown using Gemini.
- [ ] Two-column UI with interactive request cards.
- [ ] Copy-to-clipboard works from card and modal.
- [ ] Retry duplicates inputs and enqueues a new card.
- [ ] Handles at least three concurrent submissions without UI freezes.
- [ ] Default prompt is visible and editable; server sends it verbatim.
- [ ] Each file has an editable source title; titles are honored in the request and reflected in output per prompt rules.

---

## 14) Implementation Notes (Gotchas)

- Use `runtime = 'nodejs'` in the route to ensure Node APIs and larger files are supported by the handler.
- For multiple images, interleave a short text marker (e.g., `Source title: Page N`) immediately before each `{ type: 'file', ... }` so the model respects ordering and page-number mapping. Pass each image as its own `{ type: 'file', data, mediaType }`.
- If streaming: client must consume a `ReadableStream` and progressively append to the card’s markdown; AI SDK provides `toTextStreamResponse()` helpers.
- Tailwind v4: utility classes only; no `@apply` in CSS files by default. Keep styles in JSX className.

---

## 15) References (Context7)

- Next.js App Router — Route Handlers, formData, streaming, runtime:
  - Define handlers and formData parsing; streaming with `ReadableStream`; set `runtime = 'nodejs'` (Context7: `/vercel/next.js`).
- Vercel AI SDK v5 — Google Provider & multimodal input:
  - Install `ai` and `@ai-sdk/google`; use `generateText`/`streamText`; `GOOGLE_GENERATIVE_AI_API_KEY` env; file inputs in `messages` (Context7: `/vercel/ai`).
- Google Gen AI JavaScript SDK (optional alt):
  - Initialize with `GEMINI_API_KEY`/`GOOGLE_API_KEY`; supports `generateContent` and streaming (Context7: `/websites/googleapis_github_io-js-genai-release_docs`).

---

## 16) Next Steps

1) Confirm env key is available and set `.env.local` accordingly.
2) Implement `/api/ocr` (non-streaming) and wire minimal UI to verify E2E.
3) Iterate on prompt fidelity with a few sample pages; adjust instruction template.
4) Decide whether to upgrade to streaming for better perceived performance.
