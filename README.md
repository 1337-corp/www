# 1337 Corp — 1337.cd

The public site for 1337 Corp: a single, cinematic page built as a deliberate
work of interface craft. Dark, kinetic, and quiet.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **react-three-fiber** / **drei** / **three** — the 3D "Veil" core
- **framer-motion** — UI motion + reduced-motion orchestration
- **Tailwind CSS v4**
- **TypeScript** (strict)

Everything the visitor sees lives in `app/page.tsx`; global styling and fonts
are in `app/globals.css` and `app/layout.tsx`. SEO surfaces (`robots.ts`,
`sitemap.ts`, `opengraph-image.tsx`, `twitter-image.tsx`) are generated at the
route level.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
```

## Verify

```bash
npm run build    # production build
npx eslint .     # lint (must be clean)
npx tsc --noEmit # types
```

## Notes

- The experience degrades gracefully: no WebGL, or `prefers-reduced-motion`,
  yields a static fallback instead of a blank screen.
- Press `` ` `` or `/` (outside a text field) or `⌘/Ctrl-K` to open the contact
  terminal; `Esc` closes it. Type `contact` for the primary email.
