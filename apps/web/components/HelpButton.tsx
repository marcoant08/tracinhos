"use client";

import { useState } from "react";
import { RulesSheet } from "./RulesSheet";

export function HelpButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`icon-btn help-btn ${className}`.trim()}
        aria-label="Regras do jogo"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      <RulesSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
