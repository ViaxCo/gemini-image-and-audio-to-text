export type UserContent =
  | { type: "text"; text: string }
  | { type: "file"; data: Uint8Array; mediaType: string };

export type FullStreamPart =
  | { type: "text"; text?: string }
  | { type: "abort" }
  | { type: "text-delta"; text?: string; delta?: string; textDelta?: string }
  | { type: "error"; error?: unknown }
  | { type: string; [k: string]: unknown };
