// =========================================================================
// THE TERMINAL — pure command interpreter
//
// The domain is a command: 1337.cd. So `cd` works here. This module is
// pure — it maps an input line to output lines plus effects, and the UI
// executes the effects. Unknown input is rejected loudly, never swallowed.
// =========================================================================

export type LineType = "system" | "input" | "error" | "success" | "header";

export interface TermLine {
  text: string;
  type: LineType;
}

export type TermEffect =
  | { kind: "close" }
  | { kind: "clear" }
  | { kind: "scroll"; target: string }
  | { kind: "contact" };

export interface TermResult {
  lines: TermLine[];
  effects: TermEffect[];
}

/** The site's chapters, in reading order. Slugs are section element ids. */
export const PLATES = [
  { numeral: "I", slug: "about", title: "Covenant" },
  { numeral: "II", slug: "divisions", title: "Architecture" },
  { numeral: "III", slug: "spectrum", title: "Spectrum" },
  { numeral: "IV", slug: "contact", title: "Transmission" },
] as const;

/** Commands surfaced to autocomplete and `help`. */
export const DIRECTIVES = ["help", "ls", "cd", "contact", "whoami", "clear", "exit"] as const;

export const CONTACT_EMAIL = "hello@1337.cd";

const sys = (text: string): TermLine => ({ text, type: "system" });
const err = (text: string): TermLine => ({ text, type: "error" });
const head = (text: string): TermLine => ({ text, type: "header" });

/**
 * Interpret one input line. `contactShown` lets `contact` respond
 * idempotently instead of re-running its reveal.
 */
export function execute(raw: string, ctx: { contactShown: boolean }): TermResult {
  const trimmed = raw.trim();
  if (!trimmed) return { lines: [], effects: [] };

  const parts = trimmed.split(/\s+/);
  const primary = parts[0].toLowerCase();

  switch (primary) {
    case "exit":
      return { lines: [], effects: [{ kind: "close" }] };

    case "clear":
      return { lines: [], effects: [{ kind: "clear" }] };

    case "help":
      return {
        lines: [
          head("AVAILABLE COMMANDS"),
          sys("  ls           list the chapters"),
          sys("  cd <chapter> go to a chapter (cd divisions, cd contact, …)"),
          sys("  contact      show the primary email"),
          sys("  whoami       who is reading"),
          sys("  clear        clear session"),
          sys("  exit         close terminal"),
        ],
        effects: [],
      };

    case "ls":
      return {
        lines: [
          sys("total 4"),
          ...PLATES.map((p) => sys(`drwxr-xr-x  ${p.numeral.padEnd(4)} ${p.slug}/`)),
        ],
        effects: [],
      };

    case "cd": {
      const arg = parts[1]?.toLowerCase();
      if (!arg || arg === "~" || arg === "/") {
        return {
          lines: [],
          effects: [{ kind: "scroll", target: "top" }, { kind: "close" }],
        };
      }
      if (arg === "..") {
        return { lines: [err("cd: you are already at the root.")], effects: [] };
      }
      const plate = PLATES.find((p) => p.slug === arg.replace(/\/$/, ""));
      if (!plate) {
        return { lines: [err(`cd: no such chapter: ${arg} (try 'ls')`)], effects: [] };
      }
      return {
        lines: [sys(`CHAPTER ${plate.numeral} — ${plate.title.toUpperCase()}`)],
        effects: [{ kind: "scroll", target: plate.slug }, { kind: "close" }],
      };
    }

    case "whoami":
      return { lines: [sys("guest")], effects: [] };

    case "contact":
      if (ctx.contactShown) {
        return { lines: [{ text: "Contact already displayed.", type: "success" }], effects: [] };
      }
      return { lines: [sys("Opening contact channel…")], effects: [{ kind: "contact" }] };

    default:
      return {
        lines: [err(`Command not recognized: ${primary}. Type 'help' or 'contact' for options.`)],
        effects: [],
      };
  }
}

/**
 * Tab completion: completes directives, and chapter slugs after `cd `.
 * Returns only the missing suffix (the ghost the UI paints).
 */
export function autocomplete(input: string): string {
  const clean = input.trimStart();
  if (!clean) return "";
  const lower = clean.toLowerCase();
  if (/^cd\s+\S*$/.test(lower)) {
    const arg = lower.replace(/^cd\s+/, "");
    const match = PLATES.find((p) => p.slug.startsWith(arg) && p.slug !== arg);
    return match ? match.slug.slice(arg.length) : "";
  }
  if (/\s/.test(lower)) return "";
  const match = DIRECTIVES.find((d) => d.startsWith(lower) && d !== lower);
  return match ? match.slice(lower.length) : "";
}
