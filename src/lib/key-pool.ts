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

function restingKey(key: string, model: string) {
  return `${model}:${key}`;
}

export async function takeKey(
  keys: string[],
  model: string,
  signal: AbortSignal,
) {
  while (true) {
    signal.throwIfAborted();
    const now = Date.now();
    const freeAt = keys.map(
      (key) => restingUntil.get(restingKey(key, model)) ?? 0,
    );
    for (let offset = 0; offset < keys.length; offset++) {
      const index = (cursor + offset) % keys.length;
      if (freeAt[index] <= now) {
        cursor = index + 1;
        return keys[index];
      }
    }
    const nextFree = Math.min(...freeAt);
    if (nextFree === Number.POSITIVE_INFINITY) {
      throw new Error(
        `None of your API keys can use ${model} now. They are invalid, out of daily quota, or do not have this model. Add another key, pick another model, or try again tomorrow.`,
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
  if (
    error.statusCode === 403 ||
    error.statusCode === 404 ||
    body.includes("API_KEY_INVALID")
  )
    return Number.POSITIVE_INFINITY;
  if (error.isRetryable) return SERVER_ERROR_REST_MS;
}

export function restKeyAfter(key: string, model: string, error: unknown) {
  if (!APICallError.isInstance(error)) return false;
  const restMs = restMsAfter(error);
  if (restMs === undefined) return false;
  const id = restingKey(key, model);
  restingUntil.set(
    id,
    Math.max(restingUntil.get(id) ?? 0, Date.now() + restMs),
  );
  return true;
}
