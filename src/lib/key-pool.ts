import { APICallError } from "ai";

const RATE_LIMIT_REST_MS = 60_000;
const SERVER_ERROR_REST_MS = 5_000;
const restingUntil = new Map<string, number>();
let cursor = 0;

export function parseKeys(raw: string | null) {
  return [...new Set((raw ?? "").split(/\s+/).filter(Boolean))];
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function takeKey(keys: string[], signal: AbortSignal) {
  while (true) {
    signal.throwIfAborted();
    const now = Date.now();
    for (let offset = 0; offset < keys.length; offset++) {
      const index = (cursor + offset) % keys.length;
      if ((restingUntil.get(keys[index]) ?? 0) <= now) {
        cursor = index + 1;
        return keys[index];
      }
    }
    const nextFree = Math.min(...keys.map((key) => restingUntil.get(key) ?? 0));
    if (nextFree === Number.POSITIVE_INFINITY) {
      throw new Error(
        "All API keys are invalid or out of daily quota. Add another key or reload tomorrow.",
      );
    }
    await wait(nextFree - now, signal);
  }
}

function restMsAfter(error: APICallError) {
  const body = error.responseBody ?? "";
  if (error.statusCode === 429) {
    if (/per.?day/i.test(body)) return Number.POSITIVE_INFINITY;
    const delay = body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/)?.[1];
    return delay ? Number(delay) * 1000 : RATE_LIMIT_REST_MS;
  }
  if (error.statusCode === 403 || body.includes("API_KEY_INVALID"))
    return Number.POSITIVE_INFINITY;
  if (error.isRetryable) return SERVER_ERROR_REST_MS;
}

export function restKeyAfter(key: string, error: unknown) {
  if (!APICallError.isInstance(error)) return false;
  const restMs = restMsAfter(error);
  if (restMs === undefined) return false;
  restingUntil.set(
    key,
    Math.max(restingUntil.get(key) ?? 0, Date.now() + restMs),
  );
  return true;
}
