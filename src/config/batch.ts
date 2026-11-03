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
  {
    min: 1,
    max: 100,
  },
);

export const MAX_REQUESTS_PER_KEY = envInt(
  "NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE",
  5,
  {
    min: 1,
    max: 60,
  },
);

export const MAX_IN_FLIGHT_BYTES = 600 * 1024 * 1024;
