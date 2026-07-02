// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Terminal from "../app/Terminal";

// jsdom implements neither scrollIntoView, real layout, nor matchMedia;
// stub the two APIs the component touches so the real effect code still
// runs. The matchMedia stub reports "no preference" — the default a real
// browser gives — so the production reduced-motion branch is exercised.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof window.matchMedia;
});

// =========================================================================
// RUNTIME-ADVERSARIAL LAYER — the channel UI really executes what the
// shell decides. This drives the real component: real keystrokes, real
// effect execution, no mocked interpreter.
// =========================================================================

afterEach(cleanup);

function openChannel() {
  const onClose = vi.fn();
  const onNavigate = vi.fn(() => true);
  render(<Terminal isOpen onClose={onClose} onNavigate={onNavigate} />);
  const input = screen.getByLabelText("Command input") as HTMLInputElement;
  return { onClose, onNavigate, input };
}

function type(input: HTMLInputElement, command: string) {
  fireEvent.change(input, { target: { value: command } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("the signal channel executes the shell's effects", () => {
  it("cd works → navigates to the plate and closes the channel", () => {
    const { onClose, onNavigate, input } = openChannel();
    type(input, "cd divisions");
    expect(onNavigate).toHaveBeenCalledWith("divisions");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a failed cd stays open and prints the fault", () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn(() => false); // the plate is unreachable
    render(<Terminal isOpen onClose={onClose} onNavigate={onNavigate} />);
    const input = screen.getByLabelText("Command input") as HTMLInputElement;
    type(input, "cd divisions");
    expect(onNavigate).toHaveBeenCalledWith("divisions");
    expect(onClose).not.toHaveBeenCalled(); // the error must be seen
    expect(screen.getByText(/chapter unreachable/)).toBeTruthy();
  });

  it("an unknown command prints a loud rejection and triggers nothing", () => {
    const { onClose, onNavigate, input } = openChannel();
    type(input, "sudo make me a sandwich");
    expect(screen.getByText(/Command not recognized/)).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("exit closes; Escape closes", () => {
    const first = openChannel();
    type(first.input, "exit");
    expect(first.onClose).toHaveBeenCalledTimes(1);
    cleanup();

    const second = openChannel();
    fireEvent.keyDown(second.input, { key: "Escape" });
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it("contact reveals the primary channel", () => {
    const { input } = openChannel();
    type(input, "contact");
    expect(screen.getByText("PRIMARY CONTACT")).toBeTruthy();
  });

  it("clear really empties the session buffer, including the contact card", () => {
    const { input } = openChannel();
    type(input, "help");
    type(input, "contact");
    expect(screen.getByText(/AVAILABLE COMMANDS/)).toBeTruthy();
    expect(screen.getByText("PRIMARY CONTACT")).toBeTruthy();
    type(input, "clear");
    expect(screen.queryByText(/AVAILABLE COMMANDS/)).toBeNull();
    expect(screen.queryByText("PRIMARY CONTACT")).toBeNull();
    expect(screen.queryByText("1337 CONTACT — INTERFACE")).toBeNull();
  });

  it("Tab completes a partial directive in place", () => {
    const { input } = openChannel();
    fireEvent.change(input, { target: { value: "con" } });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input.value).toBe("contact");
  });

  it("contact decrypts to the real primary email — not scrambled residue", () => {
    vi.useFakeTimers();
    try {
      const { input } = openChannel();
      type(input, "contact");
      // The scramble runs 11 ticks at 55ms; drive it past completion.
      act(() => {
        vi.advanceTimersByTime(55 * 12);
      });
      expect(screen.getByText("hello@1337.cd")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("arrow keys walk the command history in both directions", () => {
    const { input } = openChannel();
    type(input, "ls");
    type(input, "whoami");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("whoami");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("ls");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe("whoami");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe("");
  });
});
