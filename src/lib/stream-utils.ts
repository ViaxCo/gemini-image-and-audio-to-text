import type { Usage as StreamUsage } from "@/types";

export type FileChunk = {
  files: File[];
  startIndex: number; // zero-based inclusive
  endIndex: number; // zero-based inclusive
};

export function buildFormData(p: string, fs: File[]): FormData {
  const form = new FormData();
  form.append("prompt", p);
  for (const file of fs) form.append("files", file);
  return form;
}

export function chunkFiles(files: File[], size: number): FileChunk[] {
  const safeSize = Math.max(1, size);
  const chunks: FileChunk[] = [];
  for (let i = 0; i < files.length; i += safeSize) {
    const slice = files.slice(i, i + safeSize);
    chunks.push({
      files: slice,
      startIndex: i,
      endIndex: i + slice.length - 1,
    });
  }
  return chunks;
}

export function formatBatchLabel(opts: {
  startIndex: number;
  endIndex: number;
}): string {
  const start = opts.startIndex + 1;
  const end = opts.endIndex + 1;
  return start === end ? `Request ${start}` : `Request ${start}-${end}`;
}

export function getMediaType(file: File): string {
  const t = file.type?.trim();
  if (t) return t;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return "application/octet-stream";
  const map: Record<string, string> = {
    mp3: "audio/mp3",
    m4a: "audio/mp4",
    wav: "audio/wav",
    aac: "audio/aac",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aiff: "audio/aiff",
    aif: "audio/aiff",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  return map[ext] ?? "application/octet-stream";
}

export function appendUsageTotals(
  existing: StreamUsage | undefined,
  delta: StreamUsage | undefined,
): StreamUsage | undefined {
  if (!existing && !delta) return undefined;
  const add = (a?: number, b?: number) => {
    const hasA = typeof a === "number" && Number.isFinite(a);
    const hasB = typeof b === "number" && Number.isFinite(b);
    if (!hasA && !hasB) return undefined;
    return (hasA ? (a ?? 0) : 0) + (hasB ? (b ?? 0) : 0);
  };

  const next: StreamUsage = { ...(existing ?? {}) };

  const inputTokens = add(existing?.inputTokens, delta?.inputTokens);
  if (inputTokens !== undefined) next.inputTokens = inputTokens;
  else if (next.inputTokens === undefined && delta?.inputTokens !== undefined)
    next.inputTokens = delta.inputTokens;

  const outputTokens = add(existing?.outputTokens, delta?.outputTokens);
  if (outputTokens !== undefined) next.outputTokens = outputTokens;
  else if (next.outputTokens === undefined && delta?.outputTokens !== undefined)
    next.outputTokens = delta.outputTokens;

  const reasoningTokens = add(
    existing?.reasoningTokens,
    delta?.reasoningTokens,
  );
  if (reasoningTokens !== undefined) next.reasoningTokens = reasoningTokens;
  else if (
    next.reasoningTokens === undefined &&
    delta?.reasoningTokens !== undefined
  )
    next.reasoningTokens = delta.reasoningTokens;

  const totalTokens =
    add(existing?.totalTokens, delta?.totalTokens) ??
    (typeof inputTokens === "number" || typeof outputTokens === "number"
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined);
  if (totalTokens !== undefined) next.totalTokens = totalTokens;
  else if (next.totalTokens === undefined && delta?.totalTokens !== undefined)
    next.totalTokens = delta.totalTokens;

  return Object.keys(next).length > 0 ? next : undefined;
}

export function normalizeUsage(
  response: unknown | undefined,
  totalUsage: StreamUsage | undefined,
): StreamUsage | undefined {
  if (totalUsage) return totalUsage;
  if (!response) return undefined;
  const googleMeta = (
    response as unknown as {
      providerMetadata?: { google?: { usageMetadata?: unknown } };
    }
  )?.providerMetadata?.google as { usageMetadata?: unknown } | undefined;
  const usageFromProvider = googleMeta?.usageMetadata as
    | {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
        thoughtsTokenCount?: number;
      }
    | undefined;
  if (!usageFromProvider) return undefined;
  return {
    inputTokens: usageFromProvider.promptTokenCount,
    outputTokens: usageFromProvider.candidatesTokenCount,
    totalTokens: usageFromProvider.totalTokenCount,
    reasoningTokens: usageFromProvider.thoughtsTokenCount,
  };
}
