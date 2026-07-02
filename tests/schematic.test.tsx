// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Schematic, { type SchematicDivision } from "../app/Schematic";

// =========================================================================
// RUNTIME-ADVERSARIAL LAYER — the schematic instrument really renders its
// controls, really reports selection, and really rejects geometry it
// cannot draw. This drives the real component, no mocks.
// =========================================================================

afterEach(cleanup);

const fourDivisions: SchematicDivision[] = [
  { id: 1, name: "SOFTWARE", codename: "PRODUCTS & SYSTEMS", color: "#ffaa00" },
  { id: 2, name: "CAPITAL", codename: "TRADING & INVESTMENT", color: "#00e5ff" },
  { id: 3, name: "RESEARCH", codename: "TECHNICAL EXPLORATION", color: "#8b7cff" },
  { id: 4, name: "VENTURES", codename: "INCUBATION & COMPANY BUILDING", color: "#ff2e63" },
];

describe("the schematic instrument", () => {
  it("renders one real button per division and marks the active node", () => {
    render(
      <Schematic
        divisions={fourDivisions}
        activeIndex={2}
        onSelect={() => {}}
        core={<div data-testid="core-slot" />}
      />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(screen.getByRole("button", { name: /RESEARCH/ }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: /SOFTWARE/ }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    // The core slot the page wires in is really mounted in the socket.
    expect(screen.getByTestId("core-slot")).toBeTruthy();
  });

  it("clicking a node reports its index to the page", () => {
    const onSelect = vi.fn();
    render(
      <Schematic divisions={fourDivisions} activeIndex={0} onSelect={onSelect} core={null} />
    );
    fireEvent.click(screen.getByRole("button", { name: /VENTURES/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(3);
  });

  it("rejects a division count the geometry cannot seat — loudly, at render", () => {
    const fiveDivisions = [
      ...fourDivisions,
      { id: 5, name: "PHANTOM", codename: "DOES NOT FIT", color: "#ffffff" },
    ];
    // React logs render-phase throws; keep the suite's output clean while
    // still asserting the hard rejection.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <Schematic divisions={fiveDivisions} activeIndex={0} onSelect={() => {}} core={null} />
        )
      ).toThrow(/seats/);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
