// Configuration for client-side batching. Values can be overridden by
// NEXT_PUBLIC_MAX_FILES_PER_REQUEST and NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE in
// `.env.local`. Keep overrides modest; the UI is optimized for hundreds, not
// tens of thousands, of files at once.

type Guard = { min: number; max: number };

function envInt(key: string, fallback: number, guard: Guard) {
  const raw = process.env[key];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= guard.min && parsed <= guard.max)
    return parsed;
  return fallback;
}

export const MAX_FILES_PER_REQUEST = envInt(
  "NEXT_PUBLIC_MAX_FILES_PER_REQUEST",
  10,
  { min: 1, max: 100 },
);

export const MAX_REQUESTS_PER_MINUTE = envInt(
  "NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE",
  10,
  { min: 1, max: 60 },
);

export const REQUEST_WAVE_COOLDOWN_MS = Math.ceil(
  60_000 / Math.max(MAX_REQUESTS_PER_MINUTE, 1),
);

export type BatchConfig = {
  maxFilesPerRequest: number;
  maxRequestsPerMinute: number;
  requestWaveCooldownMs: number;
};

export const batchConfig: BatchConfig = {
  maxFilesPerRequest: MAX_FILES_PER_REQUEST,
  maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
  requestWaveCooldownMs: REQUEST_WAVE_COOLDOWN_MS,
};

export function withBatchOverrides(
  overrides: Partial<Omit<BatchConfig, "requestWaveCooldownMs">> = {},
): BatchConfig {
  const maxFiles = overrides.maxFilesPerRequest ?? MAX_FILES_PER_REQUEST;
  const maxRate = overrides.maxRequestsPerMinute ?? MAX_REQUESTS_PER_MINUTE;
  return {
    maxFilesPerRequest: Math.max(1, maxFiles),
    maxRequestsPerMinute: Math.max(1, maxRate),
    requestWaveCooldownMs: Math.ceil(60_000 / Math.max(1, maxRate)),
  };
}
