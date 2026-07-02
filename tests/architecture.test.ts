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

/**
 * Every first-party source file under app/ plus the root build configs, so
 * new files can't dodge a lock and the sweeps really cover the whole tree.
 */
const appFiles = readdirSync(join(ROOT, "app"), { recursive: true })
  .map(String)
  .filter((f) => /\.(ts|tsx|css)$/.test(f))
  .map((f) => `app/${f}`)
  .concat(["next.config.ts", "postcss.config.mjs", "eslint.config.mjs"]);

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

describe("the schematic sheet holds its structure", () => {
  it("the whole tree runs exactly one ambient background canvas", () => {
    // The old dual-canvas particle layer stays dead: one SignalField only.
    // (Case-sensitive on purpose: r3f's <Canvas> is the 3D core, not an
    // ambient 2D layer.)
    const total = appFiles
      .map((rel) => (read(rel).match(/<canvas\b/g) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });

  it("the schematic and the terminal are wired into the page", () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(/from ["']\.\/Schematic["']/);
    expect(page).toContain("<Schematic");
    expect(page).toContain("divisions={divisions}");
    expect(page).toContain("<Terminal");
    expect(page).toContain("onNavigate={navigate}");
  });

  it("the production divisions data seats the schematic geometry exactly", () => {
    // Schematic throws on any count other than its seat count; a fifth
    // division added to the page data must fail HERE, not in production.
    const dataEntries = read("app/page.tsx").match(/codename: "/g) ?? [];
    const seats = read("app/Schematic.tsx").match(/trace: "M /g) ?? [];
    expect(seats).toHaveLength(4);
    expect(dataEntries).toHaveLength(seats.length);
  });

  it("reveal styles can only hide content behind the JS arming class", () => {
    // No-JS readers and crawlers must always get a fully visible page: any
    // selector that styles [data-reveal] must be scoped under the class the
    // page adds after hydration. Parsed brace-agnostically so formatting
    // (brace on next line, @media wrapping, [data-reveal=""] forms) cannot
    // smuggle an unscoped rule past the lock.
    const css = read("app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = css
      .split("{")
      .slice(0, -1)
      .map((chunk) => chunk.slice(chunk.lastIndexOf("}") + 1).trim())
      .filter((selector) => selector.includes("[data-reveal"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector, `unscoped reveal selector: ${selector}`).toContain("html.reveal-armed");
    }
  });

  it("both terminal exhaustiveness locks are present", () => {
    // One for the effect switch, one for lineClass — deleting either is a
    // regression even while the other still satisfies a naive grep.
    const terminal = read("app/Terminal.tsx");
    expect(terminal.match(/const unhandled: never/g)).toHaveLength(2);
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
