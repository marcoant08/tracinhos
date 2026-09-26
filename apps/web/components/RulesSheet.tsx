"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./CloseIcon";
import { RulesContent } from "./RulesContent";
import { useSheetPresence } from "@/lib/use-sheet-presence";

export function RulesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { present, leaving } = useSheetPresence(open);

  useEffect(() => {
    if (!open || leaving) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, leaving, onClose]);

  if (!present) return null;

  return (
    <div className={`sheet-root ${leaving ? "is-out" : "is-in"}`}>
      <button className="sheet-backdrop" aria-label="Fechar regras" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-sheet-title"
      >
        <div className="sheet-head">
          <h2 id="rules-sheet-title">Regras</h2>
          <button ref={closeRef} className="icon-btn sheet-close" type="button" onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">
          <RulesContent />
        </div>
      </div>
    </div>
  );
}
