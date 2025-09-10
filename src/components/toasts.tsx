"use client";

export function Toasts(props: {
  toasts: {
    id: string;
    msg: string;
    variant?: "success" | "warning" | "destructive";
  }[];
}) {
  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {props.toasts.map((t) => (
        <div
          key={t.id}
          className={
            "rounded-md border px-3 py-2 text-sm shadow-md " +
            (t.variant === "success"
              ? "bg-emerald-600/10 border-emerald-600/30 text-emerald-800 dark:text-emerald-200"
              : t.variant === "warning"
                ? "bg-amber-600/10 border-amber-600/30 text-amber-800 dark:text-amber-200"
                : t.variant === "destructive"
                  ? "bg-red-600/10 border-red-600/30 text-red-800 dark:text-red-200"
                  : "bg-accent/40 border-accent")
          }
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
