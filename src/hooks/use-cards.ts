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

  const removeCard = useCallback(
    (id: string) => {
      setCards((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
      setRawViewById((prev) => {
        const newRaw = { ...prev };
        delete newRaw[id];
        return newRaw;
      });
      if (controllersRef.current[id]) {
        try {
          controllersRef.current[id]?.abort();
        } catch {}
        delete controllersRef.current[id];
      }
    },
    [expandedId],
  );

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
    removeCard,
    selectedCard,
  } as const;
}
