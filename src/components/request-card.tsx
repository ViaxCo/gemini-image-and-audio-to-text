"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DownloadMenu } from "@/components/download-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardTitle,
  Card as UICard,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Card } from "@/types";

export function RequestCard(props: {
  card: Card;
  raw: boolean;
  onToggleRaw: () => void;
  onCopy: (text?: string) => void;
  onExpand: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (card: Card) => void;
}) {
  const { card } = props;
  const [filesOpen, setFilesOpen] = React.useState(false);
  const tokensTitle = card.usage
    ? `Input: ${card.usage.inputTokens ?? "?"} • Output: ${
        card.usage.outputTokens ?? "?"
      } • Total: ${card.usage.totalTokens ?? "?"}`
    : card.status === "complete"
      ? "Provider did not return usage"
      : "Token usage available on finish";

  const fmt = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

  const tokensDisplay =
    card.usage?.totalTokens ??
    card.usageTotal ??
    (card.usage?.inputTokens !== undefined &&
    card.usage?.outputTokens !== undefined
      ? card.usage.inputTokens + card.usage.outputTokens
      : undefined) ??
    card.usage?.outputTokens ??
    card.usage?.inputTokens ??
    (card.status === "complete" ? "—" : "…");

  const tokensDisplayStr =
    typeof tokensDisplay === "number"
      ? tokensDisplay.toLocaleString()
      : tokensDisplay;

  return (
    <UICard>
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium truncate">
            {new Date(card.createdAt).toLocaleString()}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center rounded border px-2 py-0.5 text-[11px] leading-none text-muted-foreground"
              title={tokensTitle}
            >
              Tokens {tokensDisplayStr}
            </span>
            <div
              className={
                "text-xs uppercase tracking-wide " +
                (card.status === "failed"
                  ? "text-red-600 dark:text-red-400"
                  : card.status === "complete"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground")
              }
            >
              {card.status}
            </div>
          </div>
        </div>

        {/* Token breakdown: responsive 2x2 on mobile, 4-col on sm+ */}
        {card.status !== "processing" && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] sm:text-xs">
            <div className="flex items-center justify-between rounded border px-2 py-1 text-muted-foreground">
              <span className="opacity-70">Input</span>
              <span className="tabular-nums">
                {fmt(card.usage?.inputTokens)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border px-2 py-1 text-muted-foreground">
              <span className="opacity-70">Output</span>
              <span className="tabular-nums">
                {fmt(card.usage?.outputTokens)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border px-2 py-1 text-muted-foreground">
              <span className="opacity-70">Reason</span>
              <span className="tabular-nums">
                {fmt(card.usage?.reasoningTokens)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded border px-2 py-1">
              <span className="opacity-70">Total</span>
              <span className="tabular-nums font-medium">
                {(() => {
                  const total =
                    card.usage?.totalTokens ??
                    card.usageTotal ??
                    (card.usage?.inputTokens !== undefined &&
                    card.usage?.outputTokens !== undefined
                      ? card.usage.inputTokens + card.usage.outputTokens
                      : undefined);
                  return fmt(total);
                })()}
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        {/* Filenames: image cards show compact header; audio cards show plain truncated text */}
        <div className="mb-2">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {(() => {
              if (card.files.length === 0) return null;
              // Audio mode: show plain text, single line, ellipsis on overflow
              if (card.mode === "audio") {
                const f = card.files[0];
                return (
                  <span
                    title={f?.name}
                    className="block max-w-full truncate text-sm text-foreground"
                  >
                    {f?.name ?? "(audio)"}
                  </span>
                );
              }
              if (card.files.length === 1)
                return (
                  <Badge
                    key={card.files[0].name}
                    variant="outline"
                    title={card.files[0].name}
                    className="max-w-[12rem] truncate"
                  >
                    {card.files[0].name}
                  </Badge>
                );
              const first = card.files[0];
              const last = card.files[card.files.length - 1];
              return (
                <>
                  <Badge
                    key={`first-${first.name}`}
                    variant="outline"
                    title={first.name}
                    className="max-w-[12rem] truncate"
                  >
                    {first.name}
                  </Badge>
                  <span aria-hidden className="mx-0.5 text-muted-foreground">
                    …
                  </span>
                  <Badge
                    key={`last-${last.name}`}
                    variant="outline"
                    title={last.name}
                    className="max-w-[12rem] truncate"
                  >
                    {last.name}
                  </Badge>
                </>
              );
            })()}
            {card.files.length > 2 && card.mode !== "audio" && (
              <details
                open={filesOpen}
                onToggle={(e) =>
                  setFilesOpen((e.target as HTMLDetailsElement).open)
                }
                className="ml-1"
              >
                <summary className="list-none cursor-pointer text-xs px-2 py-1 rounded hover:bg-accent inline-flex items-center">
                  +{card.files.length - 2} more
                </summary>
                <div id={`files-${card.id}`} className="mt-2">
                  {/**
                   * Ensure the expandable files list scrolls instead of
                   * overflowing the card. Radix ScrollArea expects an explicit
                   * height on the Root (not just max-height) so the Viewport
                   * can size itself and enable overflow. Using `h-28` on
                   * mobile and a bit taller on larger screens keeps it
                   * responsive while preventing layout push-down.
                   */}
                  <ScrollArea className="h-28 sm:h-36 w-full overflow-hidden rounded border">
                    <div className="p-2 flex flex-wrap gap-1">
                      {card.files.map((f) => (
                        <Badge
                          key={`full-${f.name}`}
                          variant="secondary"
                          title={f.name}
                          className="max-w-[14rem] truncate"
                        >
                          {f.name}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </details>
            )}
            {card.mode !== "audio" && (
              <span className="text-xs text-muted-foreground ml-auto">
                {card.files.length} file{card.files.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        {card.status === "failed" && (
          <div className="text-sm text-destructive">{card.error}</div>
        )}
        {card.resultMarkdown && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">View:</span>
              <Button size="sm" variant="outline" onClick={props.onToggleRaw}>
                {props.raw ? "Preview" : "Raw"}
              </Button>
            </div>
            {props.raw ? (
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
        <div className="flex items-center flex-wrap gap-2 mt-3">
          {card.status === "processing" ? (
            <Button
              variant="outline"
              onClick={() => props.onCancel(card.id)}
              aria-label="Cancel request"
            >
              Cancel
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => props.onCopy(card.resultMarkdown)}
            disabled={!card.resultMarkdown}
          >
            Copy
          </Button>
          <DownloadMenu
            markdown={card.resultMarkdown}
            suggestedBaseName={card.files?.[0]?.name}
            variant="outline"
          />
          <Button
            variant="outline"
            onClick={() => props.onExpand(card.id)}
            disabled={!card.resultMarkdown}
          >
            Expand
          </Button>
          <Button
            variant="ghost"
            onClick={() => props.onRetry(card)}
            disabled={card.status === "processing"}
          >
            Retry
          </Button>
        </div>
      </CardContent>
    </UICard>
  );
}
