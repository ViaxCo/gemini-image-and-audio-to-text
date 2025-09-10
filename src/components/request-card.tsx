"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardTitle,
  Card as UICard,
} from "@/components/ui/card";

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

export type Card = {
  id: string;
  prompt: string;
  files: { name: string; size: number; type: string }[];
  filesBlob?: { file: File }[];
  status: "processing" | "complete" | "failed";
  resultMarkdown?: string;
  error?: string;
  createdAt: number;
  usage?: Usage;
  usageTotal?: number;
};

export function RequestCard(props: {
  card: Card;
  raw: boolean;
  onToggleRaw: () => void;
  onCopy: (text?: string) => void;
  onExpand: (id: string) => void;
  onRetry: (card: Card) => void;
}) {
  const { card } = props;
  const tokensTitle = card.usage
    ? `Input: ${card.usage.inputTokens ?? "?"} • Output: ${card.usage.outputTokens ?? "?"} • Total: ${card.usage.totalTokens ?? "?"}`
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
            <div className="text-xs uppercase tracking-wide opacity-70">
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
              <span className="opacity-70">Reasoning</span>
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
        <div className="text-xs text-muted-foreground mb-2">
          {card.files.length} file(s)
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
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            onClick={() => props.onCopy(card.resultMarkdown)}
            disabled={!card.resultMarkdown}
          >
            Copy
          </Button>
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
