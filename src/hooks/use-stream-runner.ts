"use client";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import type React from "react";
import { useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatModelError } from "@/lib/errors";
import type { FullStreamPart, UserContent } from "@/lib/stream-types";
import { getMediaType, normalizeUsage } from "@/lib/stream-utils";
import { computeUsageTotal, updateById } from "@/lib/utils";
import type { Card, Usage as StreamUsage } from "@/types";

export function useStreamRunner(opts: {
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  controllersRef: React.MutableRefObject<
    Record<string, AbortController | undefined>
  >;
  addToast: (m: string, v: "success" | "warning" | "destructive") => void;
}) {
  const { setCards, controllersRef, addToast } = opts;

  const runOcrStream = useCallback(
    async (
      id: string,
      form: FormData,
      { showErrorToast }: { showErrorToast: boolean },
    ) => {
      try {
        const apiKey =
          localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY)?.trim() || "";
        if (!apiKey) throw new Error("Missing API key");

        const prompt = String(form.get("prompt") || "");
        const files = form.getAll("files") as File[];
        if (!files.length) throw new Error("No files provided");

        const content: UserContent[] = [{ type: "text", text: prompt }];
        for (const f of files) {
          content.push({
            type: "file",
            data: new Uint8Array(await f.arrayBuffer()),
            mediaType: getMediaType(f),
          });
        }

        let gotData = false;
        let gotError = false;

        const googleByok = createGoogleGenerativeAI({ apiKey });
        const controller = new AbortController();
        controllersRef.current[id] = controller;
        let finished = false;
        const result = streamText({
          model: googleByok("gemini-2.5-flash"),
          messages: [{ role: "user", content }],
          abortSignal: controller.signal,
          onAbort: () => {
            gotError = true;
            setCards((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, status: "failed", error: "Canceled" } : c,
              ),
            );
          },
          onFinish({ text, totalUsage, response }) {
            finished = true;
            const usage: StreamUsage | undefined = normalizeUsage(
              response,
              totalUsage,
            );

            if (!gotData && text?.trim()) {
              setCards((prev) =>
                updateById(prev, id, (c) => ({
                  resultText: (c.resultText || "") + text,
                })),
              );
              gotData = true;
            }

            if (!gotData && !text?.trim()) {
              setCards((prev) =>
                updateById(prev, id, {
                  status: "failed",
                  error: "Empty response",
                  ...(usage
                    ? { usage, usageTotal: computeUsageTotal(usage) }
                    : {}),
                }),
              );
              if (showErrorToast)
                addToast("Empty response from model", "destructive");
            } else {
              if (usage) {
                const computedTotal = computeUsageTotal(usage);
                setCards((prev) =>
                  updateById(prev, id, {
                    status: "complete",
                    usage,
                    usageTotal: computedTotal,
                  }),
                );
              } else {
                setCards((prev) =>
                  updateById(prev, id, { status: "complete" }),
                );
              }
            }
          },
        });

        for await (const part of result.fullStream as AsyncIterable<FullStreamPart>) {
          const t = (part?.type || "").toString();
          if (t === "abort") {
            gotError = true;
            setCards((prev) =>
              updateById(prev, id, { status: "failed", error: "Canceled" }),
            );
            continue;
          }
          if (t === "error") {
            gotError = true;
            const message = formatModelError(
              (part as { error?: unknown }).error,
            );
            setCards((prev) =>
              updateById(prev, id, { status: "failed", error: message }),
            );
            if (showErrorToast) addToast(`Failed: ${message}`, "destructive");
            continue;
          }
          if (t === "text" || t === "text-delta") {
            const deltaRaw =
              (part as { text?: string; delta?: string; textDelta?: string })
                .text ||
              (part as { text?: string; delta?: string; textDelta?: string })
                .delta ||
              (part as { text?: string; delta?: string; textDelta?: string })
                .textDelta ||
              "";
            if (deltaRaw.trim()) {
              gotData = true;
              setCards((prev) =>
                updateById(prev, id, (c) => ({
                  resultText: (c.resultText || "") + deltaRaw,
                })),
              );
            } else if (deltaRaw) {
              setCards((prev) =>
                updateById(prev, id, (c) => ({
                  resultText: (c.resultText || "") + deltaRaw,
                })),
              );
            }
          }
        }

        if (!gotData && !gotError && !finished) {
          setCards((prev) =>
            prev.map((c) =>
              c.id === id
                ? { ...c, status: "failed", error: "Empty response" }
                : c,
            ),
          );
          addToast("Empty response from model", "destructive");
        }
      } catch (e: unknown) {
        const message = formatModelError(e);
        setCards((prev) =>
          updateById(prev, id, { status: "failed", error: message }),
        );
        if (showErrorToast) addToast(`Failed: ${message}`, "destructive");
      } finally {
        delete controllersRef.current[id];
      }
    },
    [addToast, controllersRef, setCards],
  );

  return { runOcrStream } as const;
}
