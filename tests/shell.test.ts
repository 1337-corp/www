import { describe, expect, it } from "vitest";
import { DIRECTIVES, PLATES, autocomplete, execute } from "../app/shell";

// =========================================================================
// RUNTIME-ADVERSARIAL LAYER — the channel rejects the unknown loudly and
// never silently swallows input (LAW III / LAW IV).
// =========================================================================

const ctx = { contactShown: false };

describe("execute — rejection is loud", () => {
  it("rejects an unknown command with an error line and no effects", () => {
    const r = execute("sudo rm -rf /", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines.some((l) => l.type === "error")).toBe(true);
  });

  it("rejects cd to a plate that does not exist", () => {
    const r = execute("cd mainframe", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines[0].type).toBe("error");
    expect(r.lines[0].text).toContain("mainframe");
  });

  it("rejects cd .. — there is nothing above the root", () => {
    const r = execute("cd ..", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines[0].type).toBe("error");
  });

  it("does nothing at all for blank input", () => {
    expect(execute("   ", ctx)).toEqual({ lines: [], effects: [] });
  });
});

describe("execute — navigation", () => {
  it("cd reaches every plate and closes the channel", () => {
    for (const plate of PLATES) {
      const r = execute(`cd ${plate.slug}`, ctx);
      expect(r.effects).toContainEqual({ kind: "scroll", target: plate.slug });
      expect(r.effects).toContainEqual({ kind: "close" });
      expect(r.lines.some((l) => l.type === "error")).toBe(false);
    }
  });

  it("cd with no argument (and cd ~) returns to the station point and closes", () => {
    for (const raw of ["cd", "cd ~", "cd /"]) {
      const r = execute(raw, ctx);
      expect(r.effects).toContainEqual({ kind: "scroll", target: "top" });
      expect(r.effects).toContainEqual({ kind: "close" });
    }
  });

  it("cd tolerates a trailing slash, as a shell would", () => {
    const r = execute("cd divisions/", ctx);
    expect(r.effects).toContainEqual({ kind: "scroll", target: "divisions" });
  });

  it("commands are case-insensitive and ignore trailing arguments", () => {
    expect(execute("CD SPECTRUM", ctx).effects).toContainEqual({ kind: "scroll", target: "spectrum" });
    expect(execute("cd divisions extra", ctx).effects).toContainEqual({
      kind: "scroll",
      target: "divisions",
    });
    expect(execute("HELP", ctx).lines.length).toBeGreaterThan(0);
  });

  it("ls lists every plate", () => {
    const r = execute("ls", ctx);
    const text = r.lines.map((l) => l.text).join("\n");
    for (const plate of PLATES) expect(text).toContain(`${plate.slug}/`);
  });
});

describe("execute — the contact channel", () => {
  it("opens once", () => {
    const r = execute("contact", { contactShown: false });
    expect(r.effects).toContainEqual({ kind: "contact" });
  });

  it("is idempotent when already open", () => {
    const r = execute("contact", { contactShown: true });
    expect(r.effects).toHaveLength(0);
    expect(r.lines[0].type).toBe("success");
  });
});

describe("execute — housekeeping", () => {
  it("exit closes, clear clears", () => {
    expect(execute("exit", ctx).effects).toEqual([{ kind: "close" }]);
    expect(execute("clear", ctx).effects).toEqual([{ kind: "clear" }]);
  });

  it("help documents every public directive except cd's argument form", () => {
    const text = execute("help", ctx).lines.map((l) => l.text).join("\n");
    for (const d of DIRECTIVES) {
      if (d === "help") continue; // help doesn't advertise itself
      // Line-anchored: each directive owns its own help line, so a mention
      // inside another line's usage text can't satisfy the floor.
      expect(text).toMatch(new RegExp(`^\\s{2}${d}\\b`, "m"));
    }
  });

});

describe("autocomplete", () => {
  it("completes directives", () => {
    expect(autocomplete("he")).toBe("lp");
    expect(autocomplete("con")).toBe("tact");
    expect(autocomplete("help")).toBe(""); // already complete
  });

  it("completes chapter slugs after cd", () => {
    expect(autocomplete("cd div")).toBe("isions");
    expect(autocomplete("cd divisions")).toBe("");
    expect(autocomplete("cd zz")).toBe("");
  });

  it("offers nothing for the unknown or the empty", () => {
    expect(autocomplete("")).toBe("");
    expect(autocomplete("xyzzy")).toBe("");
    expect(autocomplete("ls -la")).toBe("");
  });
});
