"use client";

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { FileItem } from "@/components/file-picker";
import {
  MAX_FILES_PER_REQUEST,
  MAX_IN_FLIGHT_BYTES,
  MAX_REQUESTS_PER_KEY,
} from "@/config/batch";
import { MAX_AUTO_RETRIES } from "@/config/retry";
import { STORAGE_KEYS } from "@/lib/constants";
import { parseKeys } from "@/lib/key-pool";
import { extractPageMarkers } from "@/lib/page-markers";
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

type BatchJob = { subId: string; retryCount: number };

type BatchContext = {
  prompt: string;
  filesBySubId: Record<string, File[]>;
  queue: BatchJob[];
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

function sizeOf(files: File[]) {
  return files.reduce((total, file) => total + file.size, 0);
}

function hasPageMismatchForSingle(text: string, totalFiles: number): boolean {
  const pageInfo = extractPageMarkers(text);
  if (pageInfo.count === 0) return false;
  return pageInfo.count !== totalFiles;
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
  const inFlightRef = useRef({ requests: 0, bytes: 0 });

  useEffect(() => {
    const ids = new Set(cards.map((card) => card.id));
    for (const [cardId, ctx] of Object.entries(batchesRef.current)) {
      if (ids.has(cardId)) continue;
      ctx.queue = [];
      delete batchesRef.current[cardId];
      for (const [key, controller] of Object.entries(controllersRef.current)) {
        if (key.startsWith(`${cardId}:`)) controller?.abort();
      }
    }
  }, [cards, controllersRef]);

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

  const runSingleImage = useCallback(
    async function runSingleImage(
      cardId: string,
      options?: { showErrorToast?: boolean },
    ) {
      const card = cardsRef.current.find((c) => c.id === cardId);
      if (!card?.filesBlob?.length) return;
      const filesToUse = card.filesBlob.map((f) => f.file);
      const runner = createStreamRunner(
        cardId,
        {
          onChunk: (chunk) =>
            applyToCard(cardId, (current) => ({
              ...current,
              resultText: (current.resultText || "") + chunk,
            })),
          onFinish: ({ text, usage }) => {
            const latest = cardsRef.current.find((c) => c.id === cardId);
            if (!latest) return;
            const resolvedText = text ?? latest.resultText ?? "";
            const totalFiles = latest.totalFiles ?? latest.files.length;
            const retryCount = latest.retryCount ?? 0;
            const shouldAutoRetry =
              hasPageMismatchForSingle(resolvedText, totalFiles) &&
              retryCount < MAX_AUTO_RETRIES;

            if (shouldAutoRetry) {
              const nextRetryCount = retryCount + 1;
              applyToCard(cardId, (current) => ({
                ...current,
                status: "processing",
                resultText: undefined,
                error: undefined,
                usage: undefined,
                usageTotal: undefined,
                createdAt: Date.now(),
                retryCount: nextRetryCount,
              }));
              void runSingleImage(cardId, { showErrorToast: false });
              return;
            }

            applyToCard(cardId, (current) => ({
              ...current,
              status: "complete",
              resultText: resolvedText,
              usage,
              usageTotal: computeUsageTotal(usage),
              error: undefined,
            }));
          },
          onError: (message) =>
            applyToCard(cardId, (current) => ({
              ...current,
              status: "failed",
              error: message,
            })),
          onAbort: () =>
            applyToCard(cardId, (current) => ({
              ...current,
              status: "failed",
              error: CANCELLED_MESSAGE,
            })),
        },
        { showErrorToast: options?.showErrorToast ?? true },
      );

      try {
        await runner.run(buildFormData(card.prompt, filesToUse));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        applyToCard(cardId, (current) => ({
          ...current,
          status: "failed",
          error: message,
        }));
        if (options?.showErrorToast) {
          addToast(`Failed: ${message}`, "destructive");
        }
      }
    },
    [addToast, applyToCard, createStreamRunner],
  );

  const runSub = useCallback(
    async (cardId: string, ctx: BatchContext, job: BatchJob) => {
      const { subId, retryCount } = job;
      const files = ctx.filesBySubId[subId];
      const chunks: string[] = [];
      const patchSub = (update: Partial<SubRequest>) =>
        applyToCard(cardId, (current) =>
          hydrateBatchCard(patchSubRequests(current, { [subId]: update })),
        );
      const failSub = (update: Partial<SubRequest>) => {
        const partial = chunks.join("");
        patchSub({
          ...update,
          finishedAt: Date.now(),
          ...(partial ? { resultText: partial } : {}),
        });
      };

      patchSub({ status: "running", startedAt: Date.now(), error: undefined });

      const runner = createStreamRunner(
        subId,
        {
          onChunk: (chunk) => chunks.push(chunk),
          onFinish: ({ text, usage }) => {
            const shouldAutoRetry =
              extractPageMarkers(text).count !== files.length &&
              retryCount < MAX_AUTO_RETRIES;
            applyToCard(cardId, (current) => {
              const update: Partial<SubRequest> = shouldAutoRetry
                ? {
                    status: "queued",
                    resultText: undefined,
                    usage: undefined,
                    startedAt: undefined,
                    finishedAt: undefined,
                    retryCount: retryCount + 1,
                  }
                : {
                    status: "complete",
                    resultText: text,
                    usage,
                    finishedAt: Date.now(),
                    error: undefined,
                  };
              const next = patchSubRequests(current, { [subId]: update });
              return hydrateBatchCard(updateCardUsage(next, usage));
            });
            if (shouldAutoRetry)
              ctx.queue.push({ subId, retryCount: retryCount + 1 });
          },
          onError: (message) => failSub({ status: "failed", error: message }),
          onAbort: () =>
            failSub({ status: "canceled", error: CANCELLED_MESSAGE }),
        },
        { showErrorToast: true },
      );

      await runner.run(buildFormData(ctx.prompt, files));
    },
    [applyToCard, createStreamRunner, updateCardUsage],
  );

  const pumpBatches = useCallback(
    function pumpBatches() {
      const inFlight = inFlightRef.current;
      const keyCount = parseKeys(
        localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY),
      ).length;
      const maxRequests = MAX_REQUESTS_PER_KEY * Math.max(1, keyCount);
      for (const [cardId, ctx] of Object.entries(batchesRef.current)) {
        while (ctx.queue.length) {
          if (inFlight.requests >= maxRequests) return;
          const [job] = ctx.queue;
          const bytes = sizeOf(ctx.filesBySubId[job.subId]);
          if (inFlight.requests && inFlight.bytes + bytes > MAX_IN_FLIGHT_BYTES)
            return;
          ctx.queue.shift();
          inFlight.requests += 1;
          inFlight.bytes += bytes;
          void runSub(cardId, ctx, job).finally(() => {
            inFlight.requests -= 1;
            inFlight.bytes -= bytes;
            pumpBatches();
          });
        }
      }
    },
    [runSub],
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
          extra: {
            retryCount: 0,
          },
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

    if (imageFiles.length > MAX_FILES_PER_REQUEST) {
      const chunks = chunkFiles(imageFiles, MAX_FILES_PER_REQUEST);
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
        retryCount: 0,
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
          batchSize: MAX_FILES_PER_REQUEST,
          subRequests,
          combinedText: "",
          completedPrefixCount: 0,
          pendingRetryCount: 0,
          retryCount: 0,
        },
      });

      const filesBySubId: Record<string, File[]> = {};
      chunks.forEach((chunk, index) => {
        filesBySubId[subRequests[index].id] = chunk.files;
      });
      batchesRef.current[id] = {
        prompt,
        filesBySubId,
        queue: subRequests.map((sub) => ({ subId: sub.id, retryCount: 0 })),
      };

      clearAllFiles();
      pumpBatches();
      return;
    }

    const singleId = addProcessingCard({
      mode: "image",
      prompt,
      files: fileMetas,
      filesBlob: imageFiles.map((f) => ({ file: f })),
      extra: {
        retryCount: 0,
      },
    });
    clearAllFiles();
    await runSingleImage(singleId, { showErrorToast: true });
  }, [
    mode,
    files,
    prompt,
    addProcessingCard,
    clearAllFiles,
    createStreamRunner,
    applyToCard,
    pumpBatches,
    runSingleImage,
  ]);

  const retrySubRequest = useCallback(
    (cardId: string, subRequestId: string) => {
      const ctx = batchesRef.current[cardId];
      if (!ctx) {
        addToast("Batch context missing for retry", "destructive");
        return;
      }
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
              retryCount: 0,
            },
          }),
        ),
      );
      ctx.queue.push({ subId: subRequestId, retryCount: 0 });
      pumpBatches();
    },
    [addToast, applyToCard, pumpBatches],
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
      applyToCard(card.id, (current) => ({
        ...current,
        status: "processing",
        resultText: undefined,
        error: undefined,
        usage: undefined,
        usageTotal: undefined,
        createdAt: Date.now(),
        retryCount: 0,
      }));
      await runSingleImage(card.id, { showErrorToast: false });
    },
    [applyToCard, retrySubRequest, runSingleImage],
  );

  const cancelCard = useCallback(
    (card: Card) => {
      if (card.isBatch) {
        const ctx = batchesRef.current[card.id];
        if (ctx) ctx.queue = [];

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
