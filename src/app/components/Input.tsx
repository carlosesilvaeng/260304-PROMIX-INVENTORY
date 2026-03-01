import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({ label, error, helperText, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[#3B3A36] mb-1.5">
          {label}
          {props.required && <span className="text-[#C94A4A] ml-1">*</span>}
        </label>
      )}
      <input
        className={`
          w-full px-4 py-2.5 
          bg-[#F2F3F5] 
          border border-[#9D9B9A] 
          rounded 
          text-[#3B3A36] 
          placeholder:text-[#5F6773]
          focus:outline-none 
          focus:ring-2 
          focus:ring-[#2475C7] 
          focus:border-transparent
          disabled:opacity-50 
          disabled:cursor-not-allowed
          transition-all
          ${error ? 'border-[#C94A4A] focus:ring-[#C94A4A]' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-[#C94A4A]">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-[#5F6773]">{helperText}</p>
      )}
    </div>
  );
}

interface NumericInputProps extends InputProps {
  onValueChange?: (value: number | null) => void;
}

export function NumericInput({ onValueChange, onChange, ...props }: NumericInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Clamp to min if provided
    const min = props.min !== undefined ? Number(props.min) : 0;
    let numValue: number | null = raw === '' ? null : parseFloat(raw);
    if (numValue !== null && numValue < min) {
      numValue = min;
      e.target.value = String(min);
    }
    if (onValueChange) {
      onValueChange(numValue);
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <Input
      type="number"
      step="any"
      min={props.min !== undefined ? props.min : 0}
      onChange={handleChange}
      {...props}
    />
  );
}
