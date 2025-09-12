import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Small math helper used by callers for consistent total computation.
export function computeUsageTotal(usage?: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): number | undefined {
  return (
    usage?.totalTokens ??
    (typeof usage?.inputTokens === "number" &&
    typeof usage?.outputTokens === "number"
      ? usage.inputTokens + usage.outputTokens
      : undefined)
  );
}

// Immutable update helper for arrays of objects keyed by `id`.
export function updateById<T extends { id: string }>(
  list: T[],
  id: string,
  patch: Partial<T> | ((prev: T) => Partial<T>),
): T[] {
  return list.map((item) =>
    item.id === id
      ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
      : item,
  );
}
