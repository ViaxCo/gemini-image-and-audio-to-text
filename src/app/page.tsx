"use client";

import { useEffect, useRef, useState } from "react";
import { type FileItem, FilePicker } from "@/components/file-picker";
import { PromptEditor } from "@/components/prompt-editor";
import {
  RequestCard,
  type Card as RequestCardType,
} from "@/components/request-card";
import { ResultDialog } from "@/components/result-dialog";
import { Toasts } from "@/components/toasts";
import { Button } from "@/components/ui/button";
import { computeUsageTotal, type Usage as StreamUsage } from "@/lib/ai-stream";
import { ApiKeyBar } from "@/components/api-key-bar";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

type Card = {
  id: string;
  prompt: string;
  files: { name: string; size: number; type: string }[];
  filesBlob?: { file: File }[]; // for Retry
  status: "processing" | "complete" | "failed";
  resultMarkdown?: string;
  error?: string;
  createdAt: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
  };
  // Extra guard: store a computed total for display reliability
  usageTotal?: number;
};

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
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<
    {
      id: string;
      msg: string;
      variant?: "success" | "warning" | "destructive";
    }[]
  >([]);
  const [rawViewById, setRawViewById] = useState<Record<string, boolean>>({});
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [hasDraftKey, setHasDraftKey] = useState<boolean>(false);
  const controllersRef = useRef<Record<string, AbortController | undefined>>(
    {},
  );

  useEffect(() => {
    const saved = localStorage.getItem("ocr_default_prompt");
    if (saved) setPrompt(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("ocr_default_prompt", prompt);
  }, [prompt]);

  useEffect(() => {
    try {
      const k = localStorage.getItem("gemini_api_key");
      setHasApiKey(!!(k && k.trim().length));
    } catch {}
  }, []);

  const onPickFiles = (picked: FileList | null) => {
    if (!picked) return;
    const all = Array.from(picked);
    const accepted = all.filter(
      (f) => /image\/(jpeg|jpg|png)/.test(f.type) && f.size <= 10 * 1024 * 1024,
    );
    const rejected = all.filter((f) => !accepted.includes(f));
    const next: FileItem[] = accepted.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    setFiles((prev) => [...prev, ...next]);
    if (rejected.length)
      showToast(
        `${rejected.length} file(s) rejected (type or >10MB).`,
        "warning",
      );
    // input reset handled within FilePicker
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
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

  const resetPromptToDefault = () => setPrompt(DEFAULT_PROMPT);

  const clearAllRequests = () => {
    // Abort inflight streams then clear
    try {
      Object.values(controllersRef.current).forEach((c) => c?.abort());
    } catch {}
    controllersRef.current = {};
    setCards([]);
    setExpandedId(null);
    setRawViewById({});
  };

  const showToast = (
    msg: string,
    variant?: "success" | "warning" | "destructive",
  ) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, msg, variant }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      2400,
    );
  };

  const canSubmit = files.length > 0 && prompt.trim().length > 0 && hasApiKey;

  function formatModelError(err: unknown): string {
    // Based on AI SDK guidance: treat unknown, string, Error, or object
    // and map common Gemini API key errors to a friendly message.
    let msg = "Unknown error";
    if (err == null) msg = "Unknown error";
    else if (typeof err === "string") msg = err;
    else if (err instanceof Error) msg = err.message || "Error";
    else {
      try {
        msg = JSON.stringify(err);
      } catch {
        msg = String(err);
      }
    }
    const lower = (msg || "").toLowerCase();
    if (
      lower.includes("api key not valid") ||
      lower.includes("api_key_invalid") ||
      lower.includes("invalid_argument")
    ) {
      return "Invalid API key. Open ‘Get an API key’, paste it, and press Save.";
    }
    return msg;
  }

  // --- Small reused helpers (preserve exact behavior/messages) ---
  function buildFormData(p: string, fs: File[]): FormData {
    const form = new FormData();
    form.append("prompt", p);
    for (const file of fs) form.append("files", file);
    return form;
  }

  function addProcessingCard(
    args: Pick<Card, "prompt" | "files"> & { filesBlob?: { file: File }[] },
  ): string {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    setCards((prev) => [
      {
        id,
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
      const apiKey = localStorage.getItem("gemini_api_key")?.trim() || "";
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
          mediaType: f.type || "image/jpeg",
        });
      }

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

          // If nothing streamed but final text is present, append it now
          if (!gotData && text) {
            setCards((prev) =>
              prev.map((c) =>
                c.id === id
                  ? { ...c, resultMarkdown: (c.resultMarkdown || "") + text }
                  : c,
              ),
            );
            gotData = true;
          }

          if (usage) {
            const computedTotal = computeUsageTotal(usage);
            setCards((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      status: "complete",
                      usage,
                      usageTotal: computedTotal,
                    }
                  : c,
              ),
            );
          } else {
            // Even if no usage, if we got text, mark complete
            setCards((prev) =>
              prev.map((c) => (c.id === id ? { ...c, status: "complete" } : c)),
            );
          }
        },
      });

      for await (const part of result.fullStream as any) {
        switch (part.type) {
          case "text": {
            const delta = (part as { text?: string }).text || "";
            if (delta) {
              gotData = true;
              setCards((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? { ...c, resultMarkdown: (c.resultMarkdown || "") + delta }
                    : c,
                ),
              );
            }
            break;
          }
          case "abort": {
            gotError = true;
            setCards((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, status: "failed", error: "Canceled" } : c,
              ),
            );
            break;
          }
          case "text-delta": {
            const delta =
              (part as { text?: string; delta?: string; textDelta?: string })
                .text ||
              (part as { text?: string; delta?: string; textDelta?: string })
                .delta ||
              (part as { text?: string; delta?: string; textDelta?: string })
                .textDelta ||
              "";
            if (delta) {
              gotData = true;
              setCards((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? { ...c, resultMarkdown: (c.resultMarkdown || "") + delta }
                    : c,
                ),
              );
            }
            break;
          }
          case "error": {
            gotError = true;
            const message = formatModelError(
              (part as { error?: unknown }).error,
            );
            setCards((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, status: "failed", error: message } : c,
              ),
            );
            if (opts.showErrorToast) {
              showToast(`Failed: ${message}`, "destructive");
            }
            break;
          }
          default:
            break;
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
        showToast("Empty response from model", "destructive");
      }
    } catch (e: unknown) {
      const message = formatModelError(e);
      setCards((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: "failed", error: message } : c,
        ),
      );
      if (opts.showErrorToast) {
        showToast(`Failed: ${message}`, "destructive");
      }
    } finally {
      // Cleanup controller entry
      delete controllersRef.current[id];
    }
  }

  const submit = async () => {
    if (!canSubmit) return;
    const id = addProcessingCard({
      prompt,
      files: files.map((f) => ({
        name: f.file.name,
        size: f.file.size,
        type: f.file.type,
      })),
      filesBlob: files.map((f) => ({ file: f.file })),
    });
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
        prev.map((c) =>
          c.id === id ? { ...c, status: "failed", error: message } : c,
        ),
      );
      showToast(`Failed: ${message}`, "destructive");
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
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "processing",
              resultMarkdown: undefined,
              error: undefined,
              usage: undefined,
              usageTotal: undefined,
              createdAt: Date.now(),
            }
          : c,
      ),
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
        prev.map((c) =>
          c.id === id ? { ...c, status: "failed", error: message } : c,
        ),
      );
      // Note: intentionally no toast here to preserve previous behavior.
    }
  };

  const copy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard", "success");
    } catch {
      showToast("Failed to copy", "destructive");
    }
  };

  // Derived for dialog usage without non-null assertions
  const eid = expandedId ?? "";

  return (
    <div className="min-h-dvh w-full p-6 md:p-10">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <ApiKeyBar
            onKeyChange={(p) => setHasApiKey(!!p)}
            onStatusChange={({ savedPresent, draftPresent }) => {
              setHasApiKey(!!savedPresent);
              setHasDraftKey(!!draftPresent);
            }}
            onToast={(msg, variant) => showToast(msg, variant)}
          />
        </div>
        {/* Left: Inputs */}
        <section className="space-y-4">
          <FilePicker
            files={files}
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
            <h2 className="text-lg font-semibold">Requests</h2>
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
                card={card as RequestCardType}
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

      {/* Result Dialog */}
      <ResultDialog
        openId={expandedId}
        onOpenChange={(open) => {
          if (!open) setExpandedId(null);
        }}
        markdown={cards.find((c) => c.id === eid)?.resultMarkdown}
        files={cards.find((c) => c.id === eid)?.files}
        raw={!!rawViewById[eid]}
        onToggleRaw={() =>
          setRawViewById((m) => ({
            ...m,
            [eid]: !m[eid],
          }))
        }
        onCopy={(text) => copy(text)}
      />

      <Toasts toasts={toasts} />
    </div>
  );
}
