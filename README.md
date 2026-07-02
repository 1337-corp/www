# 1337 Corp — 1337.cd

The public site for 1337 Corp: a single, cinematic page built as a deliberate
work of interface craft. Dark, kinetic, and quiet.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **react-three-fiber** / **three** — the 3D "Veil" core (code-split; never in
  the initial bundle)
- **framer-motion** — UI motion + reduced-motion orchestration
- **Tailwind CSS v4**
- **TypeScript** (strict, `noImplicitReturns`) · **Vitest** for the regression floor

## Where things live

- `app/page.tsx` — everything the visitor sees: nav, chapters, canvas
  background, glitch logo, custom cursor
- `app/VeilCanvas.tsx` / `app/CoreFallback.tsx` — the divisions' 3D core
- `app/shell.ts` / `app/Terminal.tsx` — pure command interpreter / terminal UI
- `app/media.ts` — SSR-safe capability hooks (reduced motion, WebGL, pointer)
- `app/graphics.ts` — seeded hash + WebGL detection
- `tests/` — regression floor (runtime-adversarial + architectural guardrails)
- SEO surfaces (`robots.ts`, `sitemap.ts`, `opengraph-image.tsx`,
  `twitter-image.tsx`) are generated at the route level

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

## Verify

```bash
npm test         # vitest (must be green)
npm run build    # production build + types
npx eslint .     # lint (must be clean)
```

## Notes

- The experience degrades gracefully: no WebGL, or `prefers-reduced-motion`,
  yields a static fallback instead of a blank screen.
- Press `` ` `` or `/` (outside a text field) or `⌘/Ctrl-K` to open the contact
  terminal; `Esc` closes it. Type `contact` for the primary email. `ls` and
  `cd <chapter>` also work.
