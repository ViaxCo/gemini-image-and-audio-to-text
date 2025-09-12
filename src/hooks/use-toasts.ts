"use client";

import { useCallback, useState } from "react";

export type Toast = {
  id: string;
  msg: string;
  variant?: "success" | "warning" | "destructive";
};

export function useToasts(ttl = 2400) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (msg: string, variant?: Toast["variant"]) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, msg, variant }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        ttl,
      );
    },
    [ttl],
  );

  return { toasts, addToast } as const;
}
