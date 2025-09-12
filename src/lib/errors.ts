export function formatModelError(err: unknown): string {
  let msg = "Unknown error";
  if (err == null) msg = "Unknown error";
  else if (typeof err === "string") msg = err;
  else if (err instanceof Error) msg = err.message || "Error";
  else {
    try {
      msg = JSON.stringify(err);
    } catch {
      msg = String(err);
    }
  }
  const lower = (msg || "").toLowerCase();
  if (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("invalid_argument")
  ) {
    return "Invalid API key. Open ‘Get an API key’, paste it, and press Save.";
  }
  return msg;
}
