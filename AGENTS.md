## IMPORTANT Guidelines
- Use shadcn ui for all components.
- When using shadcn components, use the MCP server.
  - Apply components wherever components are applicable. Use whole blocks where possible (e.g., login page,
    calendar)
  - When implementing: First call the demo tool to see how it is used. Then implement it so that it is implemented correctly
- Every change you make to the UI in the codebase should be mobile first responsive.
- Use context7 to look up documentation for every package you interact with.
- Only commit when explicitly requested
- Always run `npm run lint` to ensure everything is working and formatted correctly

---

# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router entry points (`layout.tsx`, `page.tsx`).
- `src/app/api/ocr`: Route Handler for Gemini OCR streaming.
- `src/components`: Reusable UI (shadcn/ui primitives, theme provider/toggle).
- `src/lib`: Utilities (e.g., `cn` helper).
- `public`: Static assets.

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server (Turbopack).
- `npm run build`: Production build.
- `npm start`: Run the built app.
- `npm run lint`: Biome linting and checks.
- `npm run format`: Apply Biome formatting.

## Coding Style & Naming Conventions
- TypeScript, React 19, Next.js 15, Tailwind v4.
- Use functional components and hooks; prefer server components where possible.
- File names: `kebab-case.tsx` for components, domain folders under `src/`.
- Styling: Tailwind utility classes; use `cn()` for conditionals; mobile‑first.
- UI: Prefer shadcn/ui primitives and patterns.

## Commit Guidelines
- Commits: short imperative subject + focused scope (e.g., `feat(ui): add markdown preview toggle`).

## Security & Configuration Tips
- Never expose API keys client‑side. Use `.env.local` (`GOOGLE_GENERATIVE_AI_API_KEY`).
