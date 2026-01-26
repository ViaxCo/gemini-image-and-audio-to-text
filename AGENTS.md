# IMPORTANT Guidelines

- Use shadcn/ui for all components.
- When using shadcn components, use the MCP server.
  - Prefer full blocks when applicable (e.g., login, calendar, dashboard).
  - Before implementing, call the demo tool to see correct usage and props.
- Every UI change must be mobile‑first and responsive.
- Use Context7 to look up documentation for every package you interact with.
- Only commit when explicitly requested.
- Always run `npm run pretest` after changes.
- Never start the dev server.
- Always implement simple code that is easy to read, understand and maintain.
- If a file gets too large, split it up into smaller pieces.
