"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FileItem = {
  file: File;
  previewUrl?: string;
};

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
};

const DEFAULT_PROMPT = `Extract all text from the provided sources, in the numerical order of the sources.

For each source:
	1.	Extract the full text.
	2.	Reconstruct the text into readable paragraphs. A new paragraph should begin where there is a clear break in the original text, such as a new line, indentation, or topic change. Do not merge paragraphs that are clearly separate in the source.
	3.	Ensure each distinct scripture passage is separated from the surrounding text by a blank line. For example, if the text contains "John 3:16" followed by commentary, the scripture should be a separate paragraph.
	4.	After the extracted and formatted text for the source, insert a blank line.
	5.	On the new line, append the page number. Use the printed page number visible in the image. If no page number is visible, infer one based on the order provided (Page 1, Page 2, ...).
	6.	Format the page number as: **Page [number]**

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
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    if (inputRef.current) inputRef.current.value = "";
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
    if (inputRef.current) inputRef.current.value = "";
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

  const submit = async () => {
    if (!canSubmit) return;
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    setCards((prev) => [
      {
        id,
        prompt,
        files: files.map((f) => ({
          name: f.file.name,
          size: f.file.size,
          type: f.file.type,
        })),
        filesBlob: files.map((f) => ({ file: f.file })),
        status: "processing",
        createdAt,
      },
      ...prev,
    ]);

    const form = new FormData();
    form.append("prompt", prompt);
    for (const item of files) {
      form.append("files", item.file);
    }

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: form });
      if (!res.ok || !res.body) throw new Error("Request failed");

      // Parse AI SDK Data Stream Protocol (SSE with JSON payloads)
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotData = false;
      let done = false;

      type Usage = {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        reasoningTokens?: number;
      };
      type StreamEvent =
        | { type: "text-delta"; textDelta?: string; delta?: string }
        | { type: "finish"; totalUsage?: Usage }
        | { type: "message-metadata"; metadata?: { totalUsage?: Usage } }
        | { type: "error"; error?: unknown }
        | { type: string };

      const handleEvent = (evt: StreamEvent) => {
        if (!evt || typeof evt !== "object") return;
        switch (evt.type) {
          case "text-delta": {
            const delta: string = evt.textDelta ?? evt.delta ?? "";
            if (delta) {
              gotData = true;
              setCards((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        resultMarkdown: (c.resultMarkdown || "") + delta,
                      }
                    : c,
                ),
              );
            }
            break;
          }
          case "finish": {
            const totalUsage = (evt as { totalUsage?: Usage }).totalUsage;
            setCards((prev) =>
              prev.map((c) =>
                c.id === id
                  ? { ...c, status: "complete", usage: totalUsage }
                  : c,
              ),
            );
            break;
          }
          case "message-metadata": {
            const totalUsage = (evt as { metadata?: { totalUsage?: Usage } })
              .metadata?.totalUsage;
            if (totalUsage) {
              setCards((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, usage: totalUsage } : c,
                ),
              );
            }
            break;
          }
          case "error": {
            const message =
              typeof (evt as { error?: unknown }).error === "string"
                ? (evt as { error?: string }).error
                : (evt as { error?: { message?: string } }).error?.message ||
                  "Unknown error";
            setCards((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, status: "failed", error: message } : c,
              ),
            );
            showToast(`Failed: ${message}`, "destructive");
            break;
          }
          default:
            break;
        }
      };

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          buffer += decoder
            .decode(value, { stream: !done })
            .replace(/\r\n/g, "\n");
          // SSE events are separated by double newlines
          let sepIndex = buffer.indexOf("\n\n");
          while (sepIndex !== -1) {
            const rawEvent = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            sepIndex = buffer.indexOf("\n\n");

            // Each event may contain multiple lines; we care about `data:`
            const lines = rawEvent.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const evt = JSON.parse(jsonStr);
                handleEvent(evt);
              } catch {
                // ignore parse errors for non-JSON data lines
              }
            }
          }
        }
      }

      if (!gotData) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, status: "failed", error: "Empty response" }
              : c,
          ),
        );
        showToast("Empty response from server", "destructive");
      }
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
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    setCards((prev) => [
      {
        id,
        prompt: card.prompt,
        files: card.files,
        filesBlob: card.filesBlob,
        status: "processing",
        createdAt,
      },
      ...prev,
    ]);

    const form = new FormData();
    form.append("prompt", card.prompt);
    for (const item of card.filesBlob) form.append("files", item.file);

    try {
      const res = await fetch("/api/ocr", { method: "POST", body: form });
      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotData = false;
      let done = false;

      type Usage = {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        reasoningTokens?: number;
      };
      type StreamEvent =
        | { type: "text-delta"; textDelta?: string; delta?: string }
        | { type: "finish"; totalUsage?: Usage }
        | { type: "error"; error?: unknown }
        | { type: string };

      const handleEvent = (evt: StreamEvent) => {
        if (!evt || typeof evt !== "object") return;
        switch (evt.type) {
          case "text-delta": {
            const delta: string = evt.textDelta ?? evt.delta ?? "";
            if (delta) {
              gotData = true;
              setCards((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        resultMarkdown: (c.resultMarkdown || "") + delta,
                      }
                    : c,
                ),
              );
            }
            break;
          }
          case "finish": {
            const totalUsage = (evt as { totalUsage?: Usage }).totalUsage;
            setCards((prev) =>
              prev.map((c) =>
                c.id === id
                  ? { ...c, status: "complete", usage: totalUsage }
                  : c,
              ),
            );
            break;
          }
          case "error": {
            const message =
              typeof (evt as { error?: unknown }).error === "string"
                ? (evt as { error?: string }).error
                : (evt as { errorText?: string }).errorText ||
                  (evt as { error?: { message?: string } }).error?.message ||
                  "Unknown error";
            setCards((prev) =>
              prev.map((c) =>
                c.id === id ? { ...c, status: "failed", error: message } : c,
              ),
            );
            break;
          }
          default:
            break;
        }
      };

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          let sepIndex = buffer.indexOf("\n\n");
          while (sepIndex !== -1) {
            const rawEvent = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            sepIndex = buffer.indexOf("\n\n");
            const lines = rawEvent.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const evt = JSON.parse(jsonStr);
                handleEvent(evt);
              } catch {}
            }
          }
        }
      }

      if (!gotData) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, status: "failed", error: "Empty response" }
              : c,
          ),
        );
        showToast("Empty response from server", "destructive");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setCards((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: "failed", error: message } : c,
        ),
      );
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
          <h1 className="text-xl font-semibold">Image → Markdown OCR</h1>
          <section
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            aria-label="File dropzone"
            className="border-2 border-dashed rounded-md p-6 text-sm text-muted-foreground hover:bg-accent/30 transition-colors"
          >
            Drag & drop JPEG/PNG here, or
            <div className="mt-2 flex items-center gap-2">
              <Input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={(e) => onPickFiles(e.currentTarget.files)}
              />
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                Browse
              </Button>
            </div>
          </section>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Selected files</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="opacity-70">View:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFileView(fileView === "list" ? "compact" : "list")
                    }
                  >
                    {fileView === "list" ? "Compact" : "List"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearAllFiles}
                  >
                    Clear all
                  </Button>
                </div>
              </div>
              {fileView === "list" ? (
                <div className="space-y-2">
                  {files.map((item, idx) => (
                    <div
                      key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${idx}`}
                      className="flex items-center gap-3"
                    >
                      <div className="text-sm text-muted-foreground truncate">
                        {item.file.name}{" "}
                        <span className="opacity-60">
                          ({Math.round(item.file.size / 1024)} KB)
                        </span>
                      </div>
                      <Button variant="ghost" onClick={() => removeFile(idx)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {files.map((item, idx) => (
                    <div
                      key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${idx}`}
                      className="border rounded px-2 py-1 text-xs flex items-center gap-2"
                    >
                      <span className="max-w-40 truncate">
                        {item.file.name}
                      </span>
                      <button
                        type="button"
                        className="opacity-70 hover:opacity-100"
                        onClick={() => removeFile(idx)}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="prompt">
                Prompt
              </label>
              <Button variant="ghost" onClick={resetPromptToDefault}>
                Reset to default
              </Button>
            </div>
            <Textarea
              rows={12}
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

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
              <div key={card.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="font-medium truncate">
                    {new Date(card.createdAt).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="inline-flex items-center rounded border px-2 py-0.5 text-[11px] leading-none text-muted-foreground"
                      title={
                        card.usage
                          ? `Input: ${card.usage.inputTokens ?? "?"} • Output: ${card.usage.outputTokens ?? "?"} • Total: ${card.usage.totalTokens ?? "?"}`
                          : card.status === "complete"
                            ? "Provider did not return usage"
                            : "Token usage available on finish"
                      }
                    >
                      Tokens:{" "}
                      {card.usage?.outputTokens ??
                        card.usage?.totalTokens ??
                        (card.status === "complete" ? "—" : "…")}
                    </span>
                    <div className="text-xs uppercase tracking-wide opacity-70">
                      {card.status}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {card.files.length} file(s)
                </div>
                {card.status === "failed" && (
                  <div className="text-sm text-destructive">{card.error}</div>
                )}
                {card.resultMarkdown && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="opacity-70">View:</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRawViewById((m) => ({
                            ...m,
                            [card.id]: !m[card.id],
                          }))
                        }
                      >
                        {rawViewById[card.id] ? "Preview" : "Raw"}
                      </Button>
                    </div>
                    {rawViewById[card.id] ? (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm bg-accent/30 p-2 rounded">
                        {card.resultMarkdown}
                      </pre>
                    ) : (
                      <div className="max-h-64 overflow-auto text-sm border rounded p-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {card.resultMarkdown}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copy(card.resultMarkdown)}
                    disabled={!card.resultMarkdown}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setExpandedId(card.id)}
                    disabled={!card.resultMarkdown}
                  >
                    Expand
                  </Button>
                  <Button variant="ghost" onClick={() => retry(card)}>
                    Retry
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Result Dialog */}
      <Dialog
        open={Boolean(expandedId)}
        onOpenChange={(open) => {
          if (!open) setExpandedId(null);
        }}
      >
        {expandedId ? (
          <DialogContent
            showCloseButton={false}
            className="max-w-3xl w-full max-h-[80vh] p-0"
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <DialogTitle className="text-sm">Result</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copy(cards.find((c) => c.id === eid)?.resultMarkdown)
                  }
                >
                  Copy
                </Button>
                <DialogClose asChild>
                  <Button size="sm">Close</Button>
                </DialogClose>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh] space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="opacity-70">View:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRawViewById((m) => ({
                      ...m,
                      [eid]: !m[eid],
                    }))
                  }
                >
                  {rawViewById[eid] ? "Preview" : "Raw"}
                </Button>
              </div>
              {rawViewById[eid] ? (
                <pre className="whitespace-pre-wrap text-sm">
                  {cards.find((c) => c.id === eid)?.resultMarkdown}
                </pre>
              ) : (
                <div className="text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {cards.find((c) => c.id === eid)?.resultMarkdown || ""}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {/* Toasts */}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "rounded-md border px-3 py-2 text-sm shadow-md " +
              (t.variant === "success"
                ? "bg-emerald-600/10 border-emerald-600/30 text-emerald-800 dark:text-emerald-200"
                : t.variant === "warning"
                  ? "bg-amber-600/10 border-amber-600/30 text-amber-800 dark:text-amber-200"
                  : t.variant === "destructive"
                    ? "bg-red-600/10 border-red-600/30 text-red-800 dark:text-red-200"
                    : "bg-accent/40 border-accent")
            }
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
