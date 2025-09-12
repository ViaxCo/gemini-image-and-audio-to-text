import type { Usage as StreamUsage } from "@/types";

export function buildFormData(p: string, fs: File[]): FormData {
  const form = new FormData();
  form.append("prompt", p);
  for (const file of fs) form.append("files", file);
  return form;
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
