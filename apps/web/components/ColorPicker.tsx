"use client";

import { COLOR_HEX, COLOR_IDS, COLOR_LABELS, type ColorId } from "@tracinhos/shared";
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
  return (
    <div className="colors" role="listbox" aria-label="Cor">
      {COLOR_IDS.map((id) => {
        const busy = taken.includes(id) && id !== value;
        return (
          <button
            key={id}
            type="button"
            className="color"
            role="option"
            aria-label={COLOR_LABELS[id]}
            aria-selected={value === id}
            aria-disabled={busy}
            data-selected={value === id}
            disabled={busy}
            style={{ color: COLOR_HEX[id] }}
            onClick={() => onChange(id)}
          >
            <PenIcon size={40} />
          </button>
        );
      })}
    </div>
  );
}
