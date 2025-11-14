"use client";

import { RequestCard } from "@/components/request-card";
import { Button } from "@/components/ui/button";
import type { Card } from "@/types";

export function RequestsSection(props: {
  cards: Card[];
  rawViewById: Record<string, boolean>;
  onToggleRaw: (id: string) => void;
  onCopy: (text?: string) => void;
  onExpand: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (card: Card) => void;
  onRetrySubRequest?: (cardId: string, subRequestId: string) => void;
  onClearAll: () => void;
  onClose: (id: string) => void;
}) {
  const {
    cards,
    rawViewById,
    onToggleRaw,
    onCopy,
    onExpand,
    onCancel,
    onRetry,
    onRetrySubRequest,
    onClearAll,
    onClose,
  } = props;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Requests ({cards.length})</h2>
        {cards.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            aria-label="Clear all requests"
          >
            Clear all
          </Button>
        ) : null}
      </div>
      <div className="space-y-3">
        {cards.length === 0 && (
          <div className="text-sm text-muted-foreground">No requests yet.</div>
        )}
        {cards.map((card) => (
          <RequestCard
            key={card.id}
            card={card}
            raw={!!rawViewById[card.id]}
            onToggleRaw={() => onToggleRaw(card.id)}
            onCopy={onCopy}
            onExpand={onExpand}
            onCancel={onCancel}
            onRetry={onRetry}
            onRetrySubRequest={onRetrySubRequest}
            onClose={onClose}
          />
        ))}
      </div>
    </section>
  );
}
