"use client";

import { COLOR_HEX, COLOR_IDS, type ColorId } from "@tracinhos/shared";

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
            aria-label={id}
            aria-selected={value === id}
            data-selected={value === id}
            disabled={busy}
            style={{ background: COLOR_HEX[id] }}
            onClick={() => onChange(id)}
          />
        );
      })}
    </div>
  );
}
