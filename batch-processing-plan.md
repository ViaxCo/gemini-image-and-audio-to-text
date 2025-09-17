## Goals

- Batch large image uploads into capped groups (default 10 files/request) with rate-limited dispatch (default 10 requests/minute).
- Stream partial results in original page order as batches finish, ensuring retries slot results correctly.
- Provide per-sub-request controls (retry/cancel) while keeping UI responsive for thousands of pages.
- Add scrollable UI for large selected-file lists and request history, using shadcn/ui components.
- Make batch sizing and rate limits configurable.

## Core Changes by Area

### 1. Shared Config & Utilities

- Add `src/config/batch.ts` exporting defaults and optional env overrides:
  - `MAX_FILES_PER_REQUEST` (default 10).
  - `MAX_REQUESTS_PER_MINUTE` (default 10).
  - `REQUEST_WAVE_COOLDOWN_MS` derived from limits (e.g., `Math.ceil(60_000 / MAX_REQUESTS_PER_MINUTE)`).
- Document override expectations (e.g., environment variables) in inline comments plus README note.
- Create batching helpers in `src/lib/stream-utils.ts` (or new file):
  - `chunkFiles(files, size)` returning ordered slices with metadata.
  - `formatBatchLabel({ startIndex, endIndex })` for UI (e.g., `Request 11–20`).
  - `appendUsageTotals(existing, delta)` to aggregate token counts safely.

### 2. Types & State

- Extend `Card` in `src/types.ts` with batch metadata:

  ```ts
  isBatch?: boolean;
  totalFiles?: number;
  batchSize?: number;
  batchConfig?: {
    maxFilesPerRequest: number;
    maxRequestsPerMinute: number;
  };
  subRequests?: Array<{
    id: string;
    index: number;
    label: string;
    status: "queued" | "running" | "complete" | "failed" | "canceled";
    fileCount: number;
    resultText?: string;
    error?: string;
    usage?: Usage;
    startedAt?: number;
    finishedAt?: number;
  }>;
  completedPrefixCount?: number;
  combinedText?: string;
  pendingRetryCount?: number;
  nextWaveEta?: number | null;
  ```

- Update downstream card consumers (`RequestsSection`, `ResultDialog`, etc.) to handle new fields defensively.

### 3. Streaming Layer Refactor

- In `src/hooks/use-stream-runner.ts`, reorganize Gemini call logic:
  - Extract a `createStreamRunner()` that accepts callbacks for start/delta/finish/error and returns `{ run, cancel }`.
  - Maintain FormData creation outside to avoid buffering duplicates.
  - Ensure deltas are pushed to arrays (`chunks.push(deltaRaw)`) and only joined when storing `resultText` to minimize reallocation.
- Keep legacy single-request path by building a thin wrapper around the new runner when `isBatch` is false.

### 4. Submission Flow (`use-submit-actions.ts`)

- Detect `mode === "image"` and `files.length > MAX_FILES_PER_REQUEST`.
- Create a batch card via `addProcessingCard` with `isBatch=true`, `subRequests` seeded to `queued`, `combinedText=""`, and `completedPrefixCount=0`.
- Partition files using helper; for each chunk generate `subRequest` descriptors with unique IDs (prefixed by parent card ID).
- Introduce a scheduler:
  - Manage a request queue (FIFO) and a set of active requests limited to `MAX_REQUESTS_PER_MINUTE`.
  - After launching a wave, compute `nextWaveEta = startedAt + REQUEST_WAVE_COOLDOWN_MS`; store on card so UI can render countdown.
  - Await both wave completion and cooldown timer before enqueuing next set.

### 5. Scheduler Execution & Callbacks

- For each sub-request:
  - Build FormData containing prompt plus that chunk’s files.
  - Invoke runner with callbacks to update:
    - `subRequests[index].status` transitions (`running` → `complete/failed`).
    - Append delta chunks to a per-index array; on finish set `resultText = chunks.join("")`.
    - On success: recompute `completedPrefixCount` to the largest contiguous index with text, then rebuild `combinedText` by joining `resultText` for indices `< completedPrefixCount`.
    - Update `Card.resultText` with the new combined text, while leaving trailing partials hidden until contiguous.
    - Aggregate usage totals and store on card.
    - Clear `pendingRetryCount` when queue drains.
  - On error: store message, set status `failed`, increment `pendingRetryCount`, keep combined text unchanged except for finished prefix.
  - On abort: mark `canceled`, remove chunk contributions, and adjust prefix if necessary.

### 6. Retry & Cancel Logic

- Map `controllersRef` to nested IDs so parent “Cancel” loops through all active controllers for that card.
- Add `onRetrySubRequest(cardId, subRequestId)` to requeue only failed sub-requests:
  - Reset its status to `queued`, clear error/result text, insert into scheduler queue respecting order.
  - Re-run scheduling cycle, preserving existing completed text.
- Parent “Retry” button can trigger retries for all failed sub-requests; disable when none pending.
- Ensure that successful sub-requests are not re-sent unless user explicitly clears and resubmits.

### 7. UI Updates

#### Requests List

- In `src/components/request-card.tsx`:
  - Display batch badges (e.g., “Batch: 200 files • 20 requests”), current wave progress, countdown (`nextWaveEta`).
  - Present sub-request table inside a shadcn `ScrollArea` (fetch via MCP). Each row: label, file count, status badge, retry button (visible for `failed`).
  - Maintain accessibility: semantic list or table markup, `aria-live` polite updates for progress.
  - For large batches, virtualize rows if performance suffers (fallback: limit DOM by lazy-rendering collapsed sections until expanded).
  - Ensure mobile layout stacks metadata vertically with `space-y` while desktop uses `md:flex` split.

#### File Picker

- Wrap selected file chips in `ScrollArea` once list height exceeds threshold.
  - Keep 100% width, `max-h-48 sm:max-h-64`, add subtle border.
  - Confirm keyboard navigation still works (focusable removal buttons).
- Provide count summary including batches (e.g., “1000 files (100 requests planned)”).

#### Result Dialog

- Show combined text from `Card.combinedText ?? Card.resultText`.
- Add metadata list: `Total files`, `Requests launched`, `Completed`, `Retries pending`.
- Offer copy/download from combined text only.

### 8. Performance Considerations

- Release Blob URLs promptly after upload processing to avoid leaking memory (`URL.revokeObjectURL`).
- Throttle UI updates:
  - Batch `setCards` updates via functional state updates and `requestAnimationFrame` wrappers to avoid re-render storms.
  - Only recompute combined text when contiguous prefix advances (skip redundant joins).
- For huge batches, consider storing combined text as array of strings and deriving `resultText` lazily for display (avoid keeping duplicate strings).
- Monitor concurrent FormData usage—clear references once request enqueued to allow GC.

### 9. Telemetry & Toasts

- Update toast messaging to highlight staged progress (e.g., “Requests 1–10 sent. Next wave in 60s”).
- Surface failure summary toast listing first few failed labels with guidance to retry individually.

### 10. Documentation & Configuration Notes

- README/AGENTS update: describe batching behaviour, configuration knobs, retry semantics, and known Gemini limits.
- Mention `npm run pretest` requirement after implementing changes (even though not implementing tests).
- Outline rollback plan: instruct how to disable batching via config (set max files/request to very large and rate to high for debug).

### 11. Validation Checklist (No Automated Tests)

- Manual scenarios to execute post-implementation:
  1. ≤10 images: behaves like existing flow.
  2. 25 images: observe two waves (10, 10, 5) and countdown between waves.
  3. 200 images: confirm streaming begins for first pages while later waves pending.
  4. Induce sub-request failure (mock error): ensure retry button replays only failed chunk, combined output consistent.
  5. Cancel mid-wave: active requests abort, statuses switch to canceled, combined text trimmed appropriately.
  6. Large file list in picker shows scrollable area and remains responsive.

## Delivery Notes

- Keep code readable with short helper functions and minimal branching; add comments only for non-obvious scheduling behaviour.
- Avoid introducing tests per user request.
- After coding session, remember to run `npm run pretest` to satisfy project policy.
