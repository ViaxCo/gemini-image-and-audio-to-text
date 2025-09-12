"use client";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiKeyBar } from "@/components/api-key-bar";
import { type FileItem, FilePicker } from "@/components/file-picker";
import { ModeToggle } from "@/components/mode-toggle";
import { PromptEditor } from "@/components/prompt-editor";
import { RequestCard } from "@/components/request-card";
import { ResultDialog } from "@/components/result-dialog";
import { Toasts } from "@/components/toasts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToasts } from "@/hooks/use-toasts";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatModelError } from "@/lib/errors";
import { computeUsageTotal, updateById } from "@/lib/utils";
import type { Card, Usage as StreamUsage } from "@/types";

const DEFAULT_PROMPT = `Extract all text from the provided sources, in the numerical order of the sources.

For each source:
	1.	Extract the full text.
	2.	Reconstruct the text into readable paragraphs. A new paragraph should begin where there is a clear break in the original text, such as a new line, indentation, or topic change. Do not merge paragraphs that are clearly separate in the source.
	3.	Ensure each distinct scripture passage is separated from the surrounding text by a blank line. For example, if the text contains "John 3:16" followed by commentary, the scripture should be a separate paragraph.
	4.	After the extracted and formatted text for the source, insert a blank line.
	5.	On the new line, append the page number. Use the printed page number visible in the image. If no page number is visible, infer one based on the order provided (Page 1, Page 2, ...).
	6.	Format the page number as: **Page [number]**
	7.	Format bold text in the source in **bold**.

Example formatting:
[Extracted and formatted text of the source, with paragraphs and scripture passages separated correctly.]

**Page 1**`;

export default function Home() {
  // Important: initialize with a static value for SSR parity. Load saved mode after mount.
  const [mode, setMode] = useState<"image" | "audio">("image");

  const DEFAULT_PROMPT_AUDIO = `Edit the source, correcting all typographical, grammatical, and spelling errors while maintaining the original style and emphasis.

Ensure all biblical references:
- Use exact KJV wording.
- Are explicitly quoted in full including those referenced in passive.
- Formatted in isolation with verse numbers, with the reference line in bold and verses in normal weight, e.g.:

**Genesis 12:2-3 - KJV**
2. And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:
3. And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.

Correct all Hebrew and Greek words with proper transliterations.

Remove all verbal fillers ("uh", "um", etc.) while preserving the complete content and meaning.

Maintain all of the author's:
- Teaching points
- Rhetorical devices
- Emphasis patterns
- Illustrative examples
- Call-and-response elements

Format the text with:
- Consistent punctuation
- Proper capitalization
- Original paragraph structure
- Clear scripture demarcation
- Smart quotes`;

  // Initialize with image default for SSR parity; per-mode saved prompts are loaded after mount.
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toasts, addToast } = useToasts(2400);
  const [rawViewById, setRawViewById] = useState<Record<string, boolean>>({});
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [hasDraftKey, setHasDraftKey] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"image" | "audio" | null>(
    null,
  );
  const controllersRef = useRef<Record<string, AbortController | undefined>>(
    {},
  );

  // Load saved mode once after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PIPELINE_MODE);
      if (saved === "image" || saved === "audio") setMode(saved);
    } catch {}
  }, []);

  // Persist pipeline mode and prompt per-mode
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PIPELINE_MODE, mode);
    } catch {}
  }, [mode]);

  useEffect(() => {
    // On mode change, swap in the saved prompt for that mode or seed with defaults
    try {
      const key =
        mode === "audio"
          ? STORAGE_KEYS.PROMPT_AUDIO
          : STORAGE_KEYS.PROMPT_DEFAULT;
      const saved = localStorage.getItem(key);
      setPrompt(
        saved ?? (mode === "audio" ? DEFAULT_PROMPT_AUDIO : DEFAULT_PROMPT),
      );
    } catch {
      setPrompt(mode === "audio" ? DEFAULT_PROMPT_AUDIO : DEFAULT_PROMPT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    try {
      const key =
        mode === "audio"
          ? STORAGE_KEYS.PROMPT_AUDIO
          : STORAGE_KEYS.PROMPT_DEFAULT;
      localStorage.setItem(key, prompt);
    } catch {}
  }, [mode, prompt]);

  useEffect(() => {
    try {
      const k = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY);
      setHasApiKey(!!k?.trim().length);
    } catch {}
  }, []);

  const onPickFiles = (picked: FileList | null) => {
    if (!picked) return;
    const all = Array.from(picked);

    if (mode === "audio") {
      // accept audio/* or known extensions; cap 10; size <= 20MB
      const allowedExt = new Set([
        "mp3",
        "m4a",
        "wav",
        "aac",
        "ogg",
        "flac",
        "aiff",
        "aif",
      ]);
      let filesToUse = all.filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        const okType =
          f.type.startsWith("audio/") || (ext ? allowedExt.has(ext) : false);
        const okSize = f.size <= 20 * 1024 * 1024;
        if (!okType) return false;
        if (!okSize) {
          addToast(
            "Audio over 20 MB isn’t supported inline. Trim/compress and retry.",
            "warning",
          );
          return false;
        }
        return true;
      });
      if (filesToUse.length > 10) {
        addToast("Only first 10 audio files kept.", "warning");
        filesToUse = filesToUse.slice(0, 10);
      }
      const next: FileItem[] = filesToUse.map((f) => ({ file: f }));
      setFiles((prev) => [...prev, ...next]);
      const rejectedCount = all.length - filesToUse.length;
      if (rejectedCount > 0) {
        addToast(
          "Unsupported audio type. Use MP3/WAV/M4A/OGG/FLAC.",
          "warning",
        );
      }
    } else {
      // image mode (existing behavior)
      const accepted = all.filter(
        (f) =>
          /image\/(jpeg|jpg|png)/.test(f.type) && f.size <= 10 * 1024 * 1024,
      );
      const rejected = all.filter((f) => !accepted.includes(f));
      const next: FileItem[] = accepted.map((f) => ({
        file: f,
        previewUrl: URL.createObjectURL(f),
      }));
      setFiles((prev) => [...prev, ...next]);
      if (rejected.length)
        addToast(
          `${rejected.length} file(s) rejected (type or >10MB).`,
          "warning",
        );
    }
    // input reset handled within FilePicker
  };

  const onDrop: React.DragEventHandler<HTMLElement> = (e) => {
    e.preventDefault();
    onPickFiles(e.dataTransfer.files);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAllFiles = () => {
    // Revoke any object URLs to avoid memory leaks
    try {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    } catch {}
    setFiles([]);
    // input reset handled within FilePicker
  };

  const resetPromptToDefault = () =>
    setPrompt(mode === "audio" ? DEFAULT_PROMPT_AUDIO : DEFAULT_PROMPT);

  const clearAllRequests = () => {
    // Abort inflight streams then clear
    try {
      Object.values(controllersRef.current).forEach((c) => {
        c?.abort();
      });
    } catch {}
    controllersRef.current = {};
    setCards([]);
    setExpandedId(null);
    setRawViewById({});
  };

  const canSubmit = files.length > 0 && prompt.trim().length > 0 && hasApiKey;

  // --- Small reused helpers (preserve exact behavior/messages) ---
  function buildFormData(p: string, fs: File[]): FormData {
    const form = new FormData();
    form.append("prompt", p);
    for (const file of fs) form.append("files", file);
    return form;
  }

  function getMediaType(file: File): string {
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

  function addProcessingCard(
    args: Pick<Card, "prompt" | "files"> & {
      mode?: "image" | "audio";
      filesBlob?: { file: File }[];
    },
  ): string {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    setCards((prev) => [
      {
        id,
        mode: args.mode,
        prompt: args.prompt,
        files: args.files,
        filesBlob: args.filesBlob,
        status: "processing",
        createdAt,
      },
      ...prev,
    ]);
    return id;
  }

  async function runOcrStream(
    id: string,
    form: FormData,
    opts: { showErrorToast: boolean },
  ) {
    try {
      const apiKey =
        localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY)?.trim() || "";
      if (!apiKey) throw new Error("Missing API key");

      const prompt = String(form.get("prompt") || "");
      const files = form.getAll("files") as File[];
      if (!files.length) throw new Error("No files provided");

      type UserContent =
        | { type: "text"; text: string }
        | { type: "file"; data: Uint8Array; mediaType: string };

      const content: UserContent[] = [{ type: "text", text: prompt }];
      for (const f of files) {
        content.push({
          type: "file",
          data: new Uint8Array(await f.arrayBuffer()),
          mediaType: getMediaType(f),
        });
      }

      // Track whether any non-whitespace content has been received
      let gotData = false;
      let gotError = false;

      const googleByok = createGoogleGenerativeAI({ apiKey });
      // Create controller and store for cancel/clear-all
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
          // Prefer normalized totalUsage if available
          let usage: StreamUsage | undefined = totalUsage;
          if (!usage && response) {
            // Fallback: provider-specific usage from Google metadata
            const googleMeta = (
              response as unknown as {
                providerMetadata?: { google?: { usageMetadata?: unknown } };
              }
            )?.providerMetadata?.google as
              | { usageMetadata?: unknown }
              | undefined;
            const usageFromProvider = googleMeta?.usageMetadata as
              | {
                  promptTokenCount?: number;
                  candidatesTokenCount?: number;
                  totalTokenCount?: number;
                  thoughtsTokenCount?: number;
                }
              | undefined;
            if (usageFromProvider) {
              usage = {
                inputTokens: usageFromProvider.promptTokenCount,
                outputTokens: usageFromProvider.candidatesTokenCount,
                totalTokens: usageFromProvider.totalTokenCount,
                reasoningTokens: usageFromProvider.thoughtsTokenCount,
              };
            }
          }

          // If nothing meaningful streamed but final text is present, append it now
          if (!gotData && text?.trim()) {
            setCards((prev) =>
              updateById(prev, id, (c) => ({
                resultMarkdown: (c.resultMarkdown || "") + text,
              })),
            );
            gotData = true;
          }

          // If, after finish, there is still no meaningful content, treat as failure
          if (!gotData && !text?.trim()) {
            setCards((prev) =>
              updateById(prev, id, {
                status: "failed",
                error: "Empty response",
                // Preserve any usage info if available for diagnostics
                ...(usage
                  ? { usage, usageTotal: computeUsageTotal(usage) }
                  : {}),
              }),
            );
            if (opts.showErrorToast)
              addToast("Empty response from model", "destructive");
          } else {
            // Success path: mark complete, attaching usage when available
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
              setCards((prev) => updateById(prev, id, { status: "complete" }));
            }
          }
        },
      });

      type FullStreamPart =
        | { type: "text"; text?: string }
        | { type: "abort" }
        | {
            type: "text-delta";
            text?: string;
            delta?: string;
            textDelta?: string;
          }
        | { type: "error"; error?: unknown }
        | { type: string; [k: string]: unknown };

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
          const message = formatModelError((part as { error?: unknown }).error);
          setCards((prev) =>
            updateById(prev, id, { status: "failed", error: message }),
          );
          if (opts.showErrorToast)
            addToast(`Failed: ${message}`, "destructive");
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
          // Consider only non-whitespace as meaningful output
          if (deltaRaw.trim()) {
            gotData = true;
            setCards((prev) =>
              updateById(prev, id, (c) => ({
                resultMarkdown: (c.resultMarkdown || "") + deltaRaw,
              })),
            );
          } else if (deltaRaw) {
            // Preserve whitespace in the transcript but do not count it as data
            setCards((prev) =>
              updateById(prev, id, (c) => ({
                resultMarkdown: (c.resultMarkdown || "") + deltaRaw,
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
      if (opts.showErrorToast) addToast(`Failed: ${message}`, "destructive");
    } finally {
      // Cleanup controller entry
      delete controllersRef.current[id];
    }
  }

  const submit = async () => {
    if (!canSubmit) return;
    if (mode === "audio") {
      // One card per file, run all concurrently
      const items = files.slice(0, 10);
      const runs: Promise<void>[] = [];
      for (const { file } of items) {
        const id = addProcessingCard({
          mode: "audio",
          prompt,
          files: [{ name: file.name, size: file.size, type: file.type }],
          filesBlob: [{ file }],
        });
        runs.push(
          runOcrStream(id, buildFormData(prompt, [file]), {
            showErrorToast: true,
          }).then(() => void 0),
        );
      }
      clearAllFiles();
      await Promise.allSettled(runs);
    } else {
      // Image mode: one card with all files
      const id = addProcessingCard({
        mode: "image",
        prompt,
        files: files.map((f) => ({
          name: f.file.name,
          size: f.file.size,
          type: f.file.type,
        })),
        filesBlob: files.map((f) => ({ file: f.file })),
      });
      clearAllFiles();
      try {
        await runOcrStream(
          id,
          buildFormData(
            prompt,
            files.map((f) => f.file),
          ),
          { showErrorToast: true },
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setCards((prev) =>
          updateById(prev, id, { status: "failed", error: message }),
        );
        addToast(`Failed: ${message}`, "destructive");
      }
    }
  };

  const retry = async (card: Card) => {
    if (!card.filesBlob?.length) {
      alert("Original files not available for retry.");
      return;
    }
    const id = card.id;
    // Reset this card instead of creating a new one
    setCards((prev) =>
      updateById(prev, id, {
        status: "processing",
        resultMarkdown: undefined,
        error: undefined,
        usage: undefined,
        usageTotal: undefined,
        createdAt: Date.now(),
      }),
    );
    try {
      await runOcrStream(
        id,
        buildFormData(
          card.prompt,
          card.filesBlob.map((f) => f.file),
        ),
        { showErrorToast: false },
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setCards((prev) =>
        updateById(prev, id, { status: "failed", error: message }),
      );
      // Note: intentionally no toast here to preserve previous behavior.
    }
  };

  const copy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      addToast("Copied to clipboard", "success");
    } catch {
      addToast("Failed to copy", "destructive");
    }
  };

  // Derived for dialog usage without non-null assertions
  const selectedCard = useMemo(
    () => cards.find((c) => c.id === (expandedId ?? "")),
    [cards, expandedId],
  );

  return (
    <div className="min-h-dvh w-full p-6 md:p-10">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <ApiKeyBar
            onKeyChange={useCallback((p: boolean) => {
              setHasApiKey(!!p);
            }, [])}
            onStatusChange={useCallback(
              ({
                savedPresent,
                draftPresent,
              }: {
                savedPresent: boolean;
                draftPresent: boolean;
              }) => {
                setHasApiKey(!!savedPresent);
                setHasDraftKey(!!draftPresent);
              },
              [],
            )}
            onToast={(msg, variant) => addToast(msg, variant)}
          />
        </div>
        {/* Left: Inputs */}
        <section className="space-y-4">
          <ModeToggle
            mode={mode}
            onChange={(next) => {
              if (next === mode) return;
              if (files.length > 0) {
                setPendingMode(next);
                setConfirmOpen(true);
                return;
              }
              setMode(next);
            }}
          />
          <FilePicker
            files={files}
            mode={mode}
            onPickFiles={onPickFiles}
            onDrop={onDrop}
            removeFile={removeFile}
            clearAllFiles={clearAllFiles}
          />

          <PromptEditor
            prompt={prompt}
            setPrompt={setPrompt}
            onReset={resetPromptToDefault}
          />

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={submit}
              disabled={!canSubmit}
              title={
                hasApiKey
                  ? undefined
                  : hasDraftKey
                    ? "Press Save in the API key bar to enable Submit"
                    : "Add your Gemini API key to submit"
              }
            >
              Submit
            </Button>
          </div>
        </section>

        {/* Right: Cards */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Requests ({cards.length})</h2>
            {cards.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllRequests}
                aria-label="Clear all requests"
              >
                Clear all
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            {cards.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No requests yet.
              </div>
            )}
            {cards.map((card) => (
              <RequestCard
                key={card.id}
                card={card}
                raw={!!rawViewById[card.id]}
                onToggleRaw={() =>
                  setRawViewById((m) => ({ ...m, [card.id]: !m[card.id] }))
                }
                onCopy={copy}
                onExpand={(id) => setExpandedId(id)}
                onCancel={(id) => {
                  try {
                    controllersRef.current[id]?.abort();
                  } catch {}
                }}
                onRetry={retry}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Confirm clear files on mode switch */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch mode and clear files?</AlertDialogTitle>
            <AlertDialogDescription>
              You have files selected for the current mode. Switching to the
              other mode will clear the selected files to prevent mixing
              incompatible types.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearAllFiles();
                if (pendingMode) setMode(pendingMode);
                setPendingMode(null);
              }}
            >
              Switch & Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result Dialog */}
      <ResultDialog
        openId={expandedId}
        onOpenChange={(open) => {
          if (!open) setExpandedId(null);
        }}
        markdown={selectedCard?.resultMarkdown}
        files={selectedCard?.files}
        raw={!!(expandedId && rawViewById[expandedId])}
        onToggleRaw={() =>
          expandedId &&
          setRawViewById((m) => ({
            ...m,
            [expandedId]: !m[expandedId],
          }))
        }
        onCopy={(text) => copy(text)}
      />

      <Toasts toasts={toasts} />
    </div>
  );
}
