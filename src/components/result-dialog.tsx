"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export function ResultDialog(props: {
  openId: string | null;
  onOpenChange: (open: boolean) => void;
  markdown?: string;
  raw: boolean;
  onToggleRaw: () => void;
  onCopy: (text?: string) => void;
}) {
  return (
    <Dialog open={Boolean(props.openId)} onOpenChange={props.onOpenChange}>
      {props.openId ? (
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
                onClick={() => props.onCopy(props.markdown)}
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
              <Button size="sm" variant="outline" onClick={props.onToggleRaw}>
                {props.raw ? "Preview" : "Raw"}
              </Button>
            </div>
            {props.raw ? (
              <pre className="whitespace-pre-wrap text-sm">
                {props.markdown}
              </pre>
            ) : (
              <div className="text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {props.markdown || ""}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
