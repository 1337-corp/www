"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { hash01 } from "./graphics";
import { useReducedMotionSafe } from "./media";
import {
  CONTACT_EMAIL,
  autocomplete,
  execute,
  type TermLine,
} from "./shell";

// The contact terminal. The interpreter lives in shell.ts (pure); this
// component owns only presentation, focus, and effect execution.

interface TerminalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Scroll the site to a section id ("top" for the hero). */
  onNavigate: (target: string) => boolean;
}

let lineKey = 0;
const keyed = (l: TermLine) => ({ ...l, id: `l${lineKey++}` });

// Keyed once at module load; ids are unique for the document's lifetime.
const OPENING = ([
  { text: "1337 CONTACT — INTERFACE", type: "header" },
  { text: "Type 'contact' to show the primary email, 'help' for the rest.", type: "system" },
] satisfies TermLine[]).map(keyed);

export default function Terminal({ isOpen, onClose, onNavigate }: TerminalProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState(OPENING);
  const [cmdStack, setCmdStack] = useState<string[]>([]);
  const [stackIndex, setStackIndex] = useState(-1);
  const [showContact, setShowContact] = useState(false);
  const [decryptedEmail, setDecryptedEmail] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const bufferEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = useReducedMotionSafe();

  const suggestion = useMemo(() => autocomplete(input), [input]);

  const append = (lines: TermLine[]) => {
    if (lines.length === 0) return;
    // Keys are minted OUTSIDE the state updater — updaters must stay pure.
    const next = lines.map(keyed);
    setHistory((prev) => [...prev, ...next]);
  };

  const stopScramble = () => {
    if (scrambleRef.current) {
      clearInterval(scrambleRef.current);
      scrambleRef.current = null;
    }
  };

  const revealContact = () => {
    setShowContact(true);
    stopScramble();
    let i = 0;
    scrambleRef.current = setInterval(() => {
      // Deterministic scramble — seeded, like every other mark on the site.
      const scrambled = CONTACT_EMAIL.split("")
        .map((ch, idx) =>
          idx < Math.floor((i / 10) * CONTACT_EMAIL.length)
            ? ch
            : String.fromCharCode(33 + Math.floor(hash01(i * 131.3 + idx * 7.7) * 94))
        )
        .join("");
      setDecryptedEmail(scrambled);
      i++;
      if (i > 10) {
        stopScramble();
        setDecryptedEmail(CONTACT_EMAIL);
      }
    }, 55);
  };

  const handleExecute = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setCmdStack((prev) => [trimmed, ...prev.filter((c) => c !== trimmed)]);
    setStackIndex(-1);
    setInput("");

    append([{ text: `guest@1337:~$ ${trimmed}`, type: "input" }]);
    const result = execute(trimmed, { contactShown: showContact });
    append(result.lines);

    // Close is applied after every other effect has run, so a failed cd
    // keeps the terminal open regardless of the emitter's effect order.
    let navigationFailed = false;
    let closeRequested = false;
    for (const effect of result.effects) {
      switch (effect.kind) {
        case "close":
          closeRequested = true;
          break;
        case "clear":
          stopScramble();
          setHistory([]);
          setShowContact(false);
          setDecryptedEmail("");
          break;
        case "contact":
          revealContact();
          break;
        case "scroll":
          if (!onNavigate(effect.target)) {
            navigationFailed = true;
            append([{ text: `cd: chapter unreachable: ${effect.target}`, type: "error" }]);
          }
          break;
        default: {
          // Compile-time exhaustiveness: a new effect kind fails the build
          // here instead of being silently dropped.
          const unhandled: never = effect;
          throw new Error(`terminal: unhandled effect ${JSON.stringify(unhandled)}`);
        }
      }
    }
    // A failed cd must stay open so its error line is actually seen.
    if (closeRequested && !navigationFailed) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleExecute(input);
    } else if (e.key === "Tab" && !e.shiftKey) {
      // Forward Tab completes when there is something to complete;
      // otherwise it falls through to the focus trap and moves focus.
      if (suggestion) {
        e.preventDefault();
        setInput((prev) => prev + suggestion);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdStack.length > 0 && stackIndex < cmdStack.length - 1) {
        const next = stackIndex + 1;
        setStackIndex(next);
        setInput(cmdStack[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (stackIndex > 0) {
        const next = stackIndex - 1;
        setStackIndex(next);
        setInput(cmdStack[next]);
      } else if (stackIndex === 0) {
        setStackIndex(-1);
        setInput("");
      }
    }
  };

  // Dialog-level keys: Escape dismisses; Tab is trapped inside the modal.
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    // When the input is completing (forward Tab with a live suggestion),
    // the input handler owns the keystroke.
    if (e.target === inputRef.current && !e.shiftKey && suggestion) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, input, [href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Explicit behavior:"smooth" overrides the CSS reduced-motion
  // kill-switch, so the preference is honored here in JS as well.
  useEffect(() => {
    if (bufferEndRef.current) {
      bufferEndRef.current.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }, [history, decryptedEmail, reduced]);

  // Focus management + teardown: remember the trigger, focus the input on
  // open; on close, finish any half-decrypted email (never leave the one
  // conversion path garbled) and restore focus without yanking the scroll
  // away from wherever `cd` just sent the reader.
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null;
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    if (scrambleRef.current) {
      clearInterval(scrambleRef.current);
      scrambleRef.current = null;
      setDecryptedEmail(CONTACT_EMAIL);
    }
    triggerRef.current?.focus?.({ preventScroll: true });
    return undefined;
  }, [isOpen]);

  // Clear the interval if the component unmounts mid-animation.
  useEffect(
    () => () => {
      if (scrambleRef.current) clearInterval(scrambleRef.current);
    },
    []
  );

  const lineClass = (type: TermLine["type"]): string => {
    switch (type) {
      case "header":
        return "text-white font-semibold tracking-wider";
      case "error":
        return "text-[#ff2e63]";
      case "success":
        return "text-[#00e5ff]";
      case "input":
        return "text-white/40";
      case "system":
        return "text-[#00ff9f]/80";
      default: {
        const unhandled: never = type;
        throw new Error(`terminal: unhandled line type ${JSON.stringify(unhandled)}`);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="terminal-backdrop"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="1337 contact terminal"
          onKeyDown={handleDialogKeyDown}
          onClick={(e) => {
            // Clicking the dark space around the panel closes the terminal.
            if (e.target === e.currentTarget) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
            className="w-full max-w-4xl overflow-hidden border border-white/10 bg-[#030306] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 bg-black/40 px-5 py-3 font-mono text-[10px]">
              <div className="flex items-center gap-6">
                <span aria-hidden="true" className="h-2 w-2 bg-[#00ff9f]/80" />
                <div className="tracking-[3px] text-white/40">
                  TTY 1337 <span className="text-white/20">·</span> SIGNAL SECURE
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close terminal"
                className="-my-2 -mr-3 flex h-11 w-11 items-center justify-center text-white/40 transition-colors hover:text-white"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div
              className="h-[min(380px,50dvh)] overflow-y-auto bg-[#040408]/90 p-6 font-mono text-[11px]"
              onClick={() => inputRef.current?.focus()}
            >
              {/* The command log announces its own output to screen readers.
                  The contact card lives OUTSIDE the live region so the
                  55ms decrypt scramble never spams announcements. */}
              <div role="log" className="space-y-1.5">
                {history.map((line) => (
                  <div
                    key={line.id}
                    className={`whitespace-pre-wrap leading-relaxed tracking-wide ${lineClass(line.type)}`}
                  >
                    {line.text}
                  </div>
                ))}
              </div>

              {showContact && (
                <div className="mt-4 border border-white/10 bg-white/[0.01] p-4">
                  <div className="mb-1 text-[9px] tracking-widest text-white/40">PRIMARY CONTACT</div>
                  <div className="select-all text-lg font-bold tracking-wider text-white">
                    {decryptedEmail}
                  </div>
                </div>
              )}
              <div ref={bufferEndRef} />
            </div>

            <div className="relative flex items-center border-t border-white/5 bg-black/40 px-5 py-3.5 font-mono text-[11px]">
              <span className="mr-2.5 font-bold text-[#00ff9f]">guest@1337:~$</span>
              <div className="relative flex flex-1 items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="z-10 w-full bg-transparent text-white outline-none placeholder:text-white/40 [@media(pointer:coarse)]:text-base"
                  placeholder="type command…"
                  aria-label="Command input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {input && suggestion && (
                  // Decorative ghost — it would read as duplicated input to AT.
                  <span aria-hidden="true" className="pointer-events-none absolute left-0 text-transparent">
                    {input}
                    <span className="text-white/30">{suggestion}</span>
                  </span>
                )}
              </div>
              <div className="hidden text-[9px] tracking-widest text-white/55 md:block">
                [TAB] AUTOCOMPLETE • [↑↓] HISTORY • [ESC] CLOSE
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
