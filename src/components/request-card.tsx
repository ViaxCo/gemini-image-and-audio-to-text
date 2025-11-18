"use client";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AudioPlayer } from "@/components/audio-player";
import { DownloadMenu } from "@/components/download-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardTitle,
  Card as UICard,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extractPageMarkers } from "@/lib/page-markers";
import { cn } from "@/lib/utils";
import type { Card, SubRequest } from "@/types";

type RequestCardProps = {
  card: Card;
  raw: boolean;
  onToggleRaw: () => void;
  onCopy: (text?: string) => void;
  onExpand: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (card: Card) => void;
  onRetrySubRequest?: (cardId: string, subRequestId: string) => void;
  onClose: (id: string) => void;
};

const statusTone: Record<SubRequest["status"], string> = {
  queued:
    "bg-muted text-muted-foreground border border-dashed border-muted-foreground/40",
  running:
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-200/60 dark:border-blue-400/20",
  complete:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-400/20",
  failed: "bg-destructive/10 text-destructive border border-destructive/40",
  canceled:
    "bg-muted text-muted-foreground border border-dashed border-muted-foreground/40",
};

export function RequestCard(props: RequestCardProps) {
  const { card, onRetrySubRequest } = props;
  const [waveCountdown, setWaveCountdown] = useState<number | null>(null);
  const isBatch = Boolean(card.isBatch);
  const displayText = card.combinedText ?? card.resultText ?? "";

  useEffect(() => {
    if (!card.nextWaveEta) {
      setWaveCountdown(null);
      return;
    }
    const target = card.nextWaveEta;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setWaveCountdown(null);
        return;
      }
      setWaveCountdown(Math.ceil(diff / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [card.nextWaveEta]);

  const pageInfo = useMemo(() => {
    if (card.mode === "audio") {
      return null;
    }
    const trimmed = displayText.trim();
    if (!trimmed) {
      return null;
    }
    const info = extractPageMarkers(trimmed);
    return info.count > 0 ? info : null;
  }, [card.mode, displayText]);

  const pageBadgeTitle = useMemo(() => {
    if (!pageInfo) {
      return undefined;
    }
    const maxPreview = 20;
    const preview = pageInfo.pages.slice(0, maxPreview).join(", ");
    const suffix = pageInfo.pages.length > maxPreview ? ", …" : "";
    return `Pages detected: ${preview}${suffix}`;
  }, [pageInfo]);

  const subRequestStats = useMemo(() => {
    if (!card.subRequests?.length) {
      return {
        total: 0,
        completed: 0,
        running: 0,
        queued: 0,
        failed: 0,
        canceled: 0,
      };
    }
    let completed = 0;
    let running = 0;
    let queued = 0;
    let failed = 0;
    let canceled = 0;
    for (const sub of card.subRequests) {
      if (sub.status === "complete") completed += 1;
      else if (sub.status === "running") running += 1;
      else if (sub.status === "queued") queued += 1;
      else if (sub.status === "failed") failed += 1;
      else if (sub.status === "canceled") canceled += 1;
    }
    return {
      total: card.subRequests.length,
      completed,
      running,
      queued,
      failed,
      canceled,
    };
  }, [card.subRequests]);

  const canRetryDueToPageMismatch = useMemo(() => {
    if (card.mode === "audio" || card.status !== "complete" || !pageInfo) {
      return false;
    }
    const totalFiles = card.totalFiles ?? card.files.length;
    return pageInfo.count !== totalFiles;
  }, [card.mode, card.status, pageInfo, card.totalFiles, card.files.length]);

  const hasPageMismatch = useMemo(() => {
    if (card.mode === "audio" || !pageInfo) {
      return false;
    }
    const totalFiles = card.totalFiles ?? card.files.length;
    const isAllComplete =
      card.status === "complete" &&
      (!isBatch || subRequestStats.completed === subRequestStats.total);
    return isAllComplete && pageInfo.count !== totalFiles;
  }, [
    card.mode,
    card.status,
    pageInfo,
    card.totalFiles,
    card.files.length,
    isBatch,
    subRequestStats.completed,
    subRequestStats.total,
  ]);

  const batchProgressSummary = `Completed ${subRequestStats.completed} of ${subRequestStats.total} requests. ${subRequestStats.running} running. ${subRequestStats.queued} queued.`;

  const renderFilesSummary = () => {
    if (card.files.length === 0) return null;
    if (card.mode === "audio") {
      const file = card.files[0];
      return (
        <div className="w-full">
          <span
            title={file?.name}
            className="block max-w-full truncate text-sm text-foreground"
          >
            {file?.name ?? "(audio)"}
          </span>
          {card.status === "complete" && card.filesBlob?.[0]?.file ? (
            <div className="mt-2">
              <AudioPlayer file={card.filesBlob[0].file} />
            </div>
          ) : null}
        </div>
      );
    }
    if (card.files.length === 1) {
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
    }
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
  };

  return (
    <UICard>
      <CardHeader className="border-b pb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium truncate">
            {new Date(card.createdAt).toLocaleString()}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "text-xs uppercase tracking-wide",
                card.status === "failed"
                  ? "text-red-600 dark:text-red-400"
                  : card.status === "complete"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
              )}
            >
              {card.status}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onClose(card.id)}
              aria-label="Close card"
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isBatch ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="uppercase tracking-wide">
              Batch
            </Badge>
            <span>
              {(card.totalFiles ?? card.files.length).toLocaleString()} files
            </span>
            <span>{subRequestStats.total} requests</span>
            <span>
              {subRequestStats.completed}/{subRequestStats.total} complete
            </span>
            <span>{subRequestStats.running} running</span>
            <span>{subRequestStats.queued} queued</span>
            {waveCountdown !== null ? (
              <span aria-live="polite">Next wave in {waveCountdown}s</span>
            ) : null}
            {card.pendingRetryCount ? (
              <Badge
                variant="outline"
                className="border-amber-500 text-amber-600"
              >
                {card.pendingRetryCount} retry
                {card.pendingRetryCount > 1 ? "" : ""} pending
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {renderFilesSummary()}
          {card.mode !== "audio" ? (
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <span>
                {(card.totalFiles ?? card.files.length).toLocaleString()} file
                {(card.totalFiles ?? card.files.length) === 1 ? "" : "s"}
              </span>
              {pageInfo ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 text-[11px] uppercase tracking-wide",
                    hasPageMismatch && "text-red-600 dark:text-red-400",
                  )}
                  title={pageBadgeTitle}
                  aria-label={pageBadgeTitle}
                >
                  Pages: {pageInfo.count}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        {card.error && card.status === "failed" ? (
          <Alert variant="destructive">
            <AlertDescription aria-live="polite">{card.error}</AlertDescription>
          </Alert>
        ) : null}

        {hasPageMismatch ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTitle>Page Count Mismatch</AlertTitle>
            <AlertDescription>
              Detected {pageInfo?.count} pages but expected{" "}
              {card.totalFiles ?? card.files.length} based on the number of
              files. You can retry this batch to get complete results.
            </AlertDescription>
          </Alert>
        ) : null}

        {isBatch && card.subRequests?.length ? (
          <section className="space-y-2" aria-label="Batch progress">
            <div className="sr-only" aria-live="polite">
              {batchProgressSummary}
            </div>
            <ScrollArea className="h-52 sm:h-64 w-full rounded border">
              <div className="min-w-[28rem]">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Request</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Files
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Started
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {card.subRequests.map((sub) => {
                      const startedAt = sub.startedAt
                        ? new Date(sub.startedAt).toLocaleTimeString()
                        : "—";
                      const pageInfoForSub = sub.resultText
                        ? extractPageMarkers(sub.resultText)
                        : null;
                      const pageCount = pageInfoForSub?.count ?? 0;
                      const canRetry =
                        (sub.status === "failed" ||
                          (sub.status === "complete" &&
                            pageCount !== sub.fileCount)) &&
                        Boolean(onRetrySubRequest);
                      return (
                        <TableRow key={sub.id} className="align-middle">
                          <TableCell className="font-medium text-xs sm:text-sm">
                            <div className="flex flex-col">
                              <span>{sub.label}</span>
                              <span className="text-muted-foreground text-[11px] sm:hidden">
                                {sub.fileCount} file
                                {sub.fileCount === 1 ? "" : "s"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs">
                            {sub.fileCount.toLocaleString()}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs">
                            {startedAt}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] uppercase tracking-tight",
                                statusTone[sub.status],
                              )}
                            >
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                disabled={!canRetry}
                                onClick={() =>
                                  onRetrySubRequest?.(card.id, sub.id)
                                }
                              >
                                Retry
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </section>
        ) : null}

        {displayText && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">View:</span>
              <Button size="sm" variant="outline" onClick={props.onToggleRaw}>
                {props.raw ? "Preview" : "Raw"}
              </Button>
            </div>
            {props.raw ? (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm bg-accent/30 p-2 rounded">
                {displayText}
              </pre>
            ) : (
              <div className="max-h-64 overflow-auto text-sm border rounded p-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayText}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {((card.status === "processing" && !isBatch) ||
            (isBatch &&
              (subRequestStats.running > 0 || subRequestStats.queued > 0))) && (
            <Button
              variant="outline"
              onClick={() => props.onCancel(card.id)}
              aria-label="Cancel request"
            >
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => props.onCopy(displayText)}
            disabled={!displayText}
          >
            Copy
          </Button>
          <DownloadMenu
            text={displayText}
            suggestedBaseName={card.files?.[0]?.name}
            variant="outline"
          />
          <Button
            variant="outline"
            onClick={() => props.onExpand(card.id)}
            disabled={!displayText}
          >
            Expand
          </Button>
          <Button
            variant="ghost"
            onClick={() => props.onRetry(card)}
            disabled={
              canRetryDueToPageMismatch
                ? false
                : isBatch
                  ? card.pendingRetryCount === 0 || subRequestStats.running > 0
                  : card.status === "processing"
            }
          >
            Retry
          </Button>
        </div>
      </CardContent>
    </UICard>
  );
}
