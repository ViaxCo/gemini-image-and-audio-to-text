"use client";

import { useEffect, useState } from "react";
import { type FileItem, FilePicker } from "@/components/file-picker";
import { PromptEditor } from "@/components/prompt-editor";
import {
  RequestCard,
  type Card as RequestCardType,
} from "@/components/request-card";
import { ResultDialog } from "@/components/result-dialog";
import { Toasts } from "@/components/toasts";
import { Button } from "@/components/ui/button";
import {
  computeUsageTotal,
  readAiSdkStream,
  type Usage as StreamUsage,
} from "@/lib/ai-stream";

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
  const [fileView, setFileView] = useState<"list" | "compact">("compact");
  const [rawViewById, setRawViewById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem("ocr_default_prompt");
    if (saved) setPrompt(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("ocr_default_prompt", prompt);
  }, [prompt]);

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
    } catch { }
    setFiles([]);
    // input reset handled within FilePicker
  };

  const resetPromptToDefault = () => setPrompt(DEFAULT_PROMPT);

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

  const canSubmit = files.length > 0 && prompt.trim().length > 0;

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
    const res = await fetch("/api/ocr", { method: "POST", body: form });
    if (!res.ok || !res.body) throw new Error("Request failed");

    const gotData = await readAiSdkStream(res.body, {
      onTextDelta: (delta: string) => {
        setCards((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, resultMarkdown: (c.resultMarkdown || "") + delta }
              : c,
          ),
        );
      },
      onUsage: (usage: StreamUsage | undefined) => {
        if (!usage) return;
        const computedTotal = computeUsageTotal(usage);
        setCards((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, status: "complete", usage, usageTotal: computedTotal }
              : c,
          ),
        );
      },
      onError: (message: string) => {
        setCards((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: "failed", error: message } : c,
          ),
        );
        if (opts.showErrorToast) {
          showToast(`Failed: ${message}`, "destructive");
        }
      },
    });

    if (!gotData) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: "failed", error: "Empty response" } : c,
        ),
      );
      showToast("Empty response from server", "destructive");
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
    const id = addProcessingCard({
      prompt: card.prompt,
      files: card.files,
      filesBlob: card.filesBlob,
    });
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
        {/* Left: Inputs */}
        <section className="space-y-4">
          <FilePicker
            files={files}
            onPickFiles={onPickFiles}
            onDrop={onDrop}
            removeFile={removeFile}
            clearAllFiles={clearAllFiles}
            fileView={fileView}
            setFileView={setFileView}
          />

          <PromptEditor
            prompt={prompt}
            setPrompt={setPrompt}
            onReset={resetPromptToDefault}
          />

          <div className="flex items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit}>
              Submit
            </Button>
          </div>
        </section>

        {/* Right: Cards */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Requests</h2>
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
