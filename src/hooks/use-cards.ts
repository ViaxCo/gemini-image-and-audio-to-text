"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Card } from "@/types";

export function useCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rawViewById, setRawViewById] = useState<Record<string, boolean>>({});
  const controllersRef = useRef<Record<string, AbortController | undefined>>(
    {},
  );

  const clearAllRequests = useCallback(() => {
    try {
      Object.values(controllersRef.current).forEach((c) => {
        c?.abort();
      });
    } catch {}
    controllersRef.current = {};
    setCards([]);
    setExpandedId(null);
    setRawViewById({});
  }, []);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === (expandedId ?? "")),
    [cards, expandedId],
  );

  return {
    cards,
    setCards,
    expandedId,
    setExpandedId,
    rawViewById,
    setRawViewById,
    controllersRef,
    clearAllRequests,
    selectedCard,
  } as const;
}
