"use client";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import type { MutableRefObject } from "react";
import { useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatModelError } from "@/lib/errors";
import type { FullStreamPart, UserContent } from "@/lib/stream-types";
import { getMediaType, normalizeUsage } from "@/lib/stream-utils";
import type { Usage as StreamUsage } from "@/types";

type StreamRunnerCallbacks = {
  onStart?: (opts: { prompt: string; files: File[] }) => void;
  onChunk?: (chunk: string) => void;
  onFinish?: (opts: {
    text: string;
    usage?: StreamUsage;
    totalUsage?: StreamUsage;
    response?: unknown;
  }) => void;
  onError?: (message: string) => void;
  onAbort?: () => void;
};

type StreamRunnerOptions = {
  showErrorToast?: boolean;
};

export function useStreamRunner(opts: {
  controllersRef: MutableRefObject<Record<string, AbortController | undefined>>;
  addToast: (m: string, v: "success" | "warning" | "destructive") => void;
}) {
  const { controllersRef, addToast } = opts;

  const createStreamRunner = useCallback(
    (
      streamId: string,
      callbacks: StreamRunnerCallbacks = {},
      options: StreamRunnerOptions = {},
    ) => {
      const run = async (form: FormData) => {
        let chunks: string[] = [];
        let gotData = false;
        let gotError = false;
        let finished = false;
        try {
          const apiKey =
            localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY)?.trim() || "";
          if (!apiKey) throw new Error("Missing API key");

          const prompt = String(form.get("prompt") ?? "");
          const files = form.getAll("files") as File[];
          if (!files.length) throw new Error("No files provided");

          callbacks.onStart?.({ prompt, files });

          const content: UserContent[] = [{ type: "text", text: prompt }];
          for (const f of files) {
            content.push({
              type: "file",
              data: new Uint8Array(await f.arrayBuffer()),
              mediaType: getMediaType(f),
            });
          }

          const controller = new AbortController();
          controllersRef.current[streamId] = controller;

          const googleByok = createGoogleGenerativeAI({ apiKey });
          const result = streamText({
            model: googleByok("gemini-2.5-flash"),
            messages: [{ role: "user", content }],
            abortSignal: controller.signal,
            onAbort: () => {
              gotError = true;
              callbacks.onAbort?.();
            },
            onFinish({ text, totalUsage, response }) {
              finished = true;
              const usage = normalizeUsage(response, totalUsage);
              const combinedText = text?.length ? text : chunks.join("");
              if (!gotData && !combinedText.trim()) {
                gotError = true;
                const message = "Empty response";
                callbacks.onError?.(message);
                if (options.showErrorToast)
                  addToast("Empty response from model", "destructive");
                return;
              }
              callbacks.onFinish?.({
                text: combinedText,
                usage,
                totalUsage,
                response,
              });
            },
          });

          for await (const part of result.fullStream as AsyncIterable<FullStreamPart>) {
            const type = (part?.type || "").toString();
            if (type === "abort") {
              gotError = true;
              callbacks.onAbort?.();
              continue;
            }
            if (type === "error") {
              gotError = true;
              const message = formatModelError(
                (part as { error?: unknown }).error,
              );
              callbacks.onError?.(message);
              if (options.showErrorToast)
                addToast(`Failed: ${message}`, "destructive");
              continue;
            }
            if (type === "text" || type === "text-delta") {
              const payload =
                (part as { text?: string; delta?: string; textDelta?: string })
                  .text ||
                (part as { text?: string; delta?: string; textDelta?: string })
                  .delta ||
                (part as { text?: string; delta?: string; textDelta?: string })
                  .textDelta ||
                "";
              if (!payload) continue;
              chunks.push(payload);
              callbacks.onChunk?.(payload);
              if (!gotData && payload.trim()) gotData = true;
            }
          }

          if (!gotData && !gotError && !finished) {
            const message = "Empty response";
            callbacks.onError?.(message);
            if (options.showErrorToast)
              addToast("Empty response from model", "destructive");
          }
        } catch (error) {
          const message = formatModelError(error);
          gotError = true;
          callbacks.onError?.(message);
          if (options.showErrorToast)
            addToast(`Failed: ${message}`, "destructive");
        } finally {
          delete controllersRef.current[streamId];
          chunks = [];
        }
      };

      const cancel = () => {
        try {
          controllersRef.current[streamId]?.abort();
        } catch {}
      };

      return { run, cancel } as const;
    },
    [addToast, controllersRef],
  );

  return { createStreamRunner } as const;
}
