import React, { useEffect, useState } from 'react';
import {
  decimalFeetToFeetInchesParts,
  feetInchesToDecimalFeet,
} from '../utils/feetInches';

interface FeetInchesInputProps {
  label: string;
  value: number | string | null | undefined;
  onValueChange: (value: number | null) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
}

function stringifyPart(value: number) {
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function parsePart(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRawParts(value: FeetInchesInputProps['value']) {
  const parts = decimalFeetToFeetInchesParts(value);
  return {
    feet: parts ? stringifyPart(parts.feet) : '',
    inches: parts ? stringifyPart(parts.inches) : '',
  };
}

export function FeetInchesInput({
  label,
  value,
  onValueChange,
  required = false,
  disabled = false,
  error,
  helperText,
}: FeetInchesInputProps) {
  const [feetRaw, setFeetRaw] = useState(() => getRawParts(value).feet);
  const [inchesRaw, setInchesRaw] = useState(() => getRawParts(value).inches);

  useEffect(() => {
    const next = getRawParts(value);
    setFeetRaw(next.feet);
    setInchesRaw(next.inches);
  }, [value]);

  const emitValue = (nextFeetRaw: string, nextInchesRaw: string) => {
    if (!nextFeetRaw.trim() && !nextInchesRaw.trim()) {
      onValueChange(null);
      return;
    }

    const feet = parsePart(nextFeetRaw);
    const inches = parsePart(nextInchesRaw);
    if (feet === null || inches === null) return;
    onValueChange(feetInchesToDecimalFeet(feet, inches));
  };

  const handleFeetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.trim();
    if (nextValue && !/^\d+$/.test(nextValue)) return;
    setFeetRaw(nextValue);
    emitValue(nextValue, inchesRaw);
  };

  const handleInchesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.trim();
    if (nextValue && !/^\d*(\.\d*)?$/.test(nextValue)) return;
    const numericValue = nextValue ? Number(nextValue) : 0;
    if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue >= 12) return;
    setInchesRaw(nextValue);
    emitValue(feetRaw, nextValue);
  };

  return (
    <div className="w-full">
      <label className="mb-1.5 flex min-h-5 items-center text-[#3B3A36] leading-5">
        {label}
        {required && <span className="ml-1 text-[#C94A4A]">*</span>}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={feetRaw}
            onChange={handleFeetChange}
            disabled={disabled}
            placeholder="0"
            className={`w-full rounded border border-[#9D9B9A] bg-white px-3 py-2.5 pr-9 text-[#3B3A36] placeholder:text-[#5F6773] transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2475C7] disabled:cursor-not-allowed disabled:bg-[#F2F3F5] disabled:opacity-50 ${error ? 'border-[#C94A4A] focus:ring-[#C94A4A]' : ''}`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#5F6773]">
            ft
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={inchesRaw}
            onChange={handleInchesChange}
            disabled={disabled}
            placeholder="0"
            className={`w-full rounded border border-[#9D9B9A] bg-white px-3 py-2.5 pr-8 text-[#3B3A36] placeholder:text-[#5F6773] transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2475C7] disabled:cursor-not-allowed disabled:bg-[#F2F3F5] disabled:opacity-50 ${error ? 'border-[#C94A4A] focus:ring-[#C94A4A]' : ''}`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#5F6773]">
            in
          </span>
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-[#C94A4A]">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-[#5F6773]">{helperText}</p>}
    </div>
  );
}
