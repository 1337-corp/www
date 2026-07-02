// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Terminal from "../app/Terminal";

// jsdom implements neither scrollIntoView nor real layout; stub the one
// method the component calls so the real effect code still runs.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
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

  it("Tab completes a partial directive in place", () => {
    const { input } = openChannel();
    fireEvent.change(input, { target: { value: "con" } });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input.value).toBe("contact");
  });
});
