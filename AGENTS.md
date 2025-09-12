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

---

## Agents Runbook

## Purpose

This repo is a Next.js 15 (App Router) app that performs image → Markdown OCR using Google Gemini via the Vercel AI SDK. The UI is built with shadcn/ui primitives and follows mobile‑first Tailwind v4 styling.

## Tech Stack (key packages)

- Next.js 15, React 19, Tailwind CSS v4
- Vercel AI SDK v5 (`ai`) + `@ai-sdk/google` (model: `gemini-2.5-flash`)
- shadcn/ui (Radix primitives), `next-themes`, `lucide-react`
- Biome for lint/format

## Workspace Layout

- `src/app` — App Router entry (`layout.tsx`, `page.tsx`, `globals.css`).
- `src/app/api/ocr` — Route handler that streams OCR results.
- `src/components` — Reusable UI (shadcn/ui primitives + app components).
- `src/lib` — Utilities (`cn` helper).
- `public` — Static assets.

## Development Commands

- `npm run dev` — Start local dev server (Turbopack).
- `npm run build` — Production build.
- `npm start` — Run the built app.
- `npm run lint` — Biome linting and checks.
- `npm run format` — Apply Biome formatting.

## Implementation Rules for Agents

- UI:
  - Use shadcn/ui primitives; prefer blocks when they fit the page.
  - Always design mobile‑first; scale up with responsive classes (`sm:`, `md:`, `lg:`).
  - Keep interactions accessible (labels, `aria-*`, keyboard focus states).
- Data flow:
  - Route: `POST /api/ocr` accepts `form-data` with `prompt` and one or more `files` (JPEG/PNG).
  - Server streams responses using AI SDK data stream protocol; client parses SSE `data:` lines.
  - Emit usage metadata; render token counts when available.
- Error handling:
  - Validate files on the client (type + size) and handle empty results.
  - On server, return structured JSON errors with appropriate status codes.
- Styling:
  - Tailwind v4 utilities; use `cn()` for conditional classes.
  - Respect dark mode using `next-themes` and `ThemeToggle`.
- Security:
  - Never expose secrets in the client. Read `GOOGLE_GENERATIVE_AI_API_KEY` on the server only.

## MCP + shadcn/ui Usage

- Use the MCP server to fetch shadcn/ui components/blocks.
- Before adding a component:
  1. Call the component’s demo tool to review API/usage.
  2. Scaffold using the MCP result, then adapt minimal styling.
  3. Ensure mobile‑first responsiveness and accessibility.

## Context7 Usage

- Before touching a package, query Context7 for its docs (e.g., Next.js, AI SDK, shadcn/ui, Tailwind, Biome).
- Prefer official documentation and reference the exact version when relevant.

## Coding Style & Naming

- TypeScript with functional components and hooks; prefer server components when possible in App Router.
- File names: `kebab-case.tsx` for components. Group by domain under `src/`.
- Keep components small, composable, and colocate UI primitives under `src/components/ui`.

## PR & Commit Policy

- Do not commit unless explicitly requested.
- When committing: short imperative subject + focused scope (e.g., `feat(ui): add markdown preview toggle`).

## Environment

- Required: `.env.local` with `GOOGLE_GENERATIVE_AI_API_KEY`.
- Client uploads are limited to JPEG/PNG; UI enforces ≤10 MB per file.

## Review Checklist

- [ ] shadcn/ui primitives or blocks only; MCP demo consulted
- [ ] Mobile‑first responsive
- [ ] No leaked secrets; server‑only API keys
- [ ] Pretest passes; formatted with `npm run pretest`
- [ ] Accessible labels, roles, focus, and contrast
- [ ] Code implementation is simple, easy to read and maintain. 
