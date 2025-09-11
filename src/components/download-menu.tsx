"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Intentionally loose typings to avoid hard dependency on unified's types.
type UnifiedLike = {
  use: (plugin: unknown, ...rest: unknown[]) => UnifiedLike;
  parse: (doc: string) => unknown;
};

type Props = {
  markdown?: string;
  suggestedBaseName?: string;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  label?: string;
};

function baseName(name?: string) {
  const base = (name || "ocr").replace(/\.[^/.]+$/, "");
  return base || "ocr";
}

export function DownloadMenu({
  markdown,
  suggestedBaseName,
  className,
  size = "default",
  variant = "outline",
  label = "Download",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const disabled = !markdown;

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const doDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onDownloadMd = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    doDownload(blob, `${baseName(suggestedBaseName)}.md`);
    setOpen(false);
  };

  const onDownloadDocx = async () => {
    if (!markdown) return;
    try {
      const [{ unified }, remarkParseMod, remarkGfmMod] = await Promise.all([
        import("unified"),
        import("remark-parse"),
        import("remark-gfm"),
      ]);

      const parsePlugin =
        (remarkParseMod as { default?: unknown }).default ??
        (remarkParseMod as unknown);
      const gfmPlugin =
        (remarkGfmMod as { default?: unknown }).default ??
        (remarkGfmMod as unknown);

      const mdast = (unified as unknown as () => UnifiedLike)()
        .use(parsePlugin)
        .use(gfmPlugin)
        .parse(markdown);

      const m2d = (await import("mdast2docx")) as unknown as {
        toDocx: (
          tree: unknown,
          options?: unknown,
          config?: { plugins?: unknown[] },
          output?: "blob",
        ) => Promise<Blob | Uint8Array>;
      };
      // Optional plugins for better fidelity (tables, lists, images)
      const plugins: unknown[] = [];
      try {
        const [{ tablePlugin }, { listPlugin }] = await Promise.all([
          import("@m2d/table"),
          import("@m2d/list"),
        ]);
        plugins.push(tablePlugin(), listPlugin());
      } catch {
        // Plugins are optional; fallback still works for basic text/headers.
      }
      try {
        const { imagePlugin } = await import("@m2d/image");
        plugins.push(imagePlugin());
      } catch {
        // ignore if not available or fails — images are optional
      }

      const blob: Blob | Uint8Array = await m2d.toDocx(
        mdast,
        {},
        { plugins },
        "blob",
      );

      let outBlob: Blob;
      if (blob instanceof Blob) {
        outBlob = blob;
      } else {
        const u8 = blob as Uint8Array;
        const ab = (u8.buffer as ArrayBufferLike).slice(
          u8.byteOffset,
          u8.byteOffset + u8.byteLength,
        ) as ArrayBuffer;
        outBlob = new Blob([ab], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      }

      doDownload(outBlob, `${baseName(suggestedBaseName)}.docx`);
    } catch (err) {
      console.error("DOCX export failed", err);
      alert("Sorry, exporting to .docx failed. See console for details.");
    } finally {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <Button
        variant={variant}
        size={size}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className="min-w-[7.5rem] justify-between"
      >
        <span>{label}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="size-4 opacity-70"
          fill="currentColor"
        >
          <title>Chevron</title>
          <path d="M5.5 7.5L10 12l4.5-4.5" />
        </svg>
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute z-50 mt-1 w-48 rounded-md border bg-background p-1 shadow-md right-0"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={onDownloadMd}
          >
            Markdown (.md)
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={onDownloadDocx}
          >
            Word (.docx)
          </button>
        </div>
      )}
    </div>
  );
}

export default DownloadMenu;
