"use client";

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { FileItem } from "@/components/file-picker";
import {
  type BatchConfig,
  batchConfig as defaultBatchConfig,
} from "@/config/batch";
import {
  appendUsageTotals,
  buildFormData,
  chunkFiles,
  formatBatchLabel,
} from "@/lib/stream-utils";
import { computeUsageTotal } from "@/lib/utils";
import type { Card, SubRequest, Usage } from "@/types";

type RunnerCallbacks = {
  onStart?: (opts: { prompt: string; files: File[] }) => void;
  onChunk?: (chunk: string) => void;
  onFinish?: (opts: {
    text: string;
    usage?: Usage;
    totalUsage?: Usage;
    response?: unknown;
  }) => void;
  onError?: (message: string) => void;
  onAbort?: () => void;
};

type StreamRunnerFactory = (
  streamId: string,
  callbacks?: RunnerCallbacks,
  options?: { showErrorToast?: boolean },
) => {
  run: (form: FormData) => Promise<void>;
  cancel: () => void;
};

type BatchContext = {
  cardId: string;
  prompt: string;
  config: BatchConfig;
  filesBySubId: Record<string, File[]>;
  order: string[];
  schedulerActive: boolean;
  cooldownHandle: ReturnType<typeof setTimeout> | null;
  pendingText: Record<string, string[]>;
};

const CANCELLED_MESSAGE = "Canceled";

function hydrateBatchCard(card: Card): Card {
  if (!card.isBatch || !card.subRequests) return card;
  const sorted = [...card.subRequests].sort((a, b) => a.index - b.index);
  let completedPrefixCount = 0;
  let prefixBroken = false;
  const combinedParts: string[] = [];

  for (const sub of sorted) {
    if (!prefixBroken) {
      const isNext = sub.index === completedPrefixCount;
      if (isNext && sub.status === "complete" && sub.resultText) {
        completedPrefixCount += 1;
      } else if (isNext) {
        prefixBroken = true;
      } else if (sub.index > completedPrefixCount) {
        prefixBroken = true;
      }
    }

    let part = "";
    if (sub.status === "complete" && sub.resultText) {
      part = sub.resultText;
    } else if (sub.status === "failed" && sub.resultText) {
      part = `${sub.resultText}\n[${sub.label} failed - retry to complete this section]\n`;
    } else if (sub.status === "failed") {
      part = `[${sub.label} failed - retry to complete this section]\n`;
    } else if (sub.status === "canceled") {
      part = `[${sub.label} canceled]\n`;
    }

    if (part) {
      const normalized = combinedParts.length
        ? part.startsWith("\n\n")
          ? part
          : part.startsWith("\n")
            ? `\n${part}`
            : `\n\n${part}`
        : part;
      combinedParts.push(normalized);
    }
  }

  const combinedText = combinedParts.join("");
  const pendingRetryCount = sorted.filter(
    (sub) => sub.status === "failed",
  ).length;
  const anyQueuedOrRunning = sorted.some(
    (sub) => sub.status === "queued" || sub.status === "running",
  );
  const allComplete =
    sorted.length > 0 && sorted.every((sub) => sub.status === "complete");
  const firstError = sorted.find(
    (sub) => sub.status === "failed" && sub.error,
  )?.error;

  return {
    ...card,
    combinedText,
    completedPrefixCount,
    pendingRetryCount,
    error: firstError,
    resultText: combinedText,
    status:
      allComplete && pendingRetryCount === 0
        ? "complete"
        : anyQueuedOrRunning
          ? "processing"
          : pendingRetryCount > 0
            ? "failed"
            : card.status,
    nextWaveEta:
      anyQueuedOrRunning || pendingRetryCount > 0
        ? (card.nextWaveEta ?? null)
        : null,
  };
}

function patchSubRequests(
  card: Card,
  updates: Record<string, Partial<SubRequest>>,
): Card {
  if (!card.subRequests) return card;
  const subRequests = card.subRequests.map((sub) =>
    updates[sub.id] ? { ...sub, ...updates[sub.id] } : sub,
  );
  return { ...card, subRequests };
}

export function useSubmitActions(opts: {
  mode: "image" | "audio";
  prompt: string;
  files: FileItem[];
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  controllersRef: MutableRefObject<Record<string, AbortController | undefined>>;
  clearAllFiles: () => void;
  addToast: (m: string, v: "success" | "warning" | "destructive") => void;
  createStreamRunner: StreamRunnerFactory;
}) {
  const {
    mode,
    prompt,
    files,
    cards,
    setCards,
    controllersRef,
    clearAllFiles,
    addToast,
    createStreamRunner,
  } = opts;

  const cardsRef = useRef<Card[]>(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const batchesRef = useRef<Record<string, BatchContext>>({});

  const applyToCard = useCallback(
    (cardId: string, mutator: (card: Card) => Card) => {
      setCards((prev) => {
        const next = prev.map((card) =>
          card.id === cardId ? mutator(card) : card,
        );
        cardsRef.current = next;
        return next;
      });
    },
    [setCards],
  );

  const addProcessingCard = useCallback(
    (
      args: Pick<Card, "prompt" | "files"> & {
        id?: string;
        mode?: "image" | "audio";
        filesBlob?: { file: File }[];
        extra?: Partial<Card>;
      },
    ) => {
      const id = args.id ?? crypto.randomUUID();
      const createdAt = Date.now();
      setCards((prev) => {
        const card: Card = {
          id,
          mode: args.mode,
          prompt: args.prompt,
          files: args.files,
          filesBlob: args.filesBlob,
          status: "processing",
          createdAt,
          ...(args.extra ?? {}),
        } as Card;
        const next = [card, ...prev];
        cardsRef.current = next;
        return next;
      });
      return id;
    },
    [setCards],
  );

  const updateCardUsage = useCallback((card: Card, usageDelta?: Usage) => {
    if (!usageDelta) return card;
    const usage = appendUsageTotals(card.usage, usageDelta);
    return {
      ...card,
      usage,
      usageTotal: computeUsageTotal(usage),
    } as Card;
  }, []);

  const scheduleBatches = useCallback(
    async (cardId: string) => {
      const ctx = batchesRef.current[cardId];
      if (!ctx || ctx.schedulerActive) return;
      if (!ctx.pendingText) ctx.pendingText = {};
      ctx.schedulerActive = true;

      const runWave = async () => {
        while (true) {
          const card = cardsRef.current.find((c) => c.id === cardId);
          if (!card || !card.subRequests) break;

          const queued = card.subRequests.filter(
            (sub) => sub.status === "queued",
          );
          if (queued.length === 0) {
            ctx.schedulerActive = false;
            if (card.nextWaveEta) {
              applyToCard(cardId, (current) => ({
                ...current,
                nextWaveEta: null,
              }));
            }
            return;
          }

          const wave = queued.slice(0, ctx.config.maxRequestsPerMinute);
          const hasMore = queued.length > wave.length;
          const startedAt = Date.now();

          applyToCard(cardId, (current) => {
            const updates: Record<string, Partial<SubRequest>> = {};
            for (const sub of wave) {
              updates[sub.id] = {
                status: "running",
                startedAt,
                error: undefined,
              };
            }
            const patched = patchSubRequests(current, updates);
            return {
              ...hydrateBatchCard(patched),
              nextWaveEta: hasMore
                ? startedAt + ctx.config.requestWaveCooldownMs
                : null,
            };
          });

          await Promise.allSettled(
            wave.map(async (sub) => {
              const filesForSub = ctx.filesBySubId[sub.id];
              if (!filesForSub?.length) {
                applyToCard(cardId, (current) =>
                  hydrateBatchCard(
                    patchSubRequests(current, {
                      [sub.id]: {
                        status: "failed",
                        error: "Missing chunk files",
                        finishedAt: Date.now(),
                      },
                    }),
                  ),
                );
                return;
              }

              ctx.pendingText[sub.id] = [];

              const runner = createStreamRunner(
                sub.id,
                {
                  onChunk: (chunk) => {
                    let buffer = ctx.pendingText[sub.id];
                    if (!buffer) {
                      buffer = [];
                      ctx.pendingText[sub.id] = buffer;
                    }
                    buffer.push(chunk);
                    const partial = buffer.join("");
                    if (!partial) return;
                    applyToCard(cardId, (current) =>
                      hydrateBatchCard(
                        patchSubRequests(current, {
                          [sub.id]: {
                            resultText: partial,
                          },
                        }),
                      ),
                    );
                  },
                  onFinish: ({ text, usage }) => {
                    const buffer = ctx.pendingText[sub.id];
                    const buffered = buffer ? buffer.join("") : "";
                    delete ctx.pendingText[sub.id];
                    const finalText = text?.length ? text : buffered;
                    applyToCard(cardId, (current) => {
                      const next = patchSubRequests(current, {
                        [sub.id]: {
                          status: "complete",
                          resultText: finalText,
                          usage,
                          finishedAt: Date.now(),
                          error: undefined,
                        },
                      });
                      const withUsage = updateCardUsage(next, usage);
                      return hydrateBatchCard(withUsage);
                    });
                  },
                  onError: (message) => {
                    const buffer = ctx.pendingText[sub.id];
                    const buffered = buffer ? buffer.join("") : "";
                    delete ctx.pendingText[sub.id];
                    applyToCard(cardId, (current) =>
                      hydrateBatchCard(
                        patchSubRequests(current, {
                          [sub.id]: {
                            status: "failed",
                            error: message,
                            finishedAt: Date.now(),
                            ...(buffered ? { resultText: buffered } : {}),
                          },
                        }),
                      ),
                    );
                  },
                  onAbort: () => {
                    const buffer = ctx.pendingText[sub.id];
                    const buffered = buffer ? buffer.join("") : "";
                    delete ctx.pendingText[sub.id];
                    applyToCard(cardId, (current) =>
                      hydrateBatchCard(
                        patchSubRequests(current, {
                          [sub.id]: {
                            status: "canceled",
                            error: CANCELLED_MESSAGE,
                            finishedAt: Date.now(),
                            ...(buffered ? { resultText: buffered } : {}),
                          },
                        }),
                      ),
                    );
                  },
                },
                { showErrorToast: true },
              );

              await runner.run(buildFormData(ctx.prompt, filesForSub));
            }),
          );

          if (hasMore) {
            await new Promise<void>((resolve) => {
              ctx.cooldownHandle = setTimeout(() => {
                ctx.cooldownHandle = null;
                resolve();
              }, ctx.config.requestWaveCooldownMs);
            });
          }
        }

        ctx.schedulerActive = false;
      };

      try {
        await runWave();
      } finally {
        ctx.schedulerActive = false;
      }
    },
    [applyToCard, createStreamRunner, updateCardUsage],
  );

  const submit = useCallback(async () => {
    if (mode === "audio") {
      const items = files.slice(0, 10);
      const runs: Promise<void>[] = [];
      for (const { file } of items) {
        const id = addProcessingCard({
          mode: "audio",
          prompt,
          files: [{ name: file.name, size: file.size, type: file.type }],
          filesBlob: [{ file }],
        });

        const runner = createStreamRunner(
          id,
          {
            onChunk: (chunk) =>
              applyToCard(id, (card) => ({
                ...card,
                resultText: (card.resultText || "") + chunk,
              })),
            onFinish: ({ text, usage }) =>
              applyToCard(id, (card) => ({
                ...card,
                status: "complete",
                resultText: text,
                usage,
                usageTotal: computeUsageTotal(usage),
                error: undefined,
              })),
            onError: (message) =>
              applyToCard(id, (card) => ({
                ...card,
                status: "failed",
                error: message,
              })),
            onAbort: () =>
              applyToCard(id, (card) => ({
                ...card,
                status: "failed",
                error: CANCELLED_MESSAGE,
              })),
          },
          { showErrorToast: true },
        );

        runs.push(runner.run(buildFormData(prompt, [file])));
      }
      clearAllFiles();
      await Promise.allSettled(runs);
      return;
    }

    const imageFiles = files.map((item) => item.file);
    const fileMetas = files.map((item) => ({
      name: item.file.name,
      size: item.file.size,
      type: item.file.type,
    }));

    const config = defaultBatchConfig;

    if (imageFiles.length > config.maxFilesPerRequest) {
      const chunks = chunkFiles(imageFiles, config.maxFilesPerRequest);
      const batchId = crypto.randomUUID();
      const subRequests: SubRequest[] = chunks.map((chunk, index) => ({
        id: `${batchId}:${index}`,
        index,
        label: formatBatchLabel({
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
        }),
        status: "queued",
        fileCount: chunk.files.length,
      }));

      const id = addProcessingCard({
        id: batchId,
        mode: "image",
        prompt,
        files: fileMetas,
        filesBlob: imageFiles.map((f) => ({ file: f })),
        extra: {
          isBatch: true,
          totalFiles: imageFiles.length,
          batchSize: config.maxFilesPerRequest,
          batchConfig: {
            maxFilesPerRequest: config.maxFilesPerRequest,
            maxRequestsPerMinute: config.maxRequestsPerMinute,
          },
          subRequests,
          combinedText: "",
          completedPrefixCount: 0,
          pendingRetryCount: 0,
          nextWaveEta: null,
        },
      });

      const filesBySubId: Record<string, File[]> = {};
      chunks.forEach((chunk, index) => {
        filesBySubId[subRequests[index].id] = chunk.files;
      });
      batchesRef.current[id] = {
        cardId: id,
        prompt,
        config,
        filesBySubId,
        order: chunks.map((_, index) => `${id}:${index}`),
        schedulerActive: false,
        cooldownHandle: null,
        pendingText: {},
      };

      clearAllFiles();
      scheduleBatches(id);
      return;
    }

    const singleId = addProcessingCard({
      mode: "image",
      prompt,
      files: fileMetas,
      filesBlob: imageFiles.map((f) => ({ file: f })),
    });
    clearAllFiles();

    const runner = createStreamRunner(
      singleId,
      {
        onChunk: (chunk) =>
          applyToCard(singleId, (card) => ({
            ...card,
            resultText: (card.resultText || "") + chunk,
          })),
        onFinish: ({ text, usage }) =>
          applyToCard(singleId, (card) => ({
            ...card,
            status: "complete",
            resultText: text,
            usage,
            usageTotal: computeUsageTotal(usage),
            error: undefined,
          })),
        onError: (message) =>
          applyToCard(singleId, (card) => ({
            ...card,
            status: "failed",
            error: message,
          })),
        onAbort: () =>
          applyToCard(singleId, (card) => ({
            ...card,
            status: "failed",
            error: CANCELLED_MESSAGE,
          })),
      },
      { showErrorToast: true },
    );

    try {
      await runner.run(buildFormData(prompt, imageFiles));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      applyToCard(singleId, (card) => ({
        ...card,
        status: "failed",
        error: message,
      }));
      addToast(`Failed: ${message}`, "destructive");
    }
  }, [
    mode,
    files,
    prompt,
    addProcessingCard,
    clearAllFiles,
    createStreamRunner,
    applyToCard,
    scheduleBatches,
    addToast,
  ]);

  const retrySubRequest = useCallback(
    (cardId: string, subRequestId: string) => {
      const ctx = batchesRef.current[cardId];
      if (!ctx) {
        addToast("Batch context missing for retry", "destructive");
        return;
      }
      const filesForSub = ctx.filesBySubId[subRequestId];
      if (!filesForSub?.length) {
        addToast("Original files unavailable for retry", "destructive");
        return;
      }
      ctx.pendingText[subRequestId] = [];
      applyToCard(cardId, (current) =>
        hydrateBatchCard(
          patchSubRequests(current, {
            [subRequestId]: {
              status: "queued",
              error: undefined,
              resultText: undefined,
              usage: undefined,
              startedAt: undefined,
              finishedAt: undefined,
            },
          }),
        ),
      );
      scheduleBatches(cardId);
    },
    [addToast, applyToCard, scheduleBatches],
  );

  const retry = useCallback(
    async (card: Card) => {
      if (card.isBatch && card.subRequests?.length) {
        const failed = card.subRequests.filter(
          (sub) => sub.status === "failed",
        );
        if (failed.length === 0) return;
        for (const sub of failed) retrySubRequest(card.id, sub.id);
        return;
      }
      if (!card.filesBlob?.length) {
        alert("Original files not available for retry.");
        return;
      }
      const runner = createStreamRunner(
        card.id,
        {
          onChunk: (chunk) =>
            applyToCard(card.id, (current) => ({
              ...current,
              resultText: (current.resultText || "") + chunk,
            })),
          onFinish: ({ text, usage }) =>
            applyToCard(card.id, (current) => ({
              ...current,
              status: "complete",
              resultText: text,
              usage,
              usageTotal: computeUsageTotal(usage),
              error: undefined,
            })),
          onError: (message) =>
            applyToCard(card.id, (current) => ({
              ...current,
              status: "failed",
              error: message,
            })),
          onAbort: () =>
            applyToCard(card.id, (current) => ({
              ...current,
              status: "failed",
              error: CANCELLED_MESSAGE,
            })),
        },
        { showErrorToast: false },
      );

      applyToCard(card.id, (current) => ({
        ...current,
        status: "processing",
        resultText: undefined,
        error: undefined,
        usage: undefined,
        usageTotal: undefined,
        createdAt: Date.now(),
      }));

      try {
        await runner.run(
          buildFormData(
            card.prompt,
            card.filesBlob.map((f) => f.file),
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        applyToCard(card.id, (current) => ({
          ...current,
          status: "failed",
          error: message,
        }));
      }
    },
    [applyToCard, createStreamRunner, retrySubRequest],
  );

  const cancelCard = useCallback(
    (card: Card) => {
      if (card.isBatch) {
        const ctx = batchesRef.current[card.id];
        if (ctx?.cooldownHandle) {
          clearTimeout(ctx.cooldownHandle);
          ctx.cooldownHandle = null;
        }
        if (ctx) ctx.schedulerActive = false;

        Object.entries(controllersRef.current).forEach(([key, controller]) => {
          if (key.startsWith(`${card.id}:`)) controller?.abort();
        });

        applyToCard(card.id, (current) => {
          if (!current.subRequests) return current;
          const updates: Record<string, Partial<SubRequest>> = {};
          current.subRequests.forEach((sub) => {
            if (sub.status === "queued") {
              updates[sub.id] = {
                status: "canceled",
                error: CANCELLED_MESSAGE,
                finishedAt: Date.now(),
              };
            }
          });
          return hydrateBatchCard(patchSubRequests(current, updates));
        });
        return;
      }
      controllersRef.current[card.id]?.abort();
    },
    [applyToCard, controllersRef],
  );

  const copy = useCallback(
    async (text?: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        addToast("Copied to clipboard", "success");
      } catch {
        addToast("Failed to copy", "destructive");
      }
    },
    [addToast],
  );

  return {
    submit,
    retry,
    retrySubRequest,
    cancelCard,
    copy,
    addProcessingCard,
  } as const;
}
