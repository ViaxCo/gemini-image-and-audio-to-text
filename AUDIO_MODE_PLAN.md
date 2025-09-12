# Audio → Markdown Mode: Implementation Plan

This document is the single source of truth to add an Audio → Markdown mode next to the existing Image → Markdown OCR flow. It is written to be executable by a future session without prior memory. Follow it step‑by‑step.

## Summary
- Add a top‑level pipeline “mode”: `image` (existing) and `audio` (new).
- Keep the current two‑column layout and request cards UX.
- Image mode: unchanged; multiple images → one request card.
- Audio mode: multiple audio files → multiple request cards (one per file), launched concurrently.
- Prompt is per‑mode with separate defaults and persistence.
- FilePicker becomes mode‑aware; accept `image/*` vs `audio/*` and enforce different limits.
- Request cards show a single filename badge in audio mode and hide the multi‑file header.

## Current State (as of 2025‑09‑12)
- Client‑only calls using Vercel AI SDK: `@ai-sdk/google` + `ai` `streamText` in `src/app/page.tsx`.
- Model: `gemini-2.5-flash` via BYOK.
- Key UI files:
  - `src/app/page.tsx` – orchestrates state, streaming, and cards.
  - `src/components/file-picker.tsx` – image picker + drop zone.
  - `src/components/prompt-editor.tsx` – prompt text area with “Reset to default”.
  - `src/components/request-card.tsx` – card UI incl. tokens, copy/download/expand.
  - `src/components/result-dialog.tsx` – larger markdown dialog.
  - `src/lib/constants.ts` – localStorage keys: `GEMINI_API_KEY`, `PROMPT_DEFAULT`.
  - `src/types.ts` – `Card` shape; `usage` fields.

## Goals
- Maintain existing behavior for Image OCR mode.
- Add Audio → Markdown mode with:
  - 10 files max per submit.
  - 20 MB max per audio file (inline request limit).
  - Start all selected audio requests concurrently.
  - Show one filename badge per audio card.
- Minimal code churn; reuse streaming/error plumbing.

## Non‑Goals (Phase 2 candidates)
- Files API upload path for >20 MB audio.
- Audio preview players in cards.
- Server proxy; keep requests client‑side as now.

## References (authoritative)
- Gemini Audio Understanding (inline 20 MB limit; formats; ~32 tokens/sec; max ~9.5h): https://ai.google.dev/gemini-api/docs/audio
- Rate limits (Free tier: Gemini 2.5 Flash = 10 RPM as of 2025‑09‑10): https://ai.google.dev/gemini-api/docs/rate-limits
- Vercel AI SDK multimodal file parts (Google provider): https://ai-sdk.dev and provider docs in /vercel/ai repo.

## UX Spec
- Top left area gains a small two‑button segmented toggle labeled `Mode:` with buttons `Image OCR` and `Audio`. Default remains `Image OCR`.
- FilePicker title switches:
  - Image: “Image → Markdown OCR” (unchanged)
  - Audio: “Audio → Markdown”
- Dropzone helper text updates accordingly.
- Submit button behavior:
  - Image: unchanged.
  - Audio: create N cards (N ≤ 10), one per audio file, and start all streams immediately.
- Request cards:
  - Image: unchanged multi‑file header + counts.
  - Audio: show a single filename badge; remove the “first … last +N more” structure and the trailing `N files` counter.
- Everything else (copy, download, expand, cancel, retry, token counters) stays the same.

## Data Model and Storage
- `Card` gains a field: `mode: 'image' | 'audio'`.
- LocalStorage keys (additions):
  - `PIPELINE_MODE = 'pipeline_mode'`
  - `PROMPT_AUDIO = 'ocr_audio_prompt'`
  - Keep existing `PROMPT_DEFAULT` for image mode (back‑compat); do not rename to avoid breaking existing persisted prompt.

## Prompts
- Image default: keep existing `DEFAULT_PROMPT` in `page.tsx`.
- Audio default constant to add (exact text):

```
Edit the source, correcting all typographical, grammatical, and spelling errors while maintaining the original style and emphasis.

Ensure all biblical references:
- Use exact KJV wording.
- Are explicitly quoted in full including those referenced in passive.
- Formatted in isolation with verse numbers, with the reference line in bold and verses in normal weight, e.g.:

**Genesis 12:2-3 - KJV**
2. And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:
3. And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.

Correct all Hebrew and Greek words with proper transliterations.

Remove all verbal fillers ("uh", "um", etc.) while preserving the complete content and meaning.

Maintain all of the author's:
- Teaching points
- Rhetorical devices
- Emphasis patterns
- Illustrative examples
- Call-and-response elements

Format the text with:
- Consistent punctuation
- Proper capitalization
- Original paragraph structure
- Clear scripture demarcation
- Smart quotes
```

- Persistence behavior:
  - When mode switches to `image`, load `PROMPT_DEFAULT` if present; otherwise seed from current `DEFAULT_PROMPT`.
  - When mode switches to `audio`, load `PROMPT_AUDIO` if present; otherwise seed from `DEFAULT_PROMPT_AUDIO`.
  - “Reset to default” button resets to the default of the current mode only.

## Validation Rules
- Image selection (unchanged): MIME must match `image/jpeg` or `image/png`; size ≤ 10 MB per file.
- Audio selection:
  - Accept if `file.type.startsWith('audio/')` OR extension in `{mp3,m4a,wav,aac,ogg,flac,aiff}`.
  - Size must be ≤ 20 MB (inline request limit applies to total request size; we treat it per‑file since audio is 1 file per request).
  - Keep only first 10 audio files if user selects more; toast the user.
- Toast messages:
  - `"Only first 10 audio files kept."` (warning)
  - `"Audio over 20 MB isn’t supported inline. Trim/compress and retry."` (warning)
  - `"Unsupported audio type. Use MP3/WAV/M4A/OGG/FLAC."` (warning)

## MIME Type Mapping (fallback by extension)
- If `file.type` is absent or generic:
  - `.mp3` → `audio/mp3`
  - `.m4a` → `audio/mp4`
  - `.wav` → `audio/wav`
  - `.aac` → `audio/aac`
  - `.ogg` → `audio/ogg`
  - `.flac` → `audio/flac`
  - `.aiff` / `.aif` → `audio/aiff`

## Concurrency Strategy
- Audio mode submits all selected files concurrently (up to 10). No internal queue.
- Free tier is 10 RPM; concurrent calls beyond RPM or retries may return HTTP 429 on some cards. That is acceptable; Retry per card should succeed after a short wait.

## Component‑Level Changes

### 1) `src/types.ts`
- Extend `Card`:

```ts
export type Card = {
  id: string;
  mode: 'image' | 'audio';
  prompt: string;
  files: FileMeta[];
  filesBlob?: { file: File }[];
  status: 'processing' | 'complete' | 'failed';
  resultMarkdown?: string;
  error?: string;
  createdAt: number;
  usage?: Usage;
  usageTotal?: number;
};
```

### 2) `src/lib/constants.ts`
- Add:

```ts
export const STORAGE_KEYS = {
  ...,
  PIPELINE_MODE: 'pipeline_mode',
  PROMPT_AUDIO: 'ocr_audio_prompt',
} as const;
```

### 3) New `ModeToggle` component (add `src/components/mode-toggle.tsx`)
- A simple segmented control with two buttons. Props:
  - `mode: 'image' | 'audio'`
  - `onChange: (mode) => void`
- Renders small label `Mode:` then two outline buttons, indicating active state with `variant="secondary"`.

### 4) `src/components/file-picker.tsx`
- Add `mode: 'image' | 'audio'` prop.
- Title:
  - `image`: “Image → Markdown OCR” (current string)
  - `audio`: “Audio → Markdown”
- Accept string:
  - `image`: `image/jpeg,image/png`
  - `audio`: `audio/*`
- Helper text under dropzone updates per mode.
- No other structural changes; keep mirroring to native input and selected file tags.

### 5) `src/components/request-card.tsx`
- Read `card.mode`:
  - If `image`: keep current filename header (first … last +N more) and trailing `N files`.
  - If `audio`: render only a single filename badge (the one file) and omit the `N files` counter.
- All action buttons and token display remain unchanged.

### 6) `src/app/page.tsx` (orchestrator)
Additions & edits (preserve existing behavior unless stated):

State and persistence:
```ts
const [mode, setMode] = useState<'image' | 'audio'>(() =>
  (localStorage.getItem(STORAGE_KEYS.PIPELINE_MODE) as 'image' | 'audio') || 'image'
);
useEffect(() => {
  try { localStorage.setItem(STORAGE_KEYS.PIPELINE_MODE, mode); } catch {}
}, [mode]);

const DEFAULT_PROMPT_IMAGE = /* existing DEFAULT_PROMPT */
const DEFAULT_PROMPT_AUDIO = /* exact block above */

// per-mode prompt load/save
useEffect(() => {
  const key = mode === 'audio' ? STORAGE_KEYS.PROMPT_AUDIO : STORAGE_KEYS.PROMPT_DEFAULT;
  const saved = localStorage.getItem(key);
  setPrompt(saved ?? (mode === 'audio' ? DEFAULT_PROMPT_AUDIO : DEFAULT_PROMPT_IMAGE));
}, [mode]);

useEffect(() => {
  const key = mode === 'audio' ? STORAGE_KEYS.PROMPT_AUDIO : STORAGE_KEYS.PROMPT_DEFAULT;
  localStorage.setItem(key, prompt);
}, [mode, prompt]);
```

Toggle UI placement:
- Place `ModeToggle` above the `FilePicker` in the left column.

File picking & validation:
- Update `onPickFiles` to branch by `mode`.
- Audio branch:
  - Filter by `file.type.startsWith('audio/')` OR extension in the allow‑list.
  - Enforce `size <= 20 * 1024 * 1024`.
  - Enforce `max 10` (slice and toast if exceeded).

Submit behavior:
- Replace `submit` with branching logic:
  - Image mode: unchanged (create one card with all images, pass all to stream).
  - Audio mode: for each file `f` create a separate card with `mode: 'audio'` then invoke the stream for that card immediately. After enqueuing all, clear the picker.

Streaming function:
- Either rename `runOcrStream` → `runPipelineStream` or add a `kind` parameter. Keep the implementation in the same file for now.
- Media type derivation for each file:

```ts
function getMediaType(file: File): string {
  const t = file.type?.trim();
  if (t) return t;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) return 'application/octet-stream';
  const map: Record<string,string> = {
    mp3: 'audio/mp3', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac',
    ogg: 'audio/ogg', flac: 'audio/flac', aiff: 'audio/aiff', aif: 'audio/aiff',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  };
  return map[ext] ?? 'application/octet-stream';
}
```

- Build `content` parts the same way you do today; for audio cards there is exactly one file.
- Keep `streamText` and usage extraction logic exactly as in current code.

Retry/Cancel:
- Unchanged. Each audio card has `filesBlob` with a single file; retry works.

Can Submit gate:
- Replace with `const canSubmit = files.length > 0 && prompt.trim().length > 0 && hasApiKey;` (unchanged) – behavior remains correct in both modes.

### 7) README update
- Add a new “Audio mode” section documenting supported audio types, 20 MB per‑file limit, 10 files per submit, and that all run concurrently with potential 429s if limits are exceeded.

## Error Handling & Toast Copy (exact strings)
- Exceeded selection cap: `Only first 10 audio files kept.` (warning)
- Oversize audio: `Audio over 20 MB isn’t supported inline. Trim/compress and retry.` (warning)
- Wrong type: `Unsupported audio type. Use MP3/WAV/M4A/OGG/FLAC.` (warning)
- Empty response, invalid key, etc.: keep existing messages.

## Accessibility Notes
- `ModeToggle` buttons should have `aria-pressed` and visibly distinct active state.
- Dropzone retains focus and keyboard activation for the “Choose files” button.

## Manual QA Checklist
- Image mode
  - Multiple PNG/JPEG files combine into one request; streaming text appears; token display on finish; Retry works; Cancel transitions to failed.
  - Prompt reset and persistence unaffected.
- Audio mode
  - MP3, M4A, WAV accepted and run; one card per file; streaming shows; Copy/Download/Expand work.
  - Selecting >10 keeps first 10 and toasts.
  - Oversize (>20 MB) shows warning and excludes file.
  - Mixed wrong types (e.g., images in audio mode) are rejected and do not block valid files.
  - Simulate several fast retries; if a 429 occurs, card shows error; retry later succeeds.
- Mode switch
  - Switching mode updates FilePicker title and accept types; leaves existing cards intact.
  - Per‑mode prompt loads/saves correctly; Reset resets only for the current mode.
- LocalStorage
  - Keys present as specified; removing `GEMINI_API_KEY` disables Submit with helpful title (unchanged behavior).

## Performance Considerations
- 10 concurrent audio requests at ≤20 MB each momentarily allocate multiple ArrayBuffers; acceptable for MVP.
- If user devices show memory pressure, consider serializing or small concurrency (queue) as a follow‑up.

## Phase 2 (Future Enhancements)
- Files API path for >20 MB audio (non‑streaming): upload via `@google/genai`, pass `file_uri` to model, show progress indicator and final result.
- Optional audio preview in card and in Result dialog.
- Model selector (e.g., 2.5 Pro) for harder audio.

## Step‑by‑Step Implementation Order (suggested commits)
1) Types, constants, and ModeToggle scaffold
   - Add `mode` to `Card` and constants (storage keys + audio prompt default).
   - Add `ModeToggle` component.
2) Page wiring for mode + per‑mode prompts
   - Persist `PIPELINE_MODE`; swap prompt on mode change; Reset uses per‑mode default.
3) FilePicker mode‑aware accept/labels and audio validation
   - Update props and onPickFiles branching; add 10‑file cap and toasts.
4) Submit branching + concurrent audio runs
   - One card per audio file; start all streams; clear selection after enqueue.
5) Streaming function generalization
   - Media type mapping; keep existing streaming and usage plumbing.
6) RequestCard conditional header for audio cards
   - Single badge; remove multi‑file UI and trailing count in audio mode.
7) README updates
   - Document new mode, limits, and supported formats.
8) Full manual QA pass per checklist.

## Definition of Done
- Toggling modes changes FilePicker and prompt defaults without affecting existing cards.
- Image mode behavior is unchanged.
- Audio mode submits one independent streaming request per selected file (≤10), shows per‑card progress, supports Cancel/Retry, and finishes with usage tokens.
- All specified toasts and validation rules work.
- README documents Audio mode clearly.

---

Appendix A — UI Strings
- Toggle label: `Mode:`
- Buttons: `Image OCR`, `Audio`
- FilePicker titles: `Image → Markdown OCR`, `Audio → Markdown`
- Audio helper text: `Drag & drop MP3/WAV/M4A/OGG/FLAC (≤ 20 MB each), or choose files.`

Appendix B — LocalStorage Keys
- `gemini_api_key` (existing)
- `ocr_default_prompt` (existing for image)
- `ocr_audio_prompt` (new)
- `pipeline_mode` (new)

Appendix C — Notes on Limits
- Inline audio total request size ≤ 20 MB per request; we enforce per‑file since audio is one file per request in this UX.
- Supported audio MIME types include WAV/MP3/AIFF/AAC/OGG/FLAC; see the Audio Understanding page.
- Free tier rate limit is 10 RPM for Gemini 2.5 Flash as of 2025‑09‑10; concurrent submits may hit 429 — use card Retry.

Appendix D — Pseudocode for Audio Submit
```ts
if (mode === 'audio') {
  const items = files.slice(0, 10);
  for (const f of items) {
    const id = addProcessingCard({
      mode: 'audio',
      prompt,
      files: [{ name: f.file.name, size: f.file.size, type: f.file.type }],
      filesBlob: [{ file: f.file }],
    });
    runPipelineStream(id, buildFormData(prompt, [f.file]), { showErrorToast: true });
  }
  clearAllFiles();
}
```

Appendix E — Testing Snippets
- Prepare three small audio files (mp3 ~1–2MB) and one >20MB file; attempt submit; verify results and toasts.

End of plan.
