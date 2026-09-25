"use client";

import { useEffect, useRef, useState } from "react";
import { COLOR_HEX, COLOR_IDS, COLOR_LABELS, type ColorId } from "@tracinhos/shared";
import { PickerStroke } from "./Marks";
import { PenIcon } from "./Pen";

export function ColorPicker({
  value,
  taken,
  onChange,
}: {
  value: ColorId;
  taken: ColorId[];
  onChange: (color: ColorId) => void;
}) {
  const ready = useRef(false);
  const [drawing, setDrawing] = useState<ColorId | null>(null);
  const [returning, setReturning] = useState<ColorId | null>(null);

  useEffect(() => {
    ready.current = true;
  }, []);

  function pick(id: ColorId) {
    if (ready.current && id !== value) {
      setReturning(value);
      setDrawing(id);
    }
    onChange(id);
  }

  return (
    <div className="colors" role="listbox" aria-label="Cor">
      {COLOR_IDS.map((id) => {
        const busy = taken.includes(id) && id !== value;
        const selected = id === value;
        const isDrawing = drawing === id;
        const isReturning = returning === id;
        return (
          <button
            key={id}
            type="button"
            className="color"
            role="option"
            aria-label={COLOR_LABELS[id]}
            aria-selected={selected}
            aria-disabled={busy}
            data-selected={selected}
            data-drawing={isDrawing}
            data-returning={isReturning}
            disabled={busy}
            style={{ color: COLOR_HEX[id] }}
            onClick={() => pick(id)}
          >
            <span className="color-mark">
              <span className="color-stroke">
                <PickerStroke />
              </span>
              <span
                className="color-pen"
                onAnimationEnd={(event) => {
                  if (isDrawing && event.animationName === "color-pen-draw") {
                    setDrawing(null);
                  }
                  if (isReturning && event.animationName === "color-pen-return") {
                    setReturning(null);
                  }
                }}
              >
                <PenIcon size={28} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
