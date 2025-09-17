"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AudioPlayer } from "@/components/audio-player";
import { DownloadMenu } from "@/components/download-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Card } from "@/types";

type ResultDialogProps = {
  openId: string | null;
  onOpenChange: (open: boolean) => void;
  raw: boolean;
  onToggleRaw: () => void;
  onCopy: (text?: string) => void;
  card?: Card | null;
  text?: string;
  files?: { name: string }[];
  audioFile?: File | null;
};

export function ResultDialog(props: ResultDialogProps) {
  const card = props.card ?? null;
  const displayText =
    card?.combinedText ?? card?.resultText ?? props.text ?? "";
  const totalFiles =
    card?.totalFiles ?? card?.files.length ?? props.files?.length ?? 0;
  const totalRequests = card?.subRequests?.length ?? (displayText ? 1 : 0);
  const completedRequests = card?.subRequests
    ? card.subRequests.filter((sub) => sub.status === "complete").length
    : card?.status === "complete"
      ? 1
      : 0;
  const pendingRetries = card?.pendingRetryCount ?? 0;

  return (
    <Dialog open={Boolean(props.openId)} onOpenChange={props.onOpenChange}>
      {props.openId ? (
        <DialogContent
          showCloseButton={false}
          className="max-w-3xl w-full max-h-[80vh] p-0"
        >
          <div className="flex flex-wrap gap-2 items-center justify-between border-b px-4 py-2">
            <DialogTitle className="text-sm">Result</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => props.onCopy(displayText)}
                disabled={!displayText}
              >
                Copy
              </Button>
              <DownloadMenu
                text={displayText}
                suggestedBaseName={
                  card?.files?.[0]?.name ?? props.files?.[0]?.name
                }
                variant="outline"
                size="sm"
              />
              <DialogClose asChild>
                <Button size="sm">Close</Button>
              </DialogClose>
            </div>
          </div>
          <div className="p-4 overflow-auto max-h-[70vh] space-y-4">
            {card ? (
              <ul className="grid gap-1 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-center justify-between gap-2">
                  <span>Total files</span>
                  <span className="font-medium text-foreground">
                    {totalFiles.toLocaleString()}
                  </span>
                </li>
                {totalRequests ? (
                  <li className="flex items-center justify-between gap-2">
                    <span>Requests launched</span>
                    <span className="font-medium text-foreground">
                      {totalRequests.toLocaleString()}
                    </span>
                  </li>
                ) : null}
                {totalRequests ? (
                  <li className="flex items-center justify-between gap-2">
                    <span>Completed</span>
                    <span className="font-medium text-foreground">
                      {completedRequests.toLocaleString()}
                    </span>
                  </li>
                ) : null}
                {pendingRetries ? (
                  <li className="flex items-center justify-between gap-2">
                    <span>Retries pending</span>
                    <span className="font-medium text-foreground">
                      {pendingRetries.toLocaleString()}
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {props.audioFile ? (
              <div>
                <AudioPlayer file={props.audioFile} />
              </div>
            ) : null}
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">View:</span>
              <Button size="sm" variant="outline" onClick={props.onToggleRaw}>
                {props.raw ? "Preview" : "Raw"}
              </Button>
            </div>
            {props.raw ? (
              <pre className="whitespace-pre-wrap text-sm max-h-[45vh] overflow-auto">
                {displayText}
              </pre>
            ) : (
              <div className="text-sm max-h-[45vh] overflow-auto border rounded p-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayText || ""}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
