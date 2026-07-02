import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLATES } from "../app/shell";

// =========================================================================
// ARCHITECTURAL-GUARDRAIL LAYER (LAW V, layer 1) — structural locks that
// pin the site's wiring against refactor drift. These read the tree on
// disk; the runtime layer lives in the sibling test files.
// =========================================================================

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Every first-party source file under app/, so new files can't dodge a lock. */
const appFiles = readdirSync(join(ROOT, "app"), { recursive: true })
  .map(String)
  .filter((f) => /\.(ts|tsx|css)$/.test(f))
  .map((f) => `app/${f}`);

describe("dead weight stays dead — across the WHOLE tree", () => {
  it("no first-party module imports the removed dependencies", () => {
    for (const rel of appFiles) {
      const src = read(rel);
      expect(src, `${rel} must not use drei`).not.toContain("@react-three/drei");
      expect(src, `${rel} must not use lucide`).not.toContain("lucide-react");
    }
    const pkg = JSON.parse(read("package.json"));
    for (const bucket of [pkg.dependencies, pkg.devDependencies]) {
      expect(bucket["@react-three/drei"]).toBeUndefined();
      expect(bucket["lucide-react"]).toBeUndefined();
    }
  });

  it("no first-party module draws from an unseeded source, ever", () => {
    for (const rel of appFiles) {
      expect(read(rel), `${rel} must stay deterministic`).not.toContain("Math.random");
    }
  });

  it("the site stays tracker-free — across the whole tree", () => {
    for (const rel of appFiles) {
      expect(read(rel), `${rel} must carry no trackers`).not.toMatch(
        /gtag|googletagmanager|hotjar|segment\.com|plausible|posthog|mixpanel/i
      );
    }
  });
});

describe("the terminal is wired to the shell", () => {
  it("Terminal delegates to the pure interpreter and executes every effect kind", () => {
    const terminal = read("app/Terminal.tsx");
    expect(terminal).toMatch(/from ["']\.\/shell["']/);
    expect(terminal).toContain("execute(");
    expect(terminal).toContain("autocomplete(");
    for (const kind of ["close", "clear", "contact", "scroll"]) {
      expect(terminal, `effect "${kind}" is executed`).toContain(`case "${kind}"`);
    }
    // The exhaustiveness lock itself: a new effect kind must fail the build.
    expect(terminal).toContain("const unhandled: never");
  });

  it("every chapter the shell can cd to exists as a section on the page", () => {
    const page = read("app/page.tsx");
    for (const plate of PLATES) {
      expect(page, `section #${plate.slug} exists`).toContain(`id="${plate.slug}"`);
    }
    expect(page).toContain('id="hero"');
  });
});

describe("the fonts are wired", () => {
  it("layout loads Geist Sans + Geist Mono and hands them to CSS", () => {
    const layout = read("app/layout.tsx");
    for (const v of ["--font-geist-sans", "--font-geist-mono"]) {
      expect(layout).toContain(v);
    }
    const css = read("app/globals.css");
    expect(css).toContain("--font-sans: var(--font-geist-sans)");
    expect(css).toContain("--font-mono: var(--font-geist-mono)");
  });

  it("the site stays dark", () => {
    expect(read("app/layout.tsx")).toContain('themeColor: "#05050a"');
  });
});
