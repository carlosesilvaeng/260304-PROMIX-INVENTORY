import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ value: string; label: string }>;
  children?: React.ReactNode;
}

export function Select({ label, error, helperText, options, children, className = '', ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-[color:var(--ui-text-3b3a36)] mb-1.5">
          {label}
          {props.required && <span className="text-[#C94A4A] ml-1">*</span>}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-2.5 
          bg-[var(--ui-surface)]
          border border-[var(--ui-border-9d9b9a)]
          rounded 
          text-[color:var(--ui-text-3b3a36)]
          focus:outline-none 
          focus:ring-2 
          focus:ring-[var(--ui-primary-2475c7)]
          focus:border-transparent
          disabled:bg-[var(--ui-background-f2f3f5)]
          disabled:opacity-50 
          disabled:cursor-not-allowed
          transition-all
          ${error ? 'border-[#C94A4A] focus:ring-[#C94A4A]' : ''}
          ${className}
        `}
        {...props}
      >
        {options ? (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        ) : (
          children
        )}
      </select>
      {helperText && !error && (
        <p className="mt-1 text-xs text-[color:var(--ui-text-muted-5f6773)]">{helperText}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-[#C94A4A]">{error}</p>
      )}
    </div>
  );
}
